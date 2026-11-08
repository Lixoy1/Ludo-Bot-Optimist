# Backend API — room and turn authority

The first backend slice introduces authenticated Classic rooms and server-owned dice/move validation. It is deliberately transport- and storage-light so the same service can later be connected to Telegram WebApp, WebSockets and durable storage.

## Run locally

Node.js 22+:

```bash
npm run start:api
```

The API listens on `http://localhost:4174` by default. Set `API_PORT` and `API_HOST` to override.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/rooms` | Create a room and host credential |
| POST | `/api/rooms/:code/join` | Join a waiting room |
| POST | `/api/rooms/:code/start` | Host starts a 2–4 player game |
| GET | `/api/rooms/:code` | Read an authenticated room snapshot |
| POST | `/api/rooms/:code/roll` | Server generates the die and commits the roll |
| POST | `/api/rooms/:code/move` | Server validates and commits a token move |

### Create

Request:

```json
{ "username": "Optimist", "characterId": "optimist" }
```

Response includes `room`, `playerId`, and `playerSecret`. The secret is returned only at create/join time; it is never included in public room snapshots.

### Join

Request:

```json
{ "username": "Poison", "characterId": "poison" }
```

A successful join returns the same credential shape. Colors are assigned in the fixed Classic order: yellow, blue, red, green.

### Authenticated requests

Supply these headers:

- `x-player-id`
- `x-player-secret`

Example move body:

```json
{ "tokenId": "PLAYER_ID:0" }
```

The client cannot submit a die value or choose a destination. The server generates dice using Node's cryptographic random integer generator and delegates all legal-move and capture decisions to `src/engine/classic-engine.mjs`.

## Current limitations — intentionally not hidden

- Room state is currently held in process memory. Restarting the backend loses rooms. Durable persistence is the next backend step.
- This first API is request/response HTTP; live WebSocket room broadcasts and reconnect/resume are not implemented yet.
- Player secrets are temporary credentials for this prototype. Telegram WebApp initData verification, signed sessions, rate limiting and production abuse controls must be added before public deployment.
- Room join is currently by six-character room code. Spectator access is not implemented yet.
- The browser demo still runs its local game state; connecting its controls to this API is a separate frontend integration task.

## Security and validation

- Cryptographically generated room codes, player IDs and player secrets.
- Constant-time comparison for player secrets.
- Server-generated dice; no client-provided dice parameter is accepted.
- The engine remains authoritative for turns, legal moves, blockades, captures and winning.
- JSON request bodies are capped at 16 KiB.
- Room snapshots omit player secrets.
- Rooms expire after 12 hours in this prototype.

The API tests exercise room creation/join, host-only start, turn authorization, server-side dice, malformed/oversized requests, and invalid moves.
