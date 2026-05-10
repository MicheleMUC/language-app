import type { WebSocket } from "ws";
import { GoogleGenAI, Modality, type LiveServerMessage, type Session } from "@google/genai";

type ClientMsg =
  | { type: "start"; scenarioId: string; scenario: Record<string, unknown> }
  | { type: "audio"; data: string } // base64 PCM16 @ 16 kHz mono
  | { type: "pause" }
  | { type: "resume" }
  | { type: "end" };

const PROJECT = process.env.GOOGLE_CLOUD_PROJECT ?? "";
const LIVE_MODEL = "gemini-2.5-flash-preview-native-audio-dialog";

export function handleConversationWs(ws: WebSocket) {
  const ai = new GoogleGenAI({ vertexai: true, project: PROJECT, location: "us-central1" });

  let session: Session | null = null;
  let paused = false;

  function send(obj: unknown) {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(obj));
    }
  }

  function handleLiveMessage(message: LiveServerMessage) {
    const parts = message.serverContent?.modelTurn?.parts ?? [];
    for (const part of parts) {
      if (part.inlineData?.data) {
        send({ type: "audio", data: part.inlineData.data });
      }
      if (part.text) {
        // The system prompt asks the model to append [English: ...] for translations.
        const match = part.text.match(/\[English:\s*(.+?)\]/s);
        const italian = part.text.replace(/\[English:.+?\]/s, "").trim();
        if (italian) {
          send({
            type: "transcript",
            role: "assistant",
            italian,
            text: match?.[1]?.trim() ?? "",
          });
        }
      }
    }

    // Forward output transcription if the model is transcribing speech
    const outTx = message.serverContent?.outputTranscription;
    if (outTx && "text" in outTx && typeof outTx.text === "string" && outTx.text) {
      send({ type: "transcript", role: "assistant", italian: outTx.text, text: "" });
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
After each of your responses, append an English translation on a new line like: [English: ...]
Keep sentences short and clear for a ${scenario.difficulty} level learner.
Start by greeting the user naturally in Italian.`;

        try {
          session = await ai.live.connect({
            model: LIVE_MODEL,
            config: {
              systemInstruction,
              responseModalities: [Modality.AUDIO, Modality.TEXT],
              speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: "Aoede" } },
              },
            },
            callbacks: {
              onopen: () => console.log("Live session opened"),
              onmessage: handleLiveMessage,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onerror: (err: any) => {
                console.error("Gemini Live error:", err);
                send({ type: "error", message: err?.message ?? "Live API error" });
              },
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onclose: (e: any) => {
                console.log("Live session closed:", e?.code, e?.reason);
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
          session.sendRealtimeInput({
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
