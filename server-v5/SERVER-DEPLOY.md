# OPTIMIST LUDO — server deployment

This deployment package is based **only** on Optimist_Ludo_Project-v5_FIXED.zip.
It keeps the FastAPI + aiogram + WebSocket + SQLite implementation. No Node.js backend is used.

## Railway (recommended)

1. Commit the **contents of this package** to a dedicated branch or repository, not over an unrelated existing Node application.
2. Create a Railway service from that GitHub branch. The included `railway.json` selects the Dockerfile and `/healthz` check.
3. Add a persistent volume mounted at `/data` (mandatory for SQLite persistence). Keep **one replica** and **one worker**; in-memory rooms and Telegram polling are not safe across replicas.
4. Set `BOT_TOKEN`, `WEBAPP_URL` (the real public HTTPS domain), `APP_ENV=production`, `ALLOW_DEV_AUTH=false`, `DATABASE_PATH=/data/ludo.db`. Do not paste the token into code or commit it.
5. Generate a Railway domain and set `WEBAPP_URL` to that exact HTTPS origin. Redeploy after setting it.
6. Configure BotFather bot settings and the Mini App link; in groups use HTTPS URL buttons, not private-chat-only WebAppInfo buttons.
7. Check `https://YOUR-DOMAIN/healthz`, then open `/`, `/cabinet` and test a real 2-player game from Telegram.
8. Optional voice reliability: configure coturn `TURN_URLS` and `TURN_SHARED_SECRET`; STUN-only will not work on every mobile network.

## Docker Compose (own VPS)

Copy `.env.example` to `.env`, enter real values, then run `docker compose up -d --build`.
Use a reverse proxy with TLS (HTTPS/WSS) to port 8000. Back up the `ludo-data` Docker volume.

## Known limitations / launch gate

- Automated live Telegram polling and WebRTC calls require a real token, external connectivity and devices; not proven by static checks.
- Current game supports a four-color 52-cell board with two visual themes (`neon` and `royal`). Do not advertise six-player HEXA support.
- Existing rooms are kept in process memory and saved to SQLite; verify reconnects after restart under load before public launch.
- `BOT_TOKEN` is required for production. Keep this deployment at one replica.
