import {
  COLORS,
  PLAYER_CONFIG,
  SAFE_TRACK_INDICES
} from "../board/classic-geometry.mjs";
import { positionFromProgress } from "../board/coordinates.mjs";

export const TOKENS_PER_PLAYER = 4;
export const BASE_PROGRESS = -1;
export const LAST_OUTER_PROGRESS = 50;
export const LAST_HOME_PROGRESS = 55;
export const FINISH_PROGRESS = 56;

function validateRoster(roster) {
  if (!Array.isArray(roster) || roster.length < 2 || roster.length > 4) {
    throw new RangeError("Classic Ludo requires 2–4 players.");
  }

  const ids = roster.map((player) => player?.id);
  const colors = roster.map((player) => player?.color);

  if (ids.some((id) => typeof id !== "string" || !id.trim()) || new Set(ids).size !== ids.length) {
    throw new TypeError("Player IDs must be non-empty and unique.");
  }
  if (colors.some((color) => !COLORS.includes(color)) || new Set(colors).size !== colors.length) {
    throw new TypeError("Player colors must be unique board colors.");
  }

  return roster.map((player) => ({
    id: player.id,
    color: player.color,
    username: String(player.username ?? player.id).trim().slice(0, 40),
    characterId: String(player.characterId || "optimist"),
    status: "playing",
    finishedAt: null
  }));
}

export function createClassicState(roster) {
  const players = validateRoster(roster);
  const tokens = {};

  for (const player of players) {
    for (let index = 0; index < TOKENS_PER_PLAYER; index += 1) {
      const id = player.id + ":" + index;
      tokens[id] = {
        id,
        owner: player.id,
        color: player.color,
        index,
        stepProgress: BASE_PROGRESS
      };
    }
  }

  const state = {
    mode: "CLASSIC",
    phase: "playing",
    players,
    tokens,
    currentPlayer: players[0].id,
    dice: null,
    consecutiveSixes: 0,
    winner: null,
    revision: 0,
    lastAction: null
  };

  assertClassicState(state);
  return state;
}

export function globalTrackIndex(color, progress) {
  const config = PLAYER_CONFIG[color];
  if (!config || !Number.isInteger(progress) || progress < 0 || progress > LAST_OUTER_PROGRESS) {
    throw new RangeError("Invalid outer-track position.");
  }
  return (config.startIndex + progress) % 52;
}

const playerById = (state, playerId) =>
  state.players.find((player) => player.id === playerId) ?? null;

function destinationProgress(token, dice) {
  const position = positionFromProgress(token.stepProgress);
  if (position.zone === "finished") return null;
  if (position.zone === "base") return dice === 6 ? 0 : null;

  const destination = token.stepProgress + dice;
  return destination <= FINISH_PROGRESS ? destination : null;
}

function tokensAt(state, globalIndex, exceptTokenId = null) {
  return Object.values(state.tokens).filter((token) =>
    token.id !== exceptTokenId &&
    positionFromProgress(token.stepProgress).zone === "track" &&
    globalTrackIndex(token.color, token.stepProgress) === globalIndex
  );
}

function hasBlockade(state, globalIndex, exceptTokenId = null) {
  const counts = new Map();
  for (const token of tokensAt(state, globalIndex, exceptTokenId)) {
    counts.set(token.owner, (counts.get(token.owner) ?? 0) + 1);
  }
  return [...counts.values()].some((count) => count >= 2);
}

function pathIsClear(state, token, destination) {
  if (positionFromProgress(token.stepProgress).zone !== "track") return true;

  const lastTrackProgress = Math.min(destination, LAST_OUTER_PROGRESS);
  for (let progress = token.stepProgress + 1; progress <= lastTrackProgress; progress += 1) {
    const index = globalTrackIndex(token.color, progress);
    if (hasBlockade(state, index, token.id)) return false;
  }
  return true;
}

function canLand(state, token, destination) {
  if (positionFromProgress(destination).zone !== "track") return true;
  return !hasBlockade(state, globalTrackIndex(token.color, destination), token.id);
}

export function buildOccupancy(state) {
  const occupancy = { track: {}, home: {}, base: {}, finished: {} };

  for (const token of Object.values(state.tokens)) {
    const position = positionFromProgress(token.stepProgress);
    const key = position.zone === "track"
      ? String(globalTrackIndex(token.color, token.stepProgress))
      : position.zone === "home"
        ? token.color + ":" + (token.stepProgress - 51)
        : token.owner;

    (occupancy[position.zone][key] ??= []).push(token.id);
  }

  return occupancy;
}

export function legalMoves(state, playerId, dice = state?.dice) {
  if (
    !state ||
    state.phase !== "playing" ||
    state.currentPlayer !== playerId ||
    !playerById(state, playerId) ||
    !Number.isInteger(dice) ||
    dice < 1 ||
    dice > 6
  ) {
    return [];
  }

  return Object.values(state.tokens)
    .filter((token) => token.owner === playerId)
    .filter((token) => {
      const destination = destinationProgress(token, dice);
      return destination !== null &&
        pathIsClear(state, token, destination) &&
        canLand(state, token, destination);
    })
    .map((token) => token.id);
}

function nextPlayerId(state, playerId) {
  const index = state.players.findIndex((player) => player.id === playerId);
  for (let offset = 1; offset <= state.players.length; offset += 1) {
    const candidate = state.players[(index + offset) % state.players.length];
    if (candidate.status !== "finished") return candidate.id;
  }
  return playerId;
}

const cloneState = (state) => structuredClone(state);

export function rollClassicDice(state, playerId, dice) {
  assertClassicState(state);
  if (
    state.phase !== "playing" ||
    state.currentPlayer !== playerId ||
    state.dice !== null
  ) {
    throw new Error("Dice cannot be rolled now.");
  }
  if (!Number.isInteger(dice) || dice < 1 || dice > 6) {
    throw new RangeError("Dice must be an integer from 1 to 6.");
  }

  const next = cloneState(state);
  next.consecutiveSixes = dice === 6 ? next.consecutiveSixes + 1 : 0;
  next.lastAction = { type: "ROLL", playerId, dice };
  next.revision += 1;

  if (next.consecutiveSixes === 3) {
    next.consecutiveSixes = 0;
    next.currentPlayer = nextPlayerId(next, playerId);
    next.lastAction.skipped = true;
    assertClassicState(next);
    return {
      state: next,
      legalTokenIds: [],
      skipped: true,
      bonusRoll: false,
      turnAdvanced: true
    };
  }

  next.dice = dice;
  const moves = legalMoves(next, playerId, dice);

  if (moves.length === 0) {
    next.dice = null;
    const bonusRoll = dice === 6;
    if (!bonusRoll) next.currentPlayer = nextPlayerId(next, playerId);
    next.lastAction.noLegalMoves = true;
    next.lastAction.bonusRoll = bonusRoll;
    assertClassicState(next);
    return {
      state: next,
      legalTokenIds: [],
      skipped: false,
      bonusRoll,
      turnAdvanced: !bonusRoll
    };
  }

  assertClassicState(next);
  return {
    state: next,
    legalTokenIds: moves,
    skipped: false,
    bonusRoll: false,
    turnAdvanced: false
  };
}

export function applyClassicMove(state, playerId, tokenId) {
  assertClassicState(state);
  if (
    state.phase !== "playing" ||
    state.currentPlayer !== playerId ||
    state.dice === null
  ) {
    throw new Error("There is no pending move.");
  }

  const legalTokenIds = legalMoves(state, playerId, state.dice);
  if (!legalTokenIds.includes(tokenId)) throw new Error("Illegal move.");

  const next = cloneState(state);
  const token = next.tokens[tokenId];
  const dice = next.dice;
  const fromProgress = token.stepProgress;
  const from = positionFromProgress(fromProgress);
  const toProgress = destinationProgress(token, dice);
  const to = positionFromProgress(toProgress);

  token.stepProgress = toProgress;
  const captured = [];

  if (to.zone === "track") {
    const landingIndex = globalTrackIndex(token.color, toProgress);
    if (!SAFE_TRACK_INDICES.includes(landingIndex)) {
      for (const enemy of Object.values(next.tokens)) {
        if (
          enemy.owner === playerId ||
          positionFromProgress(enemy.stepProgress).zone !== "track"
        ) {
          continue;
        }
        if (globalTrackIndex(enemy.color, enemy.stepProgress) === landingIndex) {
          enemy.stepProgress = BASE_PROGRESS;
          captured.push(enemy.id);
        }
      }
    }
  }

  const finishedCount = Object.values(next.tokens).filter((candidate) =>
    candidate.owner === playerId && candidate.stepProgress === FINISH_PROGRESS
  ).length;
  const justFinished = to.zone === "finished";

  if (finishedCount === TOKENS_PER_PLAYER) {
    const player = playerById(next, playerId);
    player.status = "finished";
    player.finishedAt = next.revision + 1;
    next.phase = "finished";
    next.winner = playerId;
  }

  const bonusRoll = next.phase !== "finished" &&
    (dice === 6 || captured.length > 0 || justFinished);

  next.dice = null;
  if (next.phase !== "finished" && !bonusRoll) {
    next.currentPlayer = nextPlayerId(next, playerId);
  }

  next.lastAction = {
    type: "MOVE",
    playerId,
    tokenId,
    dice,
    from,
    to,
    fromProgress,
    toProgress,
    captured,
    bonusRoll
  };
  next.revision += 1;

  assertClassicState(next);
  return {
    state: next,
    captured,
    bonusRoll,
    turnAdvanced: !bonusRoll && next.phase !== "finished"
  };
}

export function assertClassicState(state) {
  if (
    !state ||
    state.mode !== "CLASSIC" ||
    !Array.isArray(state.players) ||
    !state.tokens ||
    typeof state.tokens !== "object"
  ) {
    throw new TypeError("Malformed Classic Ludo state.");
  }
  if (!["playing", "finished"].includes(state.phase)) {
    throw new Error("Invalid Classic game phase.");
  }
  if (state.players.length < 2 || state.players.length > 4) {
    throw new RangeError("Classic requires 2–4 players.");
  }
  if (
    new Set(state.players.map((player) => player.id)).size !== state.players.length ||
    new Set(state.players.map((player) => player.color)).size !== state.players.length ||
    state.players.some((player) => !COLORS.includes(player.color))
  ) {
    throw new Error("Classic player IDs and colors must be unique and valid.");
  }
  if (!state.players.some((player) => player.id === state.currentPlayer)) {
    throw new Error("Current player is missing.");
  }
  if (
    !Number.isInteger(state.revision) ||
    state.revision < 0 ||
    !Number.isInteger(state.consecutiveSixes) ||
    state.consecutiveSixes < 0 ||
    state.consecutiveSixes > 2
  ) {
    throw new Error("Invalid Classic turn metadata.");
  }
  if (state.dice !== null && (!Number.isInteger(state.dice) || state.dice < 1 || state.dice > 6)) {
    throw new Error("Pending dice value must be 1..6 or null.");
  }

  const playerIds = new Set(state.players.map((player) => player.id));
  for (const player of state.players) {
    const owned = Object.values(state.tokens).filter((token) => token.owner === player.id);
    if (owned.length !== TOKENS_PER_PLAYER) {
      throw new Error("Each Classic player must own exactly four tokens.");
    }
    const tokenIndexes = new Set();

    for (const token of owned) {
      if (
        token.color !== player.color ||
        !Number.isInteger(token.index) ||
        token.index < 0 ||
        token.index >= TOKENS_PER_PLAYER ||
        token.id !== player.id + ":" + token.index ||
        tokenIndexes.has(token.index)
      ) {
        throw new Error("Classic token identity or ownership is inconsistent.");
      }
      tokenIndexes.add(token.index);
      positionFromProgress(token.stepProgress);
    }

    if (!["playing", "finished"].includes(player.status)) {
      throw new Error("Invalid player status.");
    }
    if (player.status === "finished" && owned.some((token) => token.stepProgress !== FINISH_PROGRESS)) {
      throw new Error("A finished player must have all four tokens finished.");
    }
  }

  for (const token of Object.values(state.tokens)) {
    if (!playerIds.has(token.owner)) throw new Error("Token owner is not in the roster.");
  }

  if (state.phase === "finished") {
    const winner = playerById(state, state.winner);
    if (!winner || winner.status !== "finished") throw new Error("Finished game must have a valid winner.");
  } else if (state.winner !== null || state.players.some((player) => player.status === "finished")) {
    throw new Error("A playing game cannot already have a winner or finished player.");
  }

  return true;
}
