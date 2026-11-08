# PostgreSQL room persistence

## Configure

Set `DATABASE_URL` to a PostgreSQL connection string, for example:

```text
postgresql://ludo_user:YOUR_PASSWORD@HOST:5432/ludo
```

Do not commit real credentials. Configure the variable in the hosting provider's secret/environment settings.

Install dependencies and initialize the schema:

```bash
npm install
npm run db:init
npm run start:api
```

The API automatically creates the `ludo_rooms` table and index on startup when `DATABASE_URL` is present. `npm run db:init` is an optional explicit schema check/setup command.

## Runtime behavior

- With `DATABASE_URL`, room creation, joining, start, dice rolls and moves are written to PostgreSQL.
- The API loads the room from PostgreSQL for each operation. A new backend process can restore rooms using the same database.
- In production, startup refuses to run without `DATABASE_URL`; it will not silently fall back to volatile memory.
- Without `DATABASE_URL` in local development, the in-memory adapter remains available and prints a warning.
- Rooms retain the existing 12-hour expiry policy.

## Current limitations

This is the first persistence slice, not a production multiplayer launch:
- Concurrent simultaneous actions are not yet serialized with row-level transactions/optimistic version checks. Add that before scaling multiple API instances.
- Player secrets are currently part of the JSON room record; restrict database access and use encrypted/hashed credential storage before production.
- No WebSocket fan-out, reconnect protocol, spectators, Telegram initData validation or automated backups yet.
- Configure managed PostgreSQL backups and TLS at the hosting provider. Never expose `DATABASE_URL` to the browser or Mini App.

The database schema is in `apps/backend/postgres-room-store.mjs` and `db/migrations/001_create_ludo_rooms.sql`.
