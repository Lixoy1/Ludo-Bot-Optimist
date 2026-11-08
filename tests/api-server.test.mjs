import WebSocket from "ws";
import test from "node:test";
import assert from "node:assert/strict";
import { createApiServer } from "../apps/backend/api-server.mjs";

async function withServer(run) {
  const server = createApiServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const origin = "http://127.0.0.1:" + server.address().port;
    await run(origin);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

const json = (value, headers = {}) => ({
  method: "POST",
  headers: { "content-type": "application/json", ...headers },
  body: JSON.stringify(value)
});

const auth = (player) => ({
  "x-player-id": player.playerId,
  "x-player-secret": player.playerSecret
});

test("HTTP API creates rooms, joins players, starts a game and rolls on the server", async () => {
  await withServer(async (origin) => {
    const createdResponse = await fetch(origin + "/api/rooms", json({ username: "Optimist", characterId: "optimist" }));
    assert.equal(createdResponse.status, 201);
    const host = await createdResponse.json();

    const joinedResponse = await fetch(origin + "/api/rooms/" + host.room.id + "/join", json({ username: "Poison", characterId: "poison" }));
    assert.equal(joinedResponse.status, 200);
    const guest = await joinedResponse.json();

    const denied = await fetch(origin + "/api/rooms/" + host.room.id + "/start", { method: "POST", headers: auth(guest) });
    assert.equal(denied.status, 409);

    const started = await fetch(origin + "/api/rooms/" + host.room.id + "/start", { method: "POST", headers: auth(host) });
    assert.equal(started.status, 200);
    const startedRoom = await started.json();
    assert.equal(startedRoom.status, "playing");
    assert.equal(startedRoom.state.players.length, 2);

    const wrongTurn = await fetch(origin + "/api/rooms/" + host.room.id + "/roll", { method: "POST", headers: auth(guest) });
    assert.equal(wrongTurn.status, 409);

    const rolled = await fetch(origin + "/api/rooms/" + host.room.id + "/roll", { method: "POST", headers: auth(host) });
    assert.equal(rolled.status, 200);
    const result = await rolled.json();
    assert.ok(result.dice >= 1 && result.dice <= 6);
    assert.equal(result.room.state.lastAction.dice, result.dice);
  });
});

test("HTTP API rejects missing authentication, malformed JSON and unknown endpoints", async () => {
  await withServer(async (origin) => {
    const created = await (await fetch(origin + "/api/rooms", json({ username: "Host" }))).json();
    const unauthorized = await fetch(origin + "/api/rooms/" + created.room.id);
    assert.equal(unauthorized.status, 401);

    const malformed = await fetch(origin + "/api/rooms", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{"
    });
    assert.equal(malformed.status, 400);

    const missing = await fetch(origin + "/api/unknown");
    assert.equal(missing.status, 404);

    const oversized = await fetch(origin + "/api/rooms", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "x".repeat(20000) })
    });
    assert.equal(oversized.status, 413);
  });
});

test("HTTP API validates player moves and does not trust a client-supplied dice value", async () => {
  await withServer(async (origin) => {
    const host = await (await fetch(origin + "/api/rooms", json({ username: "Host" }))).json();
    await fetch(origin + "/api/rooms/" + host.room.id + "/join", json({ username: "Guest" }));
    await fetch(origin + "/api/rooms/" + host.room.id + "/start", { method: "POST", headers: auth(host) });

    const invalid = await fetch(origin + "/api/rooms/" + host.room.id + "/move", json({ tokenId: "missing:0", dice: 6 }, auth(host)));
    assert.equal(invalid.status, 409);
  });
});

test("authenticated WebSocket ticket receives committed room updates", async () => {
  const { RoomService } = await import("../apps/backend/room-service.mjs");
  const service = new RoomService({ rollDie: () => 6 });
  const server = createApiServer({ service });
  const { attachRealtime } = await import("../apps/backend/realtime.mjs");
  const realtime = attachRealtime(server, service);
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    const origin = "http://127.0.0.1:" + server.address().port;
    const host = await (await fetch(origin + "/api/rooms", json({ username: "Host" }))).json();
    await fetch(origin + "/api/rooms/" + host.room.id + "/join", json({ username: "Guest" }));
    await fetch(origin + "/api/rooms/" + host.room.id + "/start", { method: "POST", headers: auth(host) });
    const ticketResponse = await fetch(origin + "/api/rooms/" + host.room.id + "/ticket", { method: "POST", headers: auth(host) });
    assert.equal(ticketResponse.status, 200);
    const { ticket, expiresInSeconds } = await ticketResponse.json();
    assert.equal(expiresInSeconds, 30);
    const ws = new WebSocket("ws://127.0.0.1:" + server.address().port + "/api/rooms/" + host.room.id + "/events?ticket=" + encodeURIComponent(ticket));
    try {
      await new Promise((resolve, reject) => { ws.once("open", resolve); ws.once("error", reject); });
      const connected = await new Promise(resolve => ws.once("message", data => resolve(JSON.parse(data.toString()))));
      assert.equal(connected.type, "connected");
      const updatePromise = new Promise(resolve => ws.once("message", data => resolve(JSON.parse(data.toString()))));
      const roll = await fetch(origin + "/api/rooms/" + host.room.id + "/roll", { method: "POST", headers: auth(host) });
      assert.equal(roll.status, 200);
      const update = await updatePromise;
      assert.equal(update.type, "room:update");
      assert.equal(update.room.state.revision, 1);
    } finally { ws.close(); }
  } finally {
    realtime.close();
    await new Promise(resolve => server.close(resolve));
  }
});
