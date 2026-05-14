/**
 * Multi-turn conversation test.
 * Requires the server to be running: npm run dev
 * Run with: npx ts-node test/multiturn.ts
 */
import WebSocket from "ws";

const WS_URL = process.env.WS_URL ?? "ws://localhost:3001/ws";
const TURN_AUDIO_SECONDS = 2;
const RESPONSE_TIMEOUT_MS = 30_000;

const TEST_SCENARIO = {
  id: "test-scenario-001",
  intent: "Ordering a coffee at a bar",
  characterName: "Marco",
  characterDescription: "A friendly barista at a traditional Roman café",
  setting: "Al Bar",
  difficulty: "A1",
  vocabulary: [{ italian: "caffè", english: "coffee" }],
  likelyPhrases: ["Un caffè, per favore"],
  createdAt: Date.now(),
  userId: "test",
};

// Generate a WAV file containing N seconds of 16kHz mono sine-wave PCM (440 Hz).
function makeSineWav(seconds: number): string {
  const SAMPLE_RATE = 16000;
  const FREQ = 440;
  const samples = SAMPLE_RATE * seconds;
  const pcm = Buffer.alloc(samples * 2);

  for (let i = 0; i < samples; i++) {
    const sample = Math.round(Math.sin((2 * Math.PI * FREQ * i) / SAMPLE_RATE) * 8000);
    pcm.writeInt16LE(sample, i * 2);
  }

  const header = Buffer.alloc(44);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + pcm.byteLength, 4);
  header.write("WAVE", 8, "ascii");
  header.write("fmt ", 12, "ascii");
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(SAMPLE_RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36, "ascii");
  header.writeUInt32LE(pcm.byteLength, 40);

  return Buffer.concat([header, pcm]).toString("base64");
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

function waitFor(
  ws: WebSocket,
  predicate: (msg: Record<string, unknown>) => boolean,
  label: string,
  timeoutMs = RESPONSE_TIMEOUT_MS
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for: ${label}`)), timeoutMs);
    const handler = (raw: WebSocket.RawData) => {
      try {
        const msg = JSON.parse(raw.toString()) as Record<string, unknown>;
        console.log("  ←", JSON.stringify(msg).slice(0, 120));
        if (predicate(msg)) {
          clearTimeout(timer);
          ws.off("message", handler);
          resolve(msg);
        }
      } catch { /* ignore */ }
    };
    ws.on("message", handler);
  });
}

function send(ws: WebSocket, msg: Record<string, unknown>) {
  console.log("  →", JSON.stringify(msg).slice(0, 120));
  ws.send(JSON.stringify(msg));
}

async function runTurn(ws: WebSocket, label: string): Promise<void> {
  console.log(`\n[${label}] Pressing PTT...`);
  send(ws, { type: "talk_start" });

  // Wait for interrupt echo (confirms activityStart was processed)
  await waitFor(ws, (m) => m.type === "interrupt", `${label} interrupt ack`, 5000).catch(() => {
    console.log(`  (no interrupt echo — model may not have been speaking)`);
  });

  // Release PTT with one finalized turn recording.
  const data = makeSineWav(TURN_AUDIO_SECONDS);
  console.log(`[${label}] Releasing PTT...`);
  send(ws, { type: "talk_end", audio: { data, mimeType: "audio/wav" } });

  // Wait for model audio response
  console.log(`[${label}] Waiting for model response...`);
  await waitFor(ws, (m) => m.type === "audio", `${label} model audio`);
  console.log(`[${label}] ✓ Model responded`);
}

async function main() {
  console.log(`Connecting to ${WS_URL}...`);
  const ws = new WebSocket(WS_URL);

  ws.on("error", (e) => { console.error("WS error:", e.message); process.exit(1); });

  await new Promise<void>((resolve, reject) => {
    ws.once("open", resolve);
    ws.once("error", reject);
  });
  console.log("Connected.\n");

  // Start session
  send(ws, { type: "start", scenarioId: TEST_SCENARIO.id, scenario: TEST_SCENARIO });
  console.log("Waiting for ready + model greeting...");
  await waitFor(ws, (m) => m.type === "ready", "ready");
  await waitFor(ws, (m) => m.type === "audio", "greeting audio");
  console.log("✓ Greeting received\n");

  const TURNS = 5;
  for (let i = 1; i <= TURNS; i++) {
    await runTurn(ws, `Turn ${i}`);
    if (i < TURNS) await sleep(1000); // simulate user thinking
  }

  // End session
  console.log("\nEnding session...");
  send(ws, { type: "end" });
  await sleep(500);
  ws.close();

  console.log(`\n✅ All ${TURNS} turns succeeded — multi-turn conversation working correctly`);
  process.exit(0);
}

main().catch((e) => {
  console.error("\n❌ Test failed:", e.message);
  process.exit(1);
});
