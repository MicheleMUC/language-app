# Iteration 3 Plan: L'Italiano — Personal Daily Practice MVP

*Single-user focus. Goal: an app you actually open every day and feel yourself improving.*

---

## The Real Problem

Iterations 1 and 2 built the scaffolding: auth, stats, difficulty levels, onboarding, AI feedback. What's still missing is the **daily habit loop**. Right now the experience is:

> Open app → pick a scenario → talk for 5 min → see turn count + word list → close app

There's no reason to come back tomorrow specifically. No vocabulary you're actively trying to master. No continuity — the AI doesn't know what you practiced yesterday. No sense of improvement over time.

The three changes that fix this:

1. **Vocabulary practice mode** — you have a word bank; you can't practice it
2. **Cross-session memory** — each session should build on the last
3. **Session transcript** — you can't learn from what you said if you can't re-read it

---

## Initiative 1 — Vocabulary Flash Cards

**Why first:** You already have `user_vocabulary` populated from real conversations. Flash cards are a 5-minute daily habit that doesn't require starting a full conversation. This makes the app useful even on low-energy days.

### Flow
Home screen or vocabulary screen → tap "Ripassa" → full-screen flash card mode:

1. Show Italian word (large, centered)
2. User thinks of the meaning
3. Tap card → flip → reveal English + example sentence
4. Two buttons: **"Lo so ✓"** (green) / **"Non ricordo ✗"** (red)
5. After all due words: summary card showing how many you knew

### What to build

**DB change:** Add `mastery_score INT DEFAULT 0` and `next_review_at TIMESTAMPTZ` columns to `user_vocabulary`.
- "Lo so" → `mastery_score += 1`, `next_review_at = now() + interval based on score` (1d → 3d → 7d → 14d → 30d)
- "Non ricordo" → `mastery_score = max(0, score - 1)`, `next_review_at = now() + 1 hour`

**New screen:** `app/(tabs)/vocabulary.tsx` gets a "Ripassa" button at the top that opens `app/flashcards.tsx` (full-screen modal).

**Query:** Load words where `next_review_at <= now() OR next_review_at IS NULL`, ordered by mastery_score ASC (weakest first), limit 20.

**Badge:** Show count of "due for review" on the vocabulary tab icon. When > 0, this is your daily pull.

**No Gemini needed for core flow** — just show `example` from the stored VocabItem. If `example` is empty, fallback to the Italian word used in a sentence from the last session it appeared in.

### Files
- `supabase/schema.sql` — add columns to `user_vocabulary`
- `lib/supabase.ts` — `loadDueVocab(userId)`, `updateVocabMastery(id, knew: boolean)`
- `app/flashcards.tsx` — new screen
- `app/(tabs)/vocabulary.tsx` — add "Ripassa" button + due count badge
- `components/FloatingNav.tsx` — show due count badge on vocab tab

---

## Initiative 2 — Cross-Session Memory

**Why:** Every conversation starts from scratch. The AI character doesn't know you've been struggling with "stavo per + infinito" or that last week you successfully ordered coffee at A2. This is why the app feels like a toy rather than a tutor.

### What to inject into scenario generation

When `POST /scenario` is called, include:
- Last 3 feedback tips (from `sessions.feedback` — see Initiative 3 below)
- Last 20 vocabulary words the user has seen (from `user_vocabulary`)
- Current mastery distribution (how many words at each mastery level)

The scenario system prompt addition:
```
The learner has recently encountered these Italian words (reinforce them naturally):
${recentVocab.slice(0, 10).map(w => w.italian).join(", ")}

Their coach's recent tip was: "${lastFeedbackTip}"

Weave the vocabulary in naturally. If the tip mentions a grammar point, create a situation where that pattern comes up.
```

### What to store (prerequisite)

Currently `feedback` (praise + tip) is generated at session end but **not saved to the database**. It's displayed once and lost.

**DB change:** Add `feedback_praise TEXT, feedback_tip TEXT` columns to `sessions` table.

After `requestFeedback()` resolves in `handleEnd`, also call `updateSessionFeedback(sessionId, feedback)`.

### Files
- `supabase/schema.sql` — add `feedback_praise`, `feedback_tip` to `sessions`
- `lib/supabase.ts` — `updateSessionFeedback(id, praise, tip)`, `loadRecentFeedback(userId, limit=3)`
- `lib/api.ts` — pass `recentVocab` and `lastTip` in `generateScenario` body
- `server/src/scenario.ts` — accept and inject into system prompt

---

## Initiative 3 — Session Transcript

**Why:** You can't learn from what you said if you can't re-read it. Right now the session review shows turn count + vocabulary. The actual conversation — what you said, how the AI responded, what corrections were implicit — is invisible.

### What to build

In the session review screen (already shown after conversation ends), add a scrollable transcript section **below the vocabulary list**:

```
┌─────────────────────────────────────────┐
│ TRASCRIZIONE                            │
│                                         │
│  Marco    Ciao! Cosa posso fare...      │
│  Tu       Vorrei una tavola per due...  │
│  Marco    Certo! Per stasera o...       │
│  Tu       Per stasera, alle otto.       │
└─────────────────────────────────────────┘
```

- Assistant turns: character name in purple, italic text
- User turns: "Tu" in orange, normal text
- Tap any user turn → show the English translation inline (already stored in `ConversationTurn.english` if populated — check if this is being recorded)

The transcript is already in `turns[]` state when the session ends. It just needs to be rendered.

**Also in history:** When tapping a past session in history, currently it goes to a review screen. Make sure the transcript is included there too. Sessions store `turns` as JSONB — it's available, just not rendered.

### Files
- `app/conversation/[id].tsx` — add `TranscriptSection` component to `SessionReview`
- `app/session/[id].tsx` (if it exists) — same transcript component for historical sessions
- `components/TranscriptSection.tsx` — new reusable component

---

## What NOT to build this iteration

- Social features, leaderboards — irrelevant for single user
- Push notifications — habit isn't formed yet; notifications on a weak habit just annoy
- Pronunciation scoring — requires significant infra work for marginal gain right now
- Settings screen — nothing to configure yet
- Rate limiting / RLS — still single user, risk is zero

---

## Sequencing

**Day 1:**
1. Add `mastery_score` + `next_review_at` columns to `user_vocabulary` (Supabase dashboard)
2. Add `feedback_praise` + `feedback_tip` to `sessions` (Supabase dashboard)
3. Build flash card screen (`app/flashcards.tsx`) — static version, no Gemini
4. Wire "Ripassa" button in vocabulary screen
5. Add due-count badge to vocab tab in FloatingNav

**Day 2:**
6. Save feedback to sessions table after generation (`updateSessionFeedback`)
7. Load recent feedback + vocab in `generateScenario` call
8. Inject into scenario system prompt on backend
9. Build `TranscriptSection` component
10. Add transcript to session review + history detail screen

---

## Critical Files

**Modify:**
- `supabase/schema.sql` — add columns
- `lib/supabase.ts` — `loadDueVocab`, `updateVocabMastery`, `updateSessionFeedback`, `loadRecentFeedback`
- `lib/api.ts` — pass memory context to `generateScenario`
- `server/src/scenario.ts` — inject memory into system prompt
- `app/conversation/[id].tsx` — save feedback to DB after generation; add TranscriptSection to review
- `app/(tabs)/vocabulary.tsx` — "Ripassa" button + due count
- `components/FloatingNav.tsx` — vocab tab badge

**Create:**
- `app/flashcards.tsx` — flash card modal screen
- `components/TranscriptSection.tsx` — reusable transcript renderer

---

## How You'll Know It's Working

- You open the app to review vocab even on days you don't do a full conversation
- After a week, the AI character in a new scenario uses words you've been struggling with
- You read back through a session transcript and spot a pattern in your mistakes
- The "due for review" badge is a satisfying thing to clear in the morning
