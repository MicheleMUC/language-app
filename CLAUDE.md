# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Frontend (Expo / React Native)
```bash
npm start          # Start Expo dev server (opens QR code + web UI)
npm run ios        # Run on iOS simulator
npm run android    # Run on Android emulator
```

### Backend (Express server)
```bash
cd server
npm run dev        # Start with ts-node (development, no build step)
npm run build      # Compile TypeScript → dist/
npm start          # Run compiled build (production)
```

Both must run simultaneously during development. The frontend auto-discovers the backend via the Metro bundler's LAN IP — no manual URL configuration needed in dev.

Or start both with one command from the root:
```bash
npm run dev    # concurrently starts Expo + backend (color-coded output)
```

Verify the backend is up: `curl http://localhost:3001/health` → `{"ok":true}`

### Environment variables
- **Frontend** (`.env.local`): `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, optionally `EXPO_PUBLIC_SERVER_URL` / `EXPO_PUBLIC_WS_URL` (override the LAN auto-detect)
- **Backend** (`server/.env`): `GEMINI_API_KEY` (direct) or `GOOGLE_CLOUD_PROJECT` (Vertex AI). Both are checked; API key takes priority.

There are no test commands — the project has no test suite beyond `server/test/multiturn.ts` (a manual integration script).

## Architecture

### Two-process setup
The app is split into a React Native frontend (Expo) and a Node.js backend (Express + WebSocket). They must run concurrently. The frontend never calls Gemini directly — all AI goes through the backend.

### REST Endpoints

| Endpoint | Method | Request Body | Response |
|----------|--------|--------------|----------|
| `/health` | GET | — | `{ok: true}` |
| `/scenario` | POST | `{intent: string, force?: boolean}` | Scenario JSON |
| `/sidekick` | POST | `{history: Turn[], question: string}` | `{answer: string}` |
| `/feedback/turn` | POST | `{turn: string, level: string, feedbackLayers: FeedbackLayers}` | TurnFeedback |
| `/feedback` | POST | `{transcript: Turn[], level: string}` | `{feedback: string}` |
| `/ws` | WebSocket | `WsClientMessage` protocol (see `types/index.ts`) | Audio + transcript stream |

### LAN IP auto-detection
`lib/api.ts` and `lib/websocket.ts` derive the backend host from `Constants.expoConfig?.hostUri`, which Expo Metro injects at build time. This means when running on a physical device, HTTP and WebSocket calls automatically target the dev machine's LAN IP at port 3001. Override with `EXPO_PUBLIC_SERVER_URL` / `EXPO_PUBLIC_WS_URL` for production.

### Conversation flow (real-time voice)
1. User taps a scenario → frontend calls `POST /scenario` → backend calls Gemini 2.5 Flash → returns scenario JSON (character, setting, difficulty, vocabulary)
2. User starts conversation → `useConversation` hook opens a WebSocket to `/ws` via `ConversationSocket`
3. Backend (`gemini-relay.ts`) opens a **Gemini 3.1 Flash Live** session per WebSocket connection
4. Push-to-talk: client sends `talk_start` / raw audio chunks / `talk_end` → backend relays to Gemini Live → streams back PCM audio + transcripts
5. PCM chunks are collected in a 400ms buffer, wrapped in a WAV header by `makePcmWav()`, then forwarded to the client
6. Client plays chunks sequentially via an audio queue in `useConversation` using `expo-audio`

### Gemini Live PTT details
VAD is **disabled** (`automaticActivityDetection: { disabled: true }`). Turn completion is explicit: on `talk_end`, the server sends `activityEnd` followed immediately by `sendClientContent({ turnComplete: true })`. This is the trigger that fires Gemini's response.

### Auth + database (Supabase)
- Auth: `lib/auth.tsx` provides `AuthProvider` / `useAuth()`. Session is persisted via `AsyncStorage`. The auth guard in `app/_layout.tsx` redirects unauthenticated users to `/(auth)/login`.
- All DB calls go through `lib/supabase.ts`. The client is `null` when env vars are missing — every function guards with `if (!supabase) return ...`.
- Three tables: `scenarios`, `sessions`, `user_vocabulary`. Schema is in `supabase/schema.sql`. Row Level Security policies are defined there (commented out) and must be applied manually via the Supabase dashboard.
- `user_vocabulary` uses `UNIQUE (user_id, italian)` — upserts with `ignoreDuplicates: true` are the deduplication mechanism.

### Sidekick (AI tutor)
During a conversation the user can tap "Aiuto" to open a Sidekick panel (`components/Sidekick.tsx`, `hooks/useSidekick.ts`). It sends the last 10 conversation turns + the question to `POST /sidekick`, which calls Gemini 2.5 Flash and returns a ≤150-word English explanation.

### Scenario caching
`server/src/scenario.ts` holds an in-memory `Map<string, object>` keyed by intent string. On server start it pre-warms the cache for 12 known intents (the same ones shown in the Scenarios tab). Cache is process-local and lost on restart.

### Navigation
Expo Router file-based routing. Tab group `app/(tabs)/` has four tabs (index, history, vocabulary, scenarios) plus a `profile` screen. Auth screens live in `app/(auth)/`. Conversation and session detail are stack screens. The custom `FloatingNav` pill replaces the native tab bar (`tabBarStyle: { display: "none" }`).

### Styling
NativeWind (Tailwind for React Native) plus `StyleSheet.create`. Design tokens: background `#131313`, primary orange `#ff6d33`, purple `#53397c`, yellow `#dcc841`, muted text `#e1bfb4`.

## gstack

Use the `/browse` skill from gstack for all web browsing. Never use `mcp__claude-in-chrome__*` tools directly.

Available gstack skills:
`/office-hours`, `/plan-ceo-review`, `/plan-eng-review`, `/plan-design-review`, `/design-consultation`, `/design-shotgun`, `/design-html`, `/review`, `/ship`, `/land-and-deploy`, `/canary`, `/benchmark`, `/browse`, `/connect-chrome`, `/qa`, `/qa-only`, `/design-review`, `/setup-browser-cookies`, `/setup-deploy`, `/setup-gbrain`, `/retro`, `/investigate`, `/document-release`, `/document-generate`, `/codex`, `/cso`, `/autoplan`, `/plan-devex-review`, `/devex-review`, `/careful`, `/freeze`, `/guard`, `/unfreeze`, `/gstack-upgrade`, `/learn`

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
