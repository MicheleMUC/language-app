import type { WebSocket } from "ws";
import { spawn } from "child_process";
import { GoogleGenAI, Modality } from "@google/genai";

type CapturedAudio = { data: string; mimeType: string };

type ClientMsg =
  | { type: "start"; scenarioId: string; scenario: Record<string, unknown> }
  | { type: "talk_start" }
  | { type: "talk_end"; audio: CapturedAudio }
  | { type: "talk_cancel" }
  | { type: "end" };

type Turn = { role: "user" | "assistant"; italian: string };

const PROJECT = process.env.GOOGLE_CLOUD_PROJECT ?? "";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? "";
const TEXT_MODEL = "gemini-3-flash-preview";
const TRANSCRIPTION_MODEL = "gemini-2.5-flash";
const TTS_MODEL = "gemini-2.5-flash-preview-tts";
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

function cleanText(text: string) {
  return text
    .replace(/```[\s\S]*?```/g, "")
    .replace(/^["“”]+|["“”]+$/g, "")
    .trim();
}

function extractInlineAudio(response: unknown): Buffer {
  const parts = (response as {
    candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { data?: string | Buffer } }> } }>;
  }).candidates?.[0]?.content?.parts ?? [];

  const data = parts.find((part) => part.inlineData?.data)?.inlineData?.data;
  if (!data) throw new Error("TTS response did not include audio data");

  return Buffer.isBuffer(data) ? data : Buffer.from(data, "base64");
}

function buildSystemInstruction(scenario: Record<string, unknown>) {
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

  return `You are ${scenario.characterName}. ${scenario.characterDescription}
Setting: ${scenario.setting}

CONVERSATION RULES (follow strictly):
- Speak ONLY in Italian. Never switch to English for any reason.
- Keep every response to 1-2 short sentences. This is a spoken conversation.
- Respond DIRECTLY to what the learner just said; acknowledge it first.
- If you cannot understand the learner, say exactly: "Scusa, non ho capito. Puoi ripetere piu lentamente?"
- If the learner makes a grammar error, acknowledge their meaning and naturally model the correct form in your reply. Never explicitly say "you made an error."
- If the learner speaks English, redirect warmly: "Proviamo in italiano! Come si dice...?"
- ${difficultyGuide}

SCENARIO VOCABULARY - weave these in naturally when the topic arises:
${vocab || "  (none specified)"}

PHRASES you might use naturally:
${phrases || "(none specified)"}`;
}

export function handleConversationWs(ws: WebSocket) {
  const ai = GEMINI_API_KEY
    ? new GoogleGenAI({ apiKey: GEMINI_API_KEY })
    : new GoogleGenAI({ vertexai: true, project: PROJECT, location: "us-central1" });

  let systemInstruction = "";
  let scenarioName = "Assistant";
  let activeScenarioId: string | null = null;
  const history: Turn[] = [];
  let active = true;

  function send(obj: unknown) {
    if (active && ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(obj));
    }
  }

  function formatHistory() {
    return history
      .slice(-12)
      .map((turn) => `${turn.role === "user" ? "Learner" : scenarioName}: ${turn.italian}`)
      .join("\n");
  }

  async function transcribeCapturedAudio(audio: CapturedAudio) {
    const inputBytes = Math.round(audio.data.length * 0.75);
    console.log(`[relay] transcribing user audio (${inputBytes} bytes, ${audio.mimeType})`);
    const pcm = await transcodeToPcm(audio);
    if (pcm.byteLength === 0) {
      throw new Error("Transcoded audio was empty");
    }

    const wav = makePcmWav(pcm, 16000);
    const result = await ai.models.generateContent({
      model: TRANSCRIPTION_MODEL,
      config: {
        systemInstruction: `You are a speech transcription engine for an Italian conversation practice app.
Transcribe only what the learner says.
Return only the transcript text, with no markdown, no quotes, and no explanation.
If there is no intelligible speech, return exactly: EMPTY`,
      },
      contents: [
        {
          role: "user",
          parts: [
            { text: "Transcribe this learner audio. Preserve Italian if spoken; preserve English if the learner spoke English." },
            { inlineData: { data: wav.toString("base64"), mimeType: "audio/wav" } },
          ],
        },
      ],
    });

    const transcript = cleanText(result.text ?? "");
    if (!transcript || transcript.toUpperCase() === "EMPTY") {
      throw new Error("No intelligible speech found in recording");
    }

    console.log(`[relay] user transcript: "${transcript.slice(0, 120)}"`);
    return transcript;
  }

  async function generateAssistantText(userTranscript?: string) {
    const prompt = userTranscript
      ? `Conversation so far:
${formatHistory()}

The learner just said: "${userTranscript}"

Reply now as ${scenarioName}. Return only your Italian reply.`
      : `Begin the scenario by greeting the learner warmly and setting the scene in one sentence. Return only your Italian line.`;

    const result = await ai.models.generateContent({
      model: TEXT_MODEL,
      config: {
        systemInstruction,
        thinkingConfig: { thinkingBudget: 0 },
      },
      contents: prompt,
    });

    const text = cleanText(result.text ?? "");
    if (!text) throw new Error("Text model returned an empty assistant response");
    return text;
  }

  async function synthesizeSpeech(text: string) {
    console.log(`[relay] synthesizing assistant audio: "${text.slice(0, 120)}"`);
    const result = await ai.models.generateContent({
      model: TTS_MODEL,
      contents: [{ parts: [{ text: `Say in warm, clear Italian: ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: "Aoede" } },
          languageCode: "it-IT",
        },
      },
    });

    const pcm = extractInlineAudio(result);
    if (pcm.byteLength === 0) throw new Error("TTS returned empty audio");
    return makePcmWav(pcm, 24000);
  }

  async function sendAssistantTurn(text: string) {
    history.push({ role: "assistant", italian: text });
    send({ type: "transcript", role: "assistant", italian: text, text: "" });

    try {
      const wav = await synthesizeSpeech(text);
      send({ type: "audio", data: wav.toString("base64"), mimeType: "audio/wav" });
    } catch (e) {
      console.error("TTS error:", e);
      send({ type: "turn_error", message: "I generated a reply, but could not play audio for it" });
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

        systemInstruction = buildSystemInstruction(msg.scenario);
        scenarioName = String(msg.scenario.characterName ?? "Assistant");

        try {
          send({ type: "ready" });
          const greeting = await generateAssistantText();
          await sendAssistantTurn(greeting);
        } catch (e) {
          console.error("Failed to start conversation:", e);
          send({ type: "error", message: "Failed to start conversation" });
        }
        break;
      }

      case "talk_start": {
        console.log("[relay] talk_start -> interrupt current playback");
        send({ type: "interrupt" });
        break;
      }

      case "talk_end": {
        try {
          console.log("[relay] talk_end -> transcribe, generate, synthesize");
          const transcript = await transcribeCapturedAudio(msg.audio);
          history.push({ role: "user", italian: transcript });
          send({ type: "transcript", role: "user", italian: transcript, text: "" });

          const assistantText = await generateAssistantText(transcript);
          await sendAssistantTurn(assistantText);
        } catch (e) {
          console.error("talk_end error:", e);
          send({ type: "turn_error", message: "I could not answer that turn - please try again" });
        }
        break;
      }

      case "talk_cancel":
        console.log("[relay] talk_cancel -> no-op");
        break;

      case "end":
        active = false;
        try {
          ws.close();
        } catch { /* ignore */ }
        break;
    }
  });

  ws.on("close", () => {
    active = false;
    if (activeScenarioId && activeScenarioSockets.get(activeScenarioId) === ws) {
      activeScenarioSockets.delete(activeScenarioId);
    }
  });
}
