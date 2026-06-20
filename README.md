# Tempo Language

tempolanguage.com

# Tempo Spanish on IOS

https://apps.apple.com/us/app/tempo-spanish/id6763132237

A React Native (Expo) mobile app for learning Spanish through shadowing YouTube videos. Users watch native Spanish content, listen to segments, record themselves repeating what they heard, and receive accuracy feedback.

## System Architecture

### Mobile App (this repo)

- **Framework:** React Native with Expo (iOS, Android)
- **State Management:** Redux
- **Auth:** Clerk (JWT-based, RS256)
- **Database Client:** Supabase JS client, authenticated via Clerk tokens (`supabase` template)
- **Navigation:** React Navigation

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
