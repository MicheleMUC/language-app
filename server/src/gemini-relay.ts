import type { WebSocket } from "ws";
import { GoogleGenAI, Modality, type LiveServerMessage, type Session } from "@google/genai";

type ClientMsg =
  | { type: "start"; scenarioId: string; scenario: Record<string, unknown> }
  | { type: "talk_start" }
  | { type: "audio"; data: string; mimeType?: string }
  | { type: "talk_end" }
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
  let flushInterval: ReturnType<typeof setInterval> | null = null;

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

  function startFlushInterval() {
    if (flushInterval) return;
    flushInterval = setInterval(() => {
      if (audioChunks.length > 0) {
        const pcm = Buffer.concat(audioChunks);
        const wav = makePcmWav(pcm);
        send({ type: "audio", data: wav.toString("base64"), mimeType: "audio/wav" });
        audioChunks.length = 0;
      }
    }, 400);
  }

  function stopFlushInterval() {
    if (flushInterval) {
      clearInterval(flushInterval);
      flushInterval = null;
    }
  }

  function flushTurn() {
    stopFlushInterval();
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
        startFlushInterval();
      }
    }

    const outTx = message.serverContent?.outputTranscription;
    if (outTx && "text" in outTx && typeof outTx.text === "string" && outTx.text) {
      txBuffer += outTx.text;
      // Stream each fragment to the client immediately for word-by-word display
      send({ type: "transcript_partial", italian: txBuffer.trim() });
    }

    const inTx = message.serverContent?.inputTranscription;
    if (inTx && "text" in inTx && typeof inTx.text === "string" && inTx.text.trim()) {
      send({ type: "transcript", role: "user", italian: inTx.text.trim(), text: "" });
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

        const vocab = (scenario.vocabulary as Array<{ italian: string; english: string; example?: string }> ?? [])
          .map((v) => `  - ${v.italian} (${v.english})${v.example ? `: "${v.example}"` : ""}`)
          .join("\n");

        const phrases = (scenario.likelyPhrases as string[] ?? []).join(", ");

        const difficultyGuide =
          scenario.difficulty === "A1" || scenario.difficulty === "A2"
            ? "Use only simple present tense and very common words. Speak slowly and clearly."
            : scenario.difficulty === "B1" || scenario.difficulty === "B2"
            ? "Use a mix of present, past (passato prossimo), and future tenses naturally."
            : "Use natural idiomatic Italian including subjunctive and regional expressions.";

        const systemInstruction = `You are ${scenario.characterName}. ${scenario.characterDescription}
Setting: ${scenario.setting}

CONVERSATION RULES (follow strictly):
- Speak ONLY in Italian. Never switch to English for any reason.
- Keep every response to 1–2 short sentences. This is a real-time spoken conversation.
- Respond DIRECTLY to what the learner just said — always acknowledge it first.
- If you cannot understand the learner, say exactly: "Scusa, non ho capito. Puoi ripetere più lentamente?"
- If the learner makes a grammar error, acknowledge their meaning and naturally model the correct form in your reply — never explicitly say "you made an error."
- If the learner speaks English, redirect warmly: "Proviamo in italiano! Come si dice...?"
- ${difficultyGuide}

SCENARIO VOCABULARY — weave these in naturally when the topic arises:
${vocab || "  (none specified)"}

PHRASES you might use naturally:
${phrases || "(none specified)"}

Begin by greeting the learner warmly and setting the scene in one sentence.`;

        try {
          session = await ai.live.connect({
            model: LIVE_MODEL,
            config: {
              systemInstruction,
              responseModalities: [Modality.AUDIO],
              inputAudioTranscription: {},
              outputAudioTranscription: {},
              realtimeInputConfig: {
                // PTT mode: never auto-respond — only fire when we send turnComplete
                automaticActivityDetection: { disabled: true },
              },
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
                session = null;
                send({ type: "error", message: `Session closed (${e?.code ?? "unknown"})` });
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

      case "talk_start": {
        if (!session) return;
        try {
          stopFlushInterval();
          audioChunks.length = 0; // discard any buffered AI audio from previous turn
          session.sendRealtimeInput({ activityStart: {} });
          send({ type: "interrupt" }); // tell client to stop current playback
        } catch (e) {
          console.error("talk_start error:", e);
        }
        break;
      }

      case "audio": {
        if (!session) return;
        try {
          session.sendRealtimeInput({
            audio: { data: msg.data, mimeType: msg.mimeType ?? "audio/pcm;rate=16000" },
          });
        } catch (e) {
          console.error("Audio relay error:", e);
        }
        break;
      }

      case "talk_end": {
        if (!session) return;
        try {
          session.sendRealtimeInput({ activityEnd: {} });
          // activityEnd alone doesn't trigger generation on this model;
          // sendClientContent with turnComplete is the explicit trigger.
          session.sendClientContent({ turns: [], turnComplete: true });
        } catch (e) {
          console.error("talk_end error:", e);
        }
        break;
      }

      case "end":
        stopFlushInterval();
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
    stopFlushInterval();
    try {
      await session?.close();
    } catch { /* ignore */ }
  });
}
