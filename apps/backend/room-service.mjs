import { randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import {
  createClassicState,
  rollClassicDice,
  applyClassicMove
} from "../../src/engine/classic-engine.mjs";
import { getCharacter } from "../../src/characters.mjs";

const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ROOM_CODE_LENGTH = 6;
const MAX_ROOM_AGE_MS = 1000 * 60 * 60 * 12;

function makeRoomCode() {
  return Array.from({ length: ROOM_CODE_LENGTH }, () =>
    ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)]
  ).join("");
}

function makePlayerId() {
  return randomBytes(8).toString("hex");
}

function makePlayerSecret() {
  return randomBytes(32).toString("base64url");
}

function secretMatches(expected, supplied) {
  if (typeof expected !== "string" || typeof supplied !== "string") return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(supplied);
  return a.length === b.length && timingSafeEqual(a, b);
}

function publicRoom(room) {
  return {
    id: room.id,
    status: room.status,
    createdAt: room.createdAt,
    players: room.players.map(({ secret, ...player }) => ({ ...player })),
    state: room.state ? structuredClone(room.state) : null
  };
}

export class RoomService {
  #rooms = new Map();
  #now;

  constructor({ now = () => Date.now() } = {}) {
    this.#now = now;
  }

  createRoom({ username, characterId = "optimist" }) {
    const safeUsername = String(username ?? "").trim().slice(0, 32);
    if (!safeUsername) throw new TypeError("Username is required.");
    getCharacter(characterId);

    let id;
    do id = makeRoomCode();
    while (this.#rooms.has(id));

    const player = {
      id: makePlayerId(),
      username: safeUsername,
      characterId,
      color: "yellow",
      secret: makePlayerSecret()
    };
    const room = {
      id,
      status: "waiting",
      createdAt: this.#now(),
      players: [player],
      state: null
    };
    this.#rooms.set(id, room);
    return { room: publicRoom(room), playerId: player.id, playerSecret: player.secret };
  }

  joinRoom(roomId, { username, characterId = "optimist" }) {
    const room = this.#getRoom(roomId);
    const safeUsername = String(username ?? "").trim().slice(0, 32);
    if (!safeUsername) throw new TypeError("Username is required.");
    getCharacter(characterId);
    if (room.status !== "waiting") throw new Error("Room is not accepting players.");
    if (room.players.length >= 4) throw new Error("Room is full.");

    const colors = ["yellow", "blue", "red", "green"];
    const player = {
      id: makePlayerId(),
      username: safeUsername,
      characterId,
      color: colors[room.players.length],
      secret: makePlayerSecret()
    };
    room.players.push(player);
    return { room: publicRoom(room), playerId: player.id, playerSecret: player.secret };
  }

  startRoom(roomId, playerId, secret) {
    const room = this.#getRoom(roomId);
    this.#authorize(room, playerId, secret);
    if (room.status !== "waiting") throw new Error("Room has already started.");
    if (room.players[0].id !== playerId) throw new Error("Only the room host can start the game.");
    if (room.players.length < 2) throw new Error("At least two players are required.");

    room.state = createClassicState(room.players.map(({ id, username, color, characterId }) => ({
      id, username, color, characterId
    })));
    room.status = "playing";
    return publicRoom(room);
  }

  getRoom(roomId, playerId, secret) {
    const room = this.#getRoom(roomId);
    this.#authorize(room, playerId, secret);
    return publicRoom(room);
  }

  roll(roomId, playerId, secret) {
    const room = this.#playingRoom(roomId);
    this.#authorize(room, playerId, secret);
    if (room.state.currentPlayer !== playerId) throw new Error("It is not your turn.");
    const dice = randomInt(1, 7);
    const result = rollClassicDice(room.state, playerId, dice);
    room.state = result.state;
    return {
      room: publicRoom(room),
      dice,
      legalTokenIds: result.legalTokenIds,
      skipped: result.skipped,
      bonusRoll: result.bonusRoll,
      turnAdvanced: result.turnAdvanced
    };
  }

  move(roomId, playerId, secret, tokenId) {
    const room = this.#playingRoom(roomId);
    this.#authorize(room, playerId, secret);
    if (room.state.currentPlayer !== playerId) throw new Error("It is not your turn.");
    const result = applyClassicMove(room.state, playerId, tokenId);
    room.state = result.state;
    return {
      room: publicRoom(room),
      captured: result.captured,
      bonusRoll: result.bonusRoll,
      turnAdvanced: result.turnAdvanced
    };
  }

  #getRoom(roomId) {
    const id = String(roomId ?? "").toUpperCase();
    const room = this.#rooms.get(id);
    if (!room || this.#now() - room.createdAt > MAX_ROOM_AGE_MS) {
      if (room) this.#rooms.delete(id);
      throw new Error("Room not found or expired.");
    }
    return room;
  }

  #playingRoom(roomId) {
    const room = this.#getRoom(roomId);
    if (room.status !== "playing" || !room.state) throw new Error("Game has not started.");
    return room;
  }

  #authorize(room, playerId, secret) {
    const player = room.players.find((candidate) => candidate.id === playerId);
    if (!player || !secretMatches(player.secret, secret)) {
      throw new Error("Player authentication failed.");
    }
  }
}
