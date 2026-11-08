# Realtime transport and concurrent writes

## Concurrent update protection

Each room has a monotonically increasing storage version. PostgreSQL writes use compare-and-swap:

`UPDATE ... WHERE room_code = ? AND version = expected_version`

If another request committed first, the stale request receives HTTP 409 with a refresh/retry message. The in-memory adapter implements the same contract for tests. This prevents two simultaneous actions from silently overwriting each other. It is optimistic concurrency control; the client must refresh the room snapshot after a 409.

## WebSocket room updates

1. Authenticate with the normal player headers to request a one-time ticket:

`POST /api/rooms/:code/ticket`

2. Connect to:

`ws(s)://HOST/api/rooms/:code/events?ticket=ONE_TIME_TICKET`

Tickets are random, single-use and expire after 30 seconds. Do not store them or reuse them. The WebSocket is receive-only; game actions still go through authenticated HTTP endpoints, so the server remains authoritative.

After a successful room mutation, connected clients receive:

```json
{ "type": "room:update", "room": { "...": "public room snapshot" } }
```

The initial connection receives a `connected` event. The API does not send player secrets in room snapshots.

## Current scope and remaining hardening

- WebSocket events are in-process broadcasts. For multiple backend instances, add Redis Pub/Sub or PostgreSQL LISTEN/NOTIFY.
- Ticket records are held in process memory and are invalidated on restart.
- WebSocket reconnect/backoff and client-side snapshot resync still need frontend integration.
- Rate limits, origin allow-list, heartbeat/ping timeout, connection caps and production observability must be added before public launch.
- On HTTP 409, the client should fetch the latest authenticated room snapshot and let the player retry only if it is still their turn.
