import test from "node:test";
import assert from "node:assert/strict";
import { RoomService } from "../apps/backend/room-service.mjs";
import { MemoryRoomStore } from "../apps/backend/room-store.mjs";

test("creates a private room and authenticates the room host", async () => {
  const service = new RoomService();
  const created = await service.createRoom({ username: "Optimist", characterId: "optimist" });

  assert.match(created.room.id, /^[A-HJ-NP-Z2-9]{6}$/);
  assert.equal(created.room.status, "waiting");
  assert.equal(created.room.players.length, 1);
  assert.equal("secret" in created.room.players[0], false);
  assert.equal(created.playerSecret.length > 30, true);
  assert.deepEqual(await service.getRoom(created.room.id, created.playerId, created.playerSecret), created.room);
  await assert.rejects(() => service.getRoom(created.room.id, created.playerId, "wrong-secret"), /authentication failed/);
});

test("host can start a 2–4 player room and only the current player can roll", async () => {
  const service = new RoomService();
  const host = await service.createRoom({ username: "Optimist", characterId: "optimist" });
  await assert.rejects(() => service.startRoom(host.room.id, host.playerId, host.playerSecret), /At least two/);

  const guest = await service.joinRoom(host.room.id, { username: "Poison", characterId: "poison" });
  const started = await service.startRoom(host.room.id, host.playerId, host.playerSecret);
  assert.equal(started.status, "playing");
  assert.equal(started.state.players.length, 2);
  assert.equal(started.state.currentPlayer, host.playerId);
  await assert.rejects(() => service.roll(host.room.id, guest.playerId, guest.playerSecret), /not your turn/);

  const rolled = await service.roll(host.room.id, host.playerId, host.playerSecret);
  assert.ok(rolled.dice >= 1 && rolled.dice <= 6);
  assert.equal(rolled.room.state.revision, 1);
  assert.equal(rolled.room.state.lastAction.dice, rolled.dice);
});

test("only the host starts the game; room rejects a fifth player and joins after start", async () => {
  const service = new RoomService();
  const host = await service.createRoom({ username: "Host" });
  const guests = [];
  for (const n of [1, 2, 3]) guests.push(await service.joinRoom(host.room.id, { username: "Guest " + n }));
  await assert.rejects(() => service.joinRoom(host.room.id, { username: "Fifth" }), { message: "Room is full." });
  await assert.rejects(() => service.startRoom(host.room.id, guests[0].playerId, guests[0].playerSecret), { message: "Only the room host can start the game." });

  await service.startRoom(host.room.id, host.playerId, host.playerSecret);
  await assert.rejects(() => service.joinRoom(host.room.id, { username: "Late" }), /not accepting/);
});

test("server validates moves and returns a committed state to the authenticated player", async () => {
  const service = new RoomService({ rollDie: () => 6 });
  const host = await service.createRoom({ username: "Host" });
  const guest = await service.joinRoom(host.room.id, { username: "Guest" });
  await service.startRoom(host.room.id, host.playerId, host.playerSecret);

  const rolled = await service.roll(host.room.id, host.playerId, host.playerSecret);

  const moved = await service.move(host.room.id, host.playerId, host.playerSecret, rolled.legalTokenIds[0]);
  assert.equal(moved.room.state.tokens[rolled.legalTokenIds[0]].stepProgress, 0);
  assert.equal(moved.room.state.revision, 2);
  assert.equal(moved.bonusRoll, true);
  await assert.rejects(() => service.move(host.room.id, guest.playerId, guest.playerSecret, "missing:0"), /not your turn/);
});

test("room secrets are never returned in room snapshots and expired rooms are rejected", async () => {
  let now = 1000;
  const service = new RoomService({ now: () => now });
  const host = await service.createRoom({ username: "Host" });
  now += 12 * 60 * 60 * 1000 + 1;
  await assert.rejects(() => service.getRoom(host.room.id, host.playerId, host.playerSecret), /not found or expired/);
});

test("room survives RoomService recreation when the same persistent store is reused", async () => {
  const store = new MemoryRoomStore();
  const firstProcess = new RoomService({ store });
  const host = await firstProcess.createRoom({ username: "Persistent host" });
  const secondProcess = new RoomService({ store });
  const restored = await secondProcess.getRoom(host.room.id, host.playerId, host.playerSecret);
  assert.equal(restored.players[0].username, "Persistent host");
});
