import type { WebSocket } from "ws";
import { GoogleGenAI, Modality, type LiveServerMessage, type Session } from "@google/genai";

type ClientMsg =
  | { type: "start"; scenarioId: string; scenario: Record<string, unknown> }
  | { type: "audio"; data: string } // base64 PCM16 @ 16 kHz mono
  | { type: "talk_end" }            // user released mic → trigger model response
  | { type: "end" };

const PROJECT = process.env.GOOGLE_CLOUD_PROJECT ?? "";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? "";
const LIVE_MODEL = "gemini-3.1-flash-live-preview";

export function handleConversationWs(ws: WebSocket) {
  const ai = GEMINI_API_KEY
    ? new GoogleGenAI({ apiKey: GEMINI_API_KEY })
    : new GoogleGenAI({ vertexai: true, project: PROJECT, location: "us-central1" });

  let session: Session | null = null;
  let txBuffer = "";
  const audioChunks: Buffer[] = [];

  function send(obj: unknown) {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(obj));
    }
  }

  function makePcmWav(pcm: Buffer, sampleRate = 24000): Buffer {
    const numCh = 1, bits = 16;
    const byteRate = sampleRate * numCh * (bits / 8);
    const blockAlign = numCh * (bits / 8);
    const hdr = Buffer.alloc(44);
    hdr.write("RIFF", 0, "ascii");
    hdr.writeUInt32LE(36 + pcm.byteLength, 4);
    hdr.write("WAVE", 8, "ascii");
    hdr.write("fmt ", 12, "ascii");
    hdr.writeUInt32LE(16, 16);
    hdr.writeUInt16LE(1, 20);
    hdr.writeUInt16LE(numCh, 22);
    hdr.writeUInt32LE(sampleRate, 24);
    hdr.writeUInt32LE(byteRate, 28);
    hdr.writeUInt16LE(blockAlign, 32);
    hdr.writeUInt16LE(bits, 34);
    hdr.write("data", 36, "ascii");
    hdr.writeUInt32LE(pcm.byteLength, 40);
    return Buffer.concat([hdr, pcm]);
  }

  function flushTurn() {
    if (audioChunks.length > 0) {
      const pcm = Buffer.concat(audioChunks);
      const wav = makePcmWav(pcm);
      send({ type: "audio", data: wav.toString("base64"), mimeType: "audio/wav" });
      audioChunks.length = 0;
    }
    if (txBuffer) {
      const italian = txBuffer.trim();
      if (italian) {
        send({ type: "transcript", role: "assistant", italian, text: "" });
      }
      txBuffer = "";
    }
  }

  function handleLiveMessage(message: LiveServerMessage) {
    const parts = message.serverContent?.modelTurn?.parts ?? [];
    for (const part of parts) {
      if (part.inlineData?.data) {
        audioChunks.push(Buffer.from(part.inlineData.data, "base64"));
      }
    }

    const outTx = message.serverContent?.outputTranscription;
    if (outTx && "text" in outTx && typeof outTx.text === "string" && outTx.text) {
      txBuffer += outTx.text;
    }

    if (message.serverContent?.turnComplete) {
      flushTurn();
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
Keep sentences short and clear for a ${scenario.difficulty} level learner.
Start by greeting the user naturally in Italian.`;

        try {
          session = await ai.live.connect({
            model: LIVE_MODEL,
            config: {
              systemInstruction,
              responseModalities: [Modality.AUDIO],
              speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: "Aoede" } },
              },
            },
            callbacks: {
              onopen: () => console.log("Live session opened"),
              onmessage: handleLiveMessage,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onerror: (err: any) => {
                console.error("Gemini Live error:", JSON.stringify(err));
                send({ type: "error", message: err?.message ?? "Live API error" });
              },
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onclose: (e: any) => {
                console.log("Live session closed:", e?.code, e?.reason);
              },
            },
          });

          send({ type: "ready" });
          // Bootstrap the opening greeting
          session.sendClientContent({
            turns: [{ role: "user", parts: [{ text: "Ciao!" }] }],
            turnComplete: true,
          });
        } catch (e) {
          console.error("Failed to start Live session:", e);
          send({ type: "error", message: "Failed to start conversation" });
        }
        break;
      }

      case "audio": {
        if (!session) return;
        try {
          session.sendRealtimeInput({
            audio: { data: msg.data, mimeType: "audio/pcm;rate=16000" },
          });
        } catch (e) {
          console.error("Audio relay error:", e);
        }
        break;
      }

      case "talk_end": {
        if (!session) return;
        try {
          // Tell the model the user's turn is complete → triggers model response
          session.sendClientContent({ turns: [], turnComplete: true });
        } catch (e) {
          console.error("talk_end error:", e);
        }
        break;
      }

      case "end":
        try {
          await session?.close();
        } catch { /* ignore */ }
        session = null;
        txBuffer = "";
        audioChunks.length = 0;
        break;
    }
  });

  ws.on("close", async () => {
    try {
      await session?.close();
    } catch { /* ignore */ }
  });
}
