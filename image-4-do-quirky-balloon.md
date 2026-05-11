# UI Overhaul Plan

## Context
Comprehensive UI cleanup and feature additions for the L'Italiano language app. The user identified six distinct issues from a screenshot of the conversation screen:
1. Stale/orphaned components exist in the codebase
2. There's an extra "Inizia Conversazione" button on the conversation screen itself (double-step flow)
3. User profile avatar sits in the bottom nav; should be a top-left icon button
4. Various layout issues
5. No "see all scenarios" page exists
6. History session cards are tappable but don't open — sessions should be viewable in conversation format

---

## Changes

### 1. Delete orphaned components
**Files to delete:**
- `components/LiveTranscript.tsx` — zero imports anywhere
- `components/IntentForm.tsx` — zero imports anywhere

### 2. Remove the double "Inizia Conversazione" step
**Problem:** `ScenarioCard` has an "Inizia Conversazione ▶" button → navigates to `conversation/[id].tsx` → that screen shows ANOTHER "Inizia Conversazione ▶" button (lines 262–272 in `[id].tsx`) which actually starts the WebSocket. The user has to tap it twice.

**Fix:** Auto-call `handleStart()` via `useEffect` when `conversation/[id].tsx` mounts (status === "idle"). Remove the idle-state start button from the control bar. The screen will immediately start connecting.

**File:** `app/conversation/[id].tsx` lines 142–148 (handleStart) and 262–272 (start button)
- Add `useEffect(() => { handleStart(); }, [])` (run once on mount)
- Replace the `status === "idle" || status === "connecting"` branch in the control bar with just a connecting indicator, then hide it entirely when connecting (show nothing or a "Connessione..." label)

### 3. Move user profile to top-left icon
**Problem:** FloatingNav has a profile button at position 4 (bottom-right area) with `route: null`.

**Fix:**
- Remove the `profile` item from `ITEMS` in `FloatingNav.tsx` (leaving only home, history, saved — or just home + history)
- In all screen headers that show an avatar circle (`index.tsx`, `history.tsx`, `conversation/[id].tsx`), replace the plain `<View style={styles.avatar} />` with a `TouchableOpacity` that navigates to a profile route (to be created later, or for now just show an Alert)
- The avatar is already styled at top-left in all three screens (`header > headerLeft` for index and [id].tsx; first item in header row for history.tsx)

**Files:**
- `components/FloatingNav.tsx`: remove profile entry from ITEMS, update Props type
- `app/(tabs)/index.tsx` line 87: wrap `<View style={styles.avatar}>` → `<TouchableOpacity>` navigating to `/profile`
- `app/(tabs)/history.tsx` line 31: same
- `app/conversation/[id].tsx` line 184: same

### 4. Fix layout issues
From the screenshot:
- The waveform bars pill overlaps the avatar circle. The `waveWrap` is positioned inside `avatarOuter` but not clearly separated. Add `marginTop: 8` or absolute position offset.
- The "conversation" title in the header looks like the Expo default stack header. The conversation screen header should be custom (already is in code). The back-button + "conversation" title in the screenshot suggests the stack header is bleeding through — verify `conversation/_layout.tsx` has `headerShown: false`.

**File:** `app/conversation/_layout.tsx` — ensure `headerShown: false`
**File:** `app/conversation/[id].tsx` styles — `waveWrap` margin/positioning

### 5. Create "See All Scenarios" screen
**New file:** `app/(tabs)/scenarios.tsx`

Content:
- Title: "Tutti gli Scenari"  
- A searchable/filterable list of all available scenarios (seed from `SUGGESTED` + ability to browse by difficulty)
- For now, show the same 3 `SUGGESTED` scenarios from index.tsx plus difficulty filter chips (A1–C2)
- Each card navigates through the same `handleSubmit()` → `ScenarioCard` flow (or directly generates + shows ScenarioCard)
- Tapping generates the scenario (same `generateScenario()` call) and navigates to conversation

**Register in navigation:**
- Add `scenarios` to `app/(tabs)/_layout.tsx`
- Wire the "See All →" `TouchableOpacity` in `index.tsx` (line 138) to `router.push("/(tabs)/scenarios")`
- Add a `scenarios` item to `FloatingNav` or keep it nav-less and just accessible via "See All →"

### 6. Make history session cards open in conversation format
**Problem:** `history.tsx` renders sessions in a `FlatList` but `TouchableOpacity` has no `onPress`.

**New file:** `app/session/[id].tsx` — Session detail screen
- Receives session id via URL param
- Loads the session from Supabase (or receives full session data encoded in URL)
- Renders turns in a chat-bubble format: alternating user (right-aligned, orange) and assistant (left-aligned, dark) bubbles
- Shows Italian text + English translation for each turn
- Header: back button + date + turn count
- Shows vocabulary learned at the bottom

**Wire up:**
- In `history.tsx` line 62, add `onPress={() => router.push(`/session/${item.id}?sessionData=${encodeURIComponent(JSON.stringify(item))}`)}` to the `TouchableOpacity`
- Register `app/session/[id].tsx` in router (Expo Router auto-discovers it)
- May need `app/session/_layout.tsx` for slide-up animation similar to conversation

---

## Files to Create
- `app/(tabs)/scenarios.tsx` — new Scenarios browse screen
- `app/session/_layout.tsx` — session detail stack layout  
- `app/session/[id].tsx` — session detail view (chat format)

## Files to Modify
- `app/conversation/[id].tsx` — auto-start on mount, remove double button
- `app/conversation/_layout.tsx` — verify headerShown: false
- `app/(tabs)/index.tsx` — wire "See All →", profile avatar touchable
- `app/(tabs)/history.tsx` — add onPress to session cards, profile avatar touchable
- `components/FloatingNav.tsx` — remove profile item

## Files to Delete
- `components/LiveTranscript.tsx`
- `components/IntentForm.tsx`

---

## Verification
1. **Orphaned components**: Confirm `LiveTranscript.tsx` and `IntentForm.tsx` are gone; no TypeScript errors.
2. **Single-tap flow**: Tap a suggested scenario → ScenarioCard appears → tap "Inizia Conversazione" → conversation screen opens and immediately shows "Connessione..." without a second button.
3. **Profile icon**: Top-left circle in all screens is tappable.
4. **Layout**: Conversation screen no longer shows a native "conversation" header bar; waveform pill is properly spaced below avatar.
5. **See All**: Tap "See All →" on home → opens scenarios list screen.
6. **Session detail**: Tap a card in Storico → opens chat-bubble view of that conversation.
