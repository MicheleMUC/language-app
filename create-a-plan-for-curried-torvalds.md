# Conversation Flow — Significant Improvement Plan

## Context

Several compounding problems degrade conversation quality:
1. **Android audio is garbage**: Android records AAC-in-MP4, but the server labels it `audio/pcm;rate=16000` — Gemini decodes random bytes and hallucinates responses. iOS works because it records true Linear PCM.
2. **System prompt is too thin**: No pedagogical direction, no vocabulary context, no misunderstanding handling, no instruction to stay grounded to what the user just said.
3. **User transcript is invisible**: Gemini transcribes user speech (inputTranscription) and we relay it to the client, but the UI never shows it — the user can't see what the model actually heard.
4. **Model text appears only at end of turn**: outputTranscription events arrive incrementally but we buffer them and send one blob on turnComplete — wastes 0.5–2s of perceived latency.
5. **Session review shows no real vocab**: `newVocabulary: []` is hardcoded; the review screen shows random turn lines instead of actual vocabulary learned.

---

## Changes

### 1 — Android audio format fix
**Files**: `hooks/useAudioCapture.ts`, `types/index.ts`, `server/src/gemini-relay.ts`

**Problem**: Android `outputFormat: "mpeg4"` produces an MP4 container. We skip 44 bytes (thinking it's a WAV header) and send the rest labeled as `audio/pcm;rate=16000`. Gemini receives corrupted data.

**Fix**:
- Change Android recording to `outputFormat: "aac_adts"` + `audioEncoder: "aac"` — this produces a raw AAC-ADTS bytestream (no container, no header to skip).
- Add `mimeType?: string` to the `audio` WsClientMessage — client declares what it's sending.
- In `useAudioCapture`, detect platform (`Platform.OS`) and set `mimeType`:
  - iOS: `audio/pcm;rate=16000` (raw PCM, skip WAV header as now)
  - Android: `audio/aac` (AAC-ADTS, skip 0 bytes — no header)
  - Web: `audio/wav`
- In `useConversation.ts` `sendAudio`, include the mimeType from the hook.
- In `server/src/gemini-relay.ts` `case "audio"`: use `msg.mimeType ?? "audio/pcm;rate=16000"` instead of hardcoded string.
- In `useAudioCapture.ts`: on Android, `WAV_HEADER_BYTES` → 0 (AAC-ADTS starts at byte 0).

### 2 — System prompt overhaul
**File**: `server/src/gemini-relay.ts`

Replace the 5-line prompt with a full pedagogical system instruction built from the scenario object:

```
You are [name]. [characterDescription]
You are speaking with an Italian language learner in the following setting: [setting]

CONVERSATION RULES:
- Speak ONLY in Italian. Never use English, even to explain.
- Keep every response SHORT: 1–2 sentences maximum. This is a spoken conversation.
- Respond DIRECTLY to what the learner just said before adding anything new.
- If you cannot understand the learner, say: "Scusa, non ho capito. Puoi ripetere più lentamente?"
- If the learner makes a grammar error, acknowledge their meaning then naturally model the correct form in your reply (do NOT say "you made an error").
- If the learner speaks English, redirect warmly: "Proviamo in italiano! Come si dice...?"
- Adapt complexity to a [difficulty] (CEFR) learner: [A1/A2 → very simple present tense | B1/B2 → past/future | C1/C2 → idiomatic].

SCENARIO VOCABULARY — weave these in naturally when relevant:
[vocabulary.map(v => `- ${v.italian} (${v.english}): ${v.example}`).join('\n')]

PHRASES you might naturally use:
[likelyPhrases.join(', ')]

Begin by greeting the learner warmly and setting the scene in 1 sentence.
```

### 3 — Streaming model transcript
**Files**: `server/src/gemini-relay.ts`, `types/index.ts`, `hooks/useConversation.ts`, `app/conversation/[id].tsx`

**Problem**: outputTranscription events arrive word-by-word but we buffer everything until `turnComplete` then send one blob.

**Fix**:
- Add `{ type: "transcript_partial"; role: "assistant"; italian: string }` to `WsServerMessage`.
- In `handleLiveMessage`: on each `outputTranscription` event, send a `transcript_partial` immediately (in addition to buffering for the final flush).
- In `useConversation.ts`: maintain a `partialTranscript` state string. On `transcript_partial`, append to it; on `transcript` (final), clear it and add the complete turn.
- In `app/conversation/[id].tsx`: show `partialTranscript` in the speech bubble while the model is speaking, replacing the previous AI turn. This gives word-by-word display during playback.

### 4 — Show user transcript ("what I heard")
**Files**: `app/conversation/[id].tsx`, `hooks/useConversation.ts`

**Problem**: Gemini transcribes user speech via `inputTranscription` and we already relay it as `{ type: "transcript", role: "user" }` — but the conversation UI only shows the last *assistant* turn. The user never sees what Gemini actually heard.

**Fix**:
- In `useConversation.ts`: expose `lastUserTranscript` (the most recent `role: "user"` turn's `.italian` string).
- In `app/conversation/[id].tsx`: below the mic button (while status is `active` and not `talking`), show a small pill: `"Ho sentito: «[lastUserTranscript]»"` in muted text. This lets the learner verify what was understood. Fade it out after 6 seconds.

### 5 — Real vocabulary in session review
**Files**: `app/conversation/[id].tsx`, `lib/supabase.ts`

**Problem**: `saveSession` always passes `newVocabulary: []`. The review screen shows random turn lines and a hardcoded "85%" fluency score.

**Fix**:
- Before calling `saveSession` in `handleEnd`, cross-reference the assistant's turn transcripts against `scenario.vocabulary`: any vocab item whose Italian word appears (case-insensitive, substring) in any assistant turn is "encountered".
- Cross-reference user turns to find which items the user also used.
- Pass the encountered items as `newVocabulary`.
- In the session review `SessionReview` component:
  - Replace the hardcoded `turns.length` stat with actual `newVocabulary.length`.
  - Replace the `turns.slice(0,3)` list with `newVocabulary` items (italian + english).
  - Remove the hardcoded "85%" fluency score (it's meaningless); replace with turn count.

---

## Files to Modify

| File | Change |
|---|---|
| `hooks/useAudioCapture.ts` | Android → `aac_adts`, platform-aware mimeType, skip 0 bytes on Android |
| `types/index.ts` | `audio` message adds `mimeType?`, new `transcript_partial` server message |
| `hooks/useConversation.ts` | Forward mimeType on sendAudio, handle `transcript_partial`, expose `lastUserTranscript` |
| `server/src/gemini-relay.ts` | Use msg.mimeType, full system prompt, stream outputTranscription |
| `app/conversation/[id].tsx` | Show `partialTranscript` in bubble, show "Ho sentito:" pill, real vocab in review |
| `lib/supabase.ts` | No changes needed |

---

## Verification

1. **Android audio**: open browser devtools on server, confirm `mimeType` in logged audio messages is `audio/aac` on Android vs `audio/pcm;rate=16000` on iOS. Ask the AI a direct question and verify the response addresses it.
2. **System prompt**: start a market scenario, verify model uses vocabulary words naturally and asks for repetition on an unclear utterance.
3. **Streaming transcript**: model speech bubble should update word-by-word during playback, not appear all at once after audio ends.
4. **"Ho sentito" pill**: after releasing PTT, a pill should appear showing the transcribed text for ~6 seconds.
5. **Session review vocab**: end a conversation where the model used 2–3 vocabulary words; review screen should list those specific words.
