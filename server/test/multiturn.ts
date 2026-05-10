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

// Generate N seconds of 16kHz mono sine-wave PCM (440 Hz) as base64 chunks
function makeSineChunks(seconds: number, chunkMs = 100): string[] {
  const SAMPLE_RATE = 16000;
  const FREQ = 440;
  const samplesPerChunk = Math.floor((SAMPLE_RATE * chunkMs) / 1000);
  const totalChunks = Math.floor((seconds * 1000) / chunkMs);
  const chunks: string[] = [];
  let t = 0;
  for (let c = 0; c < totalChunks; c++) {
    const buf = Buffer.alloc(samplesPerChunk * 2);
    for (let i = 0; i < samplesPerChunk; i++) {
      const sample = Math.round(Math.sin((2 * Math.PI * FREQ * t) / SAMPLE_RATE) * 8000);
      buf.writeInt16LE(sample, i * 2);
      t++;
    }
    chunks.push(buf.toString("base64"));
  }
  return chunks;
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

  // Stream sine-wave audio
  const chunks = makeSineChunks(TURN_AUDIO_SECONDS);
  console.log(`[${label}] Sending ${chunks.length} audio chunks...`);
  for (const data of chunks) {
    send(ws, { type: "audio", data });
    await sleep(100);
  }

  // Release PTT
  console.log(`[${label}] Releasing PTT...`);
  send(ws, { type: "talk_end" });

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

  // Turn 1
  await runTurn(ws, "Turn 1");

  // Brief pause between turns (simulates user thinking)
  await sleep(1000);

  // Turn 2
  await runTurn(ws, "Turn 2");

  // End session
  console.log("\nEnding session...");
  send(ws, { type: "end" });
  await sleep(500);
  ws.close();

  console.log("\n✅ All turns succeeded — multi-turn conversation working correctly");
  process.exit(0);
}

main().catch((e) => {
  console.error("\n❌ Test failed:", e.message);
  process.exit(1);
});
