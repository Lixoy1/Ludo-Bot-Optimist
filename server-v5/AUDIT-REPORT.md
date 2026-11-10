# Optimist Ludo v5 — audit and fix report

Base: `Optimist_Ludo_Project-v4.zip` only. No source code was imported from older repositories or branches.

## Fixes applied

1. **Game creation contract repaired**
   - `POST /api/game/create` is now supported, matching `static/js/main.js`.
   - The legacy GET method remains supported.
   - The endpoint reads `X-Telegram-Init-Data`.
   - It returns both `code` and `join_url`, matching the client redirect contract.
   - Unknown game modes are rejected with HTTP 400.

2. **Telegram WebApp authentication hardened**
   - Signed `initData` is verified with HMAC-SHA256.
   - Duplicate fields, missing user IDs, invalid signatures, expired timestamps, and timestamps more than 60 seconds in the future are rejected.
   - In production (`APP_ENV=production`), unsigned browser-supplied user IDs are not accepted.
   - Local browser fallback is available only outside production with `ALLOW_DEV_AUTH=true`.
   - Production startup fails if the BotFather token is not configured.

3. **Manual lobby start restored**
   - The client already sends `START_GAME`, but v4's server did not implement it.
   - The host can now start a room with at least two players.
   - Non-hosts receive `GAME_ERROR`.
   - Pending auto-start tasks are cancelled/reset consistently.

4. **Lobby and leave handling improved**
   - Auto-start task references are cleaned up after completion/cancellation.
   - Finishing a game because a player leaves is persisted to SQLite before broadcasting game-over.

5. **WebRTC TURN support restored as an optional configuration**
   - `TURN_URLS` and `TURN_SHARED_SECRET` enable Coturn REST credentials.
   - The server generates one-hour HMAC-SHA1 credentials and sends `VOICE_CONFIG` to the joining player.
   - If TURN is not configured, the client retains its STUN fallback.
   - `VOICE_DIAG` messages are now accepted and logged with bounded field lengths.

6. **Client feedback improved**
   - `GAME_ERROR` and `AUTH_ERROR` are displayed.
   - A WebSocket closed with code 4403 does not enter an endless reconnect loop.
   - Voice comments now describe the agreed free voice chat for all players.

## Checks performed

- ZIP integrity: passed.
- Python syntax compilation: passed.
- `node --check` on all 6 JavaScript files: passed.
- All 46 Lottie JSON files parse and contain animation layers.
- All 12 character WebP files, both board PNGs, and all 6 WAV files are present.
- FastAPI test:
  - POST create room: 200, returns `code` and `join_url`.
  - Legacy GET create room: 200.
  - Invalid game mode: 400.
  - Development profile/preferences endpoints: passed.
  - Production mode rejects unsigned create request: 403.
  - Valid signed Telegram initData: accepted.
  - Expired and future Telegram auth timestamps: rejected.
- WebSocket test with two players:
  - Both players join.
  - Non-host manual start is rejected.
  - Host manual start starts the game for both clients.
  - Leave during a match marks the leaver and persists the finished room state to SQLite.
- Coturn credential generation: HMAC credential verified against the configured shared secret.

## Deployment requirements / limits

- Install `requirements.txt` and use a real BotFather `BOT_TOKEN`.
- Set `APP_ENV=production` and a real HTTPS `WEBAPP_URL`.
- Keep `ALLOW_DEV_AUTH` disabled in production.
- For robust voice across restrictive NATs, configure Coturn and set `TURN_URLS` plus `TURN_SHARED_SECRET`. Without these, only STUN is available and some networks may fail to connect.
- Telegram polling and actual Telegram group interactions were not end-to-end tested here because this audit runtime does not have `aiogram` installed and no real bot token was supplied. The FastAPI/WebSocket application paths were exercised with a lightweight aiogram test stub; install the declared dependency before deployment.
