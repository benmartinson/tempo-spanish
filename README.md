# Tempo

A React Native (Expo) mobile app for learning Spanish through shadowing YouTube videos. Users watch native Spanish content, listen to segments, record themselves repeating what they heard, and receive accuracy feedback.

## System Architecture

### Mobile App (this repo)

- **Framework:** React Native with Expo (iOS, Android)
- **State Management:** Redux
- **Auth:** Clerk (JWT-based, RS256)
- **Database Client:** Supabase JS client, authenticated via Clerk tokens (`supabase` template)
- **Navigation:** React Navigation

### YouTube Embed Relay (`../yt-relay` — Vercel)

A single-page HTML app hosted on **Vercel** at `https://yt-relay.vercel.app`. The mobile app loads this page inside a WebView to play YouTube videos, since the YouTube IFrame API doesn't work natively in React Native.

**How it works:**

1. The app constructs a URL with query parameters: `?v=VIDEO_ID&start=0&end=45.2&autoplay=1&muted=0&speed=1`
2. The relay page loads the YouTube IFrame API and creates a player with those parameters
3. The relay enforces clip boundaries — it polls the current time every 100ms and pauses when `currentTime >= end`
4. The relay communicates with the React Native app via `window.ReactNativeWebView.postMessage()`, sending time updates (`YT_TIME`), ready events (`YT_READY`), and error events (`YT_ERROR`)
5. The app sends commands back via WebView's `injectJavaScript` / `postMessage`: `SEEK_AND_PLAY:time`, `SET_CLIP:{start,end}`, `SET_SPEED:rate`, `MUTE`, `UNMUTE`, `DISABLE_CLIP`

This relay architecture allows full control over YouTube playback (seeking, speed, clip enforcement) without relying on any third-party React Native YouTube package.

### Backend API (`src/api/` — AWS App Runner)

A **FastAPI** server hosted on **AWS App Runner** at `https://aqgubuisev.us-west-2.awsapprunner.com`. Handles AI-powered features that require server-side API keys.

**Endpoints:**

| Endpoint                        | Auth          | Description                                                                                |
| ------------------------------- | ------------- | ------------------------------------------------------------------------------------------ |
| `POST /api/transcribe`          | JWT + credits | Sends recorded audio to **Soniox** for Spanish speech-to-text (deducts 1 credit)           |
| `POST /fetch-vocab-translation` | JWT           | Uses **OpenAI** (gpt-4.1-mini) to translate a Spanish word in context + alternate meanings |
| `POST /translation-insights`    | JWT           | Extracts proper nouns and translates a full sentence via **OpenAI**                        |
| `POST /tts`                     | JWT           | Generates speech audio via **ElevenLabs**                                                  |

**Auth flow:** Every request includes a Clerk JWT (RS256, `backend` template). The server verifies it via Clerk's JWKS endpoint. Only `/api/transcribe` checks and deducts credits.

### Supabase (Database)

PostgreSQL database accessed directly from the mobile app (via Supabase client + Clerk JWT with `supabase` template) and from the backend (via service role key).

**Key tables:**

- `user_ui_state` — persisted UI settings (shadow tab, difficulty, auto-select preferences)
- `user_credits` — credit balance per user
- `user_shadow_result` — recorded shadowing results (spoken words, per video/sentence)
- `user_video_views` — tracks which videos a user has watched
- `video_view_focus_vocab` — per-video vocab translations and review counts
- `sentence_insights` — cached translations and proper nouns per sentence

### Clerk (Authentication)

Manages user sign-up/sign-in. Issues JWTs with two templates:

- **`supabase`** — used by the mobile app's Supabase client (RLS policies)
- **`backend`** — used for API calls to the FastAPI server

## Development

```bash
# Install dependencies
npm install

# Start Expo dev server
npx expo start

# Run the backend locally
cd src/api
pip install -r requirements.txt
uvicorn chat_stream:app --host 0.0.0.0 --port 8000 --reload
```

The app uses `devBaseUrl` (`http://192.168.1.124:8000`) in development and `productionBaseUrl` (App Runner) in production, configured in `app.config.js`.

### All Accounts and costs

1. OpenAI API ($0.001/request) - for word translations and segment insights
2. Supabase (pro plan) ($25/month) - storage and tables
3. Vercel (hobby plan) - yt-relay and Next site, will this scale correctly on free plan? tempo-spanish.com domain
4. Clerk (free plan for now) ($30/month) - up until 50k users? Need to switch to prod deployed
5. Google translate - for full segment translation
6. Google oauth - need to switch to prod?
7. Aws AppRunner - backend api - will start costing more with more users
8. Aws ECR - hosts the code for batch
9. Aws Batch - Runs transcript processing - $0.05 per video
10. Apple developer account - $100 per year
11. Apple store connect - iap, and pushing to store
12. Email service?
13. Sonoix transcription ($0.10/hour)
