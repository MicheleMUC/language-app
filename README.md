# L'Italiano

A real-time Italian conversation practice app. Speak with AI characters in curated scenarios using push-to-talk voice.

## Prerequisites

- Node 20+
- Expo Go on your iOS/Android device (or iOS Simulator)
- Supabase project → copy keys into `.env.local`
- Gemini API key → copy into `server/.env`

## Setup

```bash
cp .env.example .env.local       # fill in EXPO_PUBLIC_SUPABASE_URL + ANON_KEY
cp server/.env.example server/.env  # fill in GEMINI_API_KEY
npm install                      # installs frontend + backend deps
```

## Start

```bash
npm run dev      # starts Expo + backend concurrently
```

Scan the QR code in Expo Go. The app auto-connects to the backend over LAN.

Verify the backend is up: `curl http://localhost:3001/health` → `{"ok":true}`

## Architecture & full docs

See [CLAUDE.md](./CLAUDE.md).
