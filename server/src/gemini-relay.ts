import type { WebSocket } from "ws";
import { spawn } from "child_process";
import { ai } from "./ai-client";

type CapturedAudio = { data: string; mimeType: string };

type LearnerCtx = {
  userContext?: { name?: string; occupation?: string; topics_mentioned?: string[]; last_session?: string };
  vocabToReuse?: Array<{ word: string; seen_count: number }>;
  weaknessMap?: Record<string, number>;
};

type ClientMsg =
  | { type: "start"; scenarioId: string; scenario: Record<string, unknown>; preferences?: { naturalCorrection?: boolean }; learnerContext?: LearnerCtx; sessionGoal?: string }
  | { type: "talk_start" }
  | { type: "talk_end"; audio: CapturedAudio }
  | { type: "talk_cancel" }
  | { type: "end" };

const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? "";
const LIVE_MODEL = "gemini-3.1-flash-live-preview";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ffmpegPath = require("ffmpeg-static") as string | null;
const activeScenarioSockets = new Map<string, WebSocket>();

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

function transcodeToPcm(audio: CapturedAudio): Promise<Buffer> {
  if (audio.mimeType.startsWith("audio/pcm")) {
    return Promise.resolve(Buffer.from(audio.data, "base64"));
  }

  if (!ffmpegPath) {
    return Promise.reject(new Error("ffmpeg-static did not provide a binary path"));
  }

  const input = Buffer.from(audio.data, "base64");
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, [
      "-hide_banner",
      "-loglevel", "error",
      "-i", "pipe:0",
      "-f", "s16le",
      "-acodec", "pcm_s16le",
      "-ac", "1",
      "-ar", "16000",
      "pipe:1",
    ]);

    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];

    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve(Buffer.concat(stdout));
        return;
      }

      reject(new Error(`ffmpeg exited ${code}: ${Buffer.concat(stderr).toString("utf8").trim()}`));
    });

    child.stdin.end(input);
  });
}

function buildSystemInstruction(scenario: Record<string, unknown>, naturalCorrection = true, learnerContext?: LearnerCtx, sessionGoal?: string) {
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

  let learnerBlock = "";
  if (learnerContext) {
    const ctx = learnerContext.userContext ?? {};
    const lines: string[] = [];
    if (ctx.name) lines.push(`- Name: ${ctx.name}`);
    if (ctx.occupation) lines.push(`- Occupation: ${ctx.occupation}`);
    if (ctx.topics_mentioned?.length) lines.push(`- Past topics discussed: ${ctx.topics_mentioned.slice(0, 8).join(", ")}`);
    if (ctx.last_session) lines.push(`- Last session: ${ctx.last_session}`);

    const vocabToReuse = (learnerContext.vocabToReuse ?? [])
      .sort((a, b) => b.seen_count - a.seen_count)
      .slice(0, 5)
      .map((v) => v.word);
    if (vocabToReuse.length) lines.push(`- Words to weave in naturally this session: ${vocabToReuse.join(", ")}`);

    if (lines.length) {
      learnerBlock = `\n\nLEARNER CONTEXT (remember throughout the conversation):\n${lines.join("\n")}`;
    }
  }

  const goalBlock = sessionGoal
    ? `\n\nLEARNER GOAL: The learner wants to "${sessionGoal}". Gently create natural opportunities to practice this.`
    : "";

  return `You are ${scenario.characterName}. ${scenario.characterDescription}
Setting: ${scenario.setting}

CONVERSATION RULES (follow strictly):
- Speak ONLY in Italian. Never switch to English for any reason.
- Keep every response to 1-2 short sentences. This is a spoken conversation.
- Respond DIRECTLY to what the learner just said; acknowledge it first.
- If you cannot understand the learner, say exactly: "Scusa, non ho capito. Puoi ripetere piu lentamente?"
- ${naturalCorrection ? 'If the learner makes a grammar error, acknowledge their meaning and naturally model the correct form in your reply. Never explicitly say "you made an error."' : 'Do NOT correct the learner\'s grammar. Focus only on continuing the conversation naturally.'}
- If the learner speaks English, redirect warmly: "Proviamo in italiano! Come si dice...?"
- ${difficultyGuide}

SCENARIO VOCABULARY - weave these in naturally when the topic arises:
${vocab || "  (none specified)"}

PHRASES you might use naturally:
${phrases || "(none specified)"}${learnerBlock}${goalBlock}`;
}

export function handleConversationWs(ws: WebSocket) {
  let activeScenarioId: string | null = null;
  let active = true;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let session: any = null;

  function send(obj: unknown) {
    if (active && ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(obj));
    }
  }

  const audioChunks: Buffer[] = [];
  let txBuffer = "";

  function flushTurn() {
    if (audioChunks.length > 0) {
      // Gemini Live outputs audio at 24000Hz by default
      const pcm = Buffer.concat(audioChunks);
      const wav = makePcmWav(pcm, 24000);
      send({ type: "audio", data: wav.toString("base64"), mimeType: "audio/wav" });
      audioChunks.length = 0;
    }

    if (txBuffer.trim()) {
      send({ type: "transcript", role: "assistant", italian: txBuffer.trim(), text: "" });
      txBuffer = "";
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function handleLiveMessage(message: any) {
    const sc = message.serverContent;
    if (!sc) return;

    // User speech transcription
    const inputText = sc.inputTranscription?.text;
    if (inputText?.trim()) {
      send({ type: "transcript", role: "user", italian: inputText.trim(), text: "" });
    }

    // Model audio transcription
    const outputText = sc.outputTranscription?.text;
    if (outputText?.trim()) {
      txBuffer += outputText;
    }

    // Model audio chunks
    const parts = sc.modelTurn?.parts ?? [];
    for (const part of parts) {
      if (part.inlineData?.data) {
        audioChunks.push(Buffer.from(part.inlineData.data, "base64"));
      }
    }

    // Flush complete turn as WAV + transcript
    if (sc.turnComplete) {
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
        const scenarioId = String(msg.scenarioId || msg.scenario.id || "");
        const existing = activeScenarioSockets.get(scenarioId);
        if (scenarioId && existing && existing !== ws && existing.readyState === existing.OPEN) {
          console.warn(`[relay] duplicate start for ${scenarioId} - closing duplicate socket`);
          try {
            ws.close();
          } catch { /* ignore */ }
          return;
        }

        if (scenarioId) {
          activeScenarioId = scenarioId;
          activeScenarioSockets.set(scenarioId, ws);
        }

        const systemInstruction = buildSystemInstruction(
          msg.scenario,
          msg.preferences?.naturalCorrection ?? true,
          msg.learnerContext,
          msg.sessionGoal,
        );

        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const liveModel = (ai as any).live;
          session = await liveModel.connect({
            model: LIVE_MODEL,
            config: {
              systemInstruction: { parts: [{ text: systemInstruction }] },
              responseModalities: ["AUDIO"],
              speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: "Aoede" } },
              },
              inputAudioTranscription: {},
              outputAudioTranscription: {},
              realtimeInputConfig: {
                automaticActivityDetection: { disabled: true },
              },
            },
            callbacks: {
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

          // Kick the model to deliver its opening greeting
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
        console.log("[relay] talk_start -> interrupt current playback");
        send({ type: "interrupt" });
        try {
          session?.sendRealtimeInput({ activityStart: {} });
        } catch (e) {
          console.warn("activityStart failed:", e);
        }
        break;
      }

      case "talk_end": {
        if (!session) {
          console.warn("talk_end received but session is null");
          break;
        }
        try {
          console.log("[relay] talk_end -> transcoding to PCM and sending to Live API");
          const pcm = await transcodeToPcm(msg.audio);

          // SDK expects a plain object with mimeType+data, not a native Blob
          session.sendRealtimeInput({ audio: { mimeType: "audio/pcm;rate=16000", data: pcm.toString("base64") } });
          session.sendRealtimeInput({ activityEnd: {} });
        } catch (e) {
          console.error("talk_end error:", e);
          send({ type: "turn_error", message: "I could not process your audio - please try again" });
        }
        break;
      }

      case "talk_cancel":
        console.log("[relay] talk_cancel -> no-op");
        break;

      case "end":
        active = false;
        try {
          await session?.close();
        } catch { /* ignore */ }
        session = null;
        try {
          ws.close();
        } catch { /* ignore */ }
        break;
    }
  });

  ws.on("close", async () => {
    active = false;
    if (activeScenarioId && activeScenarioSockets.get(activeScenarioId) === ws) {
      activeScenarioSockets.delete(activeScenarioId);
    }
    try {
      await session?.close();
    } catch { /* ignore */ }
  });
}
