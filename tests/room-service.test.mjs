import test from "node:test";
import assert from "node:assert/strict";
import { RoomService } from "../apps/backend/room-service.mjs";

test("creates a private room and authenticates the room host", () => {
  const service = new RoomService();
  const created = service.createRoom({ username: "Optimist", characterId: "optimist" });

  assert.match(created.room.id, /^[A-HJ-NP-Z2-9]{6}$/);
  assert.equal(created.room.status, "waiting");
  assert.equal(created.room.players.length, 1);
  assert.equal("secret" in created.room.players[0], false);
  assert.equal(created.playerSecret.length > 30, true);
  assert.deepEqual(service.getRoom(created.room.id, created.playerId, created.playerSecret), created.room);
  assert.throws(() => service.getRoom(created.room.id, created.playerId, "wrong-secret"), /authentication failed/);
});

test("host can start a 2–4 player room and only the current player can roll", () => {
  const service = new RoomService();
  const host = service.createRoom({ username: "Optimist", characterId: "optimist" });
  assert.throws(() => service.startRoom(host.room.id, host.playerId, host.playerSecret), /At least two/);

  const guest = service.joinRoom(host.room.id, { username: "Poison", characterId: "poison" });
  const started = service.startRoom(host.room.id, host.playerId, host.playerSecret);
  assert.equal(started.status, "playing");
  assert.equal(started.state.players.length, 2);
  assert.equal(started.state.currentPlayer, host.playerId);
  assert.throws(() => service.roll(host.room.id, guest.playerId, guest.playerSecret), /not your turn/);

  const rolled = service.roll(host.room.id, host.playerId, host.playerSecret);
  assert.ok(rolled.dice >= 1 && rolled.dice <= 6);
  assert.equal(rolled.room.state.revision, 1);
  assert.equal(rolled.room.state.lastAction.dice, rolled.dice);
});

test("only the host starts the game; room rejects a fifth player and joins after start", () => {
  const service = new RoomService();
  const host = service.createRoom({ username: "Host" });
  const guests = [1, 2, 3].map((n) => service.joinRoom(host.room.id, { username: "Guest " + n }));
  assert.throws(() => service.joinRoom(host.room.id, { username: "Fifth" }), /full/);
  assert.throws(() => service.startRoom(host.room.id, guests[0].playerId, guests[0].playerSecret), /Only the room host/);

  service.startRoom(host.room.id, host.playerId, host.playerSecret);
  assert.throws(() => service.joinRoom(host.room.id, { username: "Late" }), /not accepting/);
});

test("server validates moves and returns a committed state to the authenticated player", () => {
  const service = new RoomService();
  const host = service.createRoom({ username: "Host" });
  const guest = service.joinRoom(host.room.id, { username: "Guest" });
  service.startRoom(host.room.id, host.playerId, host.playerSecret);

  let rolled;
  do {
    rolled = service.roll(host.room.id, host.playerId, host.playerSecret);
  } while (rolled.dice !== 6);

  const moved = service.move(host.room.id, host.playerId, host.playerSecret, rolled.legalTokenIds[0]);
  assert.equal(moved.room.state.tokens[rolled.legalTokenIds[0]].stepProgress, 0);
  assert.equal(moved.room.state.revision, 2);
  assert.equal(moved.bonusRoll, true);
  assert.throws(() => service.move(host.room.id, guest.playerId, guest.playerSecret, "missing:0"), /not your turn/);
});

test("room secrets are never returned in room snapshots and expired rooms are rejected", () => {
  let now = 1000;
  const service = new RoomService({ now: () => now });
  const host = service.createRoom({ username: "Host" });
  now += 12 * 60 * 60 * 1000 + 1;
  assert.throws(() => service.getRoom(host.room.id, host.playerId, host.playerSecret), /not found or expired/);
});
