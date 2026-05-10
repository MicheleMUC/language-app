import type { WebSocket } from "ws";
import { GoogleGenAI } from "@google/genai";

type ClientMsg =
  | { type: "start"; scenarioId: string; scenario: Record<string, unknown> }
  | { type: "audio"; data: string }
  | { type: "pause" }
  | { type: "resume" }
  | { type: "end" };

const PROJECT = process.env.GOOGLE_CLOUD_PROJECT ?? "";
const LIVE_MODEL = "gemini-2.5-flash-preview-native-audio-dialog";

export function handleConversationWs(ws: WebSocket) {
  const ai = new GoogleGenAI({ vertexai: true, project: PROJECT, location: "us-central1" });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let session: any = null;
  let paused = false;

  function send(obj: unknown) {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(obj));
    }
  }

  ws.on("message", async (raw) => {
    let msg: ClientMsg;
    try {
      msg = JSON.parse(raw.toString()) as ClientMsg;
    } catch {
      return;
    }

    switch (msg.type) {
      case "start": {
        const { scenario } = msg;
        const systemInstruction = `You are ${scenario.characterName}, ${scenario.characterDescription}.
Setting: ${scenario.setting}.
Speak ONLY in Italian. Be natural, warm, and patient with the language learner.
After each of your responses, provide an English translation in square brackets like: [English: ...]
Keep sentences short and clear for a ${scenario.difficulty} level learner.`;

        try {
          // @google/genai Live API via Vertex AI
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const liveModel = (ai as any).live;
          session = await liveModel.connect({
            model: LIVE_MODEL,
            config: {
              systemInstruction,
              responseModalities: ["AUDIO", "TEXT"],
              speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: "Aoede" } },
              },
            },
            callbacks: {
              onmessage: (message: { serverContent?: { modelTurn?: { parts?: Array<{ inlineData?: { data: string; mimeType: string }; text?: string }> } } }) => {
                const parts = message.serverContent?.modelTurn?.parts ?? [];
                for (const part of parts) {
                  if (part.inlineData?.data) {
                    send({ type: "audio", data: part.inlineData.data });
                  }
                  if (part.text) {
                    const match = part.text.match(/\[English:\s*(.+?)\]/s);
                    send({
                      type: "transcript",
                      role: "assistant",
                      italian: part.text.replace(/\[English:.+?\]/s, "").trim(),
                      text: match?.[1]?.trim() ?? "",
                    });
                  }
                }
              },
              onerror: (err: Error) => {
                console.error("Gemini Live error:", err);
                send({ type: "error", message: err.message });
              },
            },
          });

          send({ type: "ready" });
        } catch (e) {
          console.error("Failed to start Live session:", e);
          send({ type: "error", message: "Failed to start conversation" });
        }
        break;
      }

      case "audio": {
        if (paused || !session) return;
        try {
          await session.sendRealtimeInput({
            audio: { data: msg.data, mimeType: "audio/pcm;rate=16000" },
          });
        } catch (e) {
          console.error("Audio relay error:", e);
        }
        break;
      }

      case "pause":
        paused = true;
        send({ type: "paused" });
        break;

      case "resume":
        paused = false;
        send({ type: "resumed" });
        break;

      case "end":
        try {
          await session?.close();
        } catch { /* ignore */ }
        session = null;
        break;
    }
  });

  ws.on("close", async () => {
    try {
      await session?.close();
    } catch { /* ignore */ }
  });
}
