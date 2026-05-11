# Latency Reduction Plan

## Context

Two main sources of perceived latency:
1. **Scenario creation**: single blocking `gemini-2.5-flash` call takes 2-5 seconds; UI shows only a spinner
2. **Conversation turns**: AI audio is buffered until `turnComplete` fires — user waits 2-3 seconds of silence before hearing anything; no "thinking" indicator during that gap

---

## Part 1: Scenario Creation

### A. Pre-generation cache — `server/src/scenario.ts`

Extract generation into `generateAndCache(intent)`. Add `Map<string, object>` cache keyed by intent string (no `id`/`createdAt` — those are added per-request).

On module load, fire-and-forget `warmCache()` that background-generates all 12 known intents staggered 500ms apart:

```
const KNOWN_INTENTS = [
  "Talking to my Italian neighbors",
  "Shopping at an Italian outdoor market",
  "Ordering food and wine at an Italian trattoria",
  "Ordering coffee and breakfast at an Italian bar",
  "Buying a train ticket and asking for directions",
  "Explaining symptoms to a doctor in Italian",
  "A job interview at an Italian company",
  "Making a phone call to book a restaurant reservation",
  "Discussing academic topics with Italian professors",
  "Debating current Italian political issues",
  "Discussing Italian art and culture at a gallery",
  "Viewing an apartment and negotiating rent in Italy",
];
```

In the POST handler: check cache first, fall through to `generateAndCache` on miss, cache the result.

**Result**: First click on any card after server start: normal 2-5s. Subsequent clicks (and all clicks after warm-up): <200ms.

### B. Animated loading messages — `app/(tabs)/scenarios.tsx`

Add `LOADING_MESSAGES` array at module level:
```
["Creo il personaggio...", "Preparo la scena...", "Scelgo il vocabolario..."]
```

Add `loadingMsgIdx` state + `useEffect` on `loading` that runs `setInterval` at 1500ms to cycle the index. Replace the plain `<ActivityIndicator>` in the card loading branch with a small spinner + cycling text node. Add `loadingMsg` style to StyleSheet.

---

## Part 2: Conversation

### C. Stream audio chunks during turn — `server/src/gemini-relay.ts`

Currently `handleLiveMessage` pushes all PCM chunks to `audioChunks[]` and only sends in `flushTurn()` on `turnComplete`. This causes 2-3s of silence for multi-sentence responses.

Add a 400ms `setInterval` flush alongside existing logic:

- Add `let flushInterval: ReturnType<typeof setInterval> | null = null`
- Add `startFlushInterval()`: every 400ms, if `audioChunks.length > 0`, concat + `makePcmWav` + `send({type:"audio",...})` + clear array
- Add `stopFlushInterval()`: clears the interval
- In `handleLiveMessage` audio part push: call `startFlushInterval()` (no-op if already running)
- In `flushTurn()`: call `stopFlushInterval()` first, then do existing final drain + transcript flush
- In `case "talk_start"`: `stopFlushInterval()` + `audioChunks.length = 0` (discard AI audio from previous turn)
- In `case "end"` and `ws.on("close")`: `stopFlushInterval()`

**Result**: User hears first AI words ~400ms after Gemini starts generating, not after it finishes the entire response.

### D. Audio queue on client — `hooks/useConversation.ts`

Currently `playAudio` calls `player.replace()` directly. With streaming multiple chunks, each call would interrupt the previous one.

Add `audioQueueRef` and `isDrainingRef`. Use the ref-based drain pattern to avoid stale closure issues:

```typescript
const audioQueueRef = useRef<Array<{ uri: string }>>([]);
const isDrainingRef = useRef(false);

const drainQueueRef = useRef<() => void>(() => {});
drainQueueRef.current = () => {
  if (isDrainingRef.current) return;
  const next = audioQueueRef.current.shift();
  if (!next) return;
  isDrainingRef.current = true;
  try { player.replace(next); player.play(); }
  catch { isDrainingRef.current = false; drainQueueRef.current(); }
};
const drainQueue = useCallback(() => drainQueueRef.current(), []);
```

Replace `playAudio` body:
```typescript
audioQueueRef.current.push({ uri: `data:${mimeType};base64,${base64}` });
drainQueue();
```

Add `useEffect` on `playerStatus.playing`:
```typescript
useEffect(() => {
  if (!playerStatus.playing) {
    isDrainingRef.current = false;
    drainQueue();
  }
}, [playerStatus.playing, drainQueue]);
```

In `handleMessage` case `"interrupt"`: `audioQueueRef.current = []; isDrainingRef.current = false;`  
In `end()`: same queue clear.

### E. "Thinking" status — `useConversation.ts` + `[id].tsx`

**Hook (`useConversation.ts`):**
- Add `"thinking"` to `Status` type
- In `stopTalking()`: change `setStatus("active")` → `setStatus("thinking")`
- In `handleMessage` case `"audio"`: add `setStatus(prev => prev === "thinking" ? "active" : prev)` before `playAudio`

**Screen (`app/conversation/[id].tsx`):**
- Add `const isThinking = status === "thinking"`
- Update `isConnected` to include `"thinking"`
- Status pill dot: `isThinking ? "#7b5ea7"` (purple) between talking and model-speaking checks
- Status pill text: `isThinking ? "Sto elaborando"` 
- Turn indicator pill: add `thinkingPill` style + `isThinking` color/text branch with "STA ELABORANDO..."
- Mic button `disabled`: add `|| isThinking`

---

## Files to Modify

| File | Changes |
|------|---------|
| `server/src/scenario.ts` | Cache map, KNOWN_INTENTS, generateAndCache(), warmCache(), POST handler update |
| `server/src/gemini-relay.ts` | flushInterval, startFlushInterval(), stopFlushInterval(), hook into handleLiveMessage + talk_start + flushTurn + cleanup |
| `hooks/useConversation.ts` | Status type, audio queue refs, drainQueue, playAudio, stopTalking, handleMessage audio/interrupt cases, end() |
| `app/(tabs)/scenarios.tsx` | LOADING_MESSAGES, loadingMsgIdx state, useEffect interval, card loading branch, loadingMsg style |
| `app/conversation/[id].tsx` | isThinking, isConnected, status pill, turn pill, mic disabled |

## Implementation Order

1. **A** (scenario cache) — pure server, safe to ship alone, biggest latency win for scenarios
2. **B** (loading messages) — pure UI, zero risk
3. **E** (thinking status) — type + hook + UI, no audio changes
4. **C + D together** — server streaming + client queue must ship together; C alone would cause choppy audio without D

## Verification

- **Scenario cache**: Second click on any warm card returns in <200ms. Server logs show `[cache] generating` for cold misses only.
- **Loading messages**: Text cycles "Creo...", "Preparo...", "Scelgo..." during wait.
- **Thinking state**: Releasing PTT immediately shows purple "STA ELABORANDO..." pill.
- **Streaming audio**: First AI words heard ~400ms after PTT release (not 2-3s). Server logs show multiple `[relay] streaming chunk` lines per turn.
- **Audio queue**: No gaps or interruptions between chunks. Chunks play sequentially without cutting each other off.
