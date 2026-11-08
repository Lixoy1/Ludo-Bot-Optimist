import test from "node:test";
import assert from "node:assert/strict";

import {
  COLORS,
  BOARD,
  PLAYER_CONFIG,
  getFinishAnchor,
  getFinishSlots,
  getHomeCell,
  getTrackCell
} from "../src/board/classic-geometry.mjs";
import {
  positionFromProgress,
  tokenMovementPath
} from "../src/board/coordinates.mjs";
import { createClassicState, rollClassicDice, applyClassicMove } from "../src/engine/classic-engine.mjs";
import { buildTokenRenderModel } from "../src/board/token-render-model.mjs";

const GRID_STEP = 1;
const manhattan = (a, b) => Math.abs(a.col - b.col) + Math.abs(a.row - b.row);

test("each color has a complete 51-track, 5-home and 1-finish movement route", () => {
  for (const color of COLORS) {
    const tokenIndex = 2;
    const start = tokenMovementPath(color, -1, 0, tokenIndex);
    const rest = tokenMovementPath(color, 0, 56, tokenIndex);
    const route = [...start, ...rest];
    const track = route.filter((step) => step.zone === "track");
    const home = route.filter((step) => step.zone === "home");
    const finish = route.filter((step) => step.zone === "finished");

    assert.equal(route.length, 57, color + " complete route length");
    assert.equal(track.length, 51, color + " outer route length");
    assert.equal(home.length, 5, color + " home lane length");
    assert.equal(finish.length, 1, color + " finish count");

    for (let progress = 0; progress <= 50; progress += 1) {
      assert.equal(track[progress].progress, progress, color + " progress " + progress);
      assert.equal(
        track[progress].trackIndex,
        (PLAYER_CONFIG[color].startIndex + progress) % BOARD.trackLength,
        color + " global track index at " + progress
      );
    }

    assert.equal(
      new Set(track.map((step) => step.trackIndex)).size,
      51,
      color + " must not repeat an outer-track cell"
    );
    for (let index = 0; index < 5; index += 1) {
      assert.equal(home[index].homeIndex, index);
      assert.deepEqual(
        [home[index].col, home[index].row],
        PLAYER_CONFIG[color].homeLane[index]
      );
    }
    assert.equal(finish[0].finishSlot, tokenIndex);
    assert.deepEqual(
      { x: finish[0].x, y: finish[0].y },
      getFinishSlots(color)[tokenIndex]
    );
  }
});

test("all four home-lane entrances and finish junctions are directly connected", () => {
  for (const color of COLORS) {
    const config = PLAYER_CONFIG[color];
    const entry = getTrackCell(config.homeEntryIndex);
    const firstHome = getHomeCell(color, 0);
    const lastHome = getHomeCell(color, 4);
    const finish = getFinishAnchor(color);

    assert.equal(
      manhattan(entry, firstHome),
      GRID_STEP,
      color + " outer track must connect directly to home lane"
    );

    for (let index = 0; index < 4; index += 1) {
      assert.equal(
        manhattan(getHomeCell(color, index), getHomeCell(color, index + 1)),
        GRID_STEP,
        color + " home lane step " + index
      );
    }

    assert.equal(
      manhattan(lastHome, finish),
      GRID_STEP,
      color + " final home cell must connect directly to finish"
    );
  }
});

test("every animated step resolves to the same cell used by the pawn renderer", () => {
  const roster = [
    { id: "yellow-player", color: "yellow", characterId: "optimist" },
    { id: "blue-player", color: "blue", characterId: "poison" },
    { id: "red-player", color: "red", characterId: "husky" },
    { id: "green-player", color: "green", characterId: "lilya-detective" }
  ];

  for (const player of roster) {
    const state = createClassicState(roster);
    const tokenId = player.id + ":0";

    for (let progress = -1; progress <= 56; progress += 1) {
      state.tokens[tokenId].stepProgress = progress;
      const pawn = buildTokenRenderModel(state).find((item) => item.tokenId === tokenId);
      const zone = positionFromProgress(progress).zone;

      assert.equal(pawn.zone, zone, player.color + " zone at " + progress);

      if (progress === -1) {
        assert.equal(pawn.zone, "base");
        continue;
      }

      let expected;
      if (zone === "track") {
        expected = getTrackCell((PLAYER_CONFIG[player.color].startIndex + progress) % 52);
      } else if (zone === "home") {
        expected = getHomeCell(player.color, progress - 51);
      } else {
        expected = getFinishSlots(player.color)[0];
      }

      assert.ok(
        Math.abs(pawn.x - expected.x) < 1e-8 &&
        Math.abs(pawn.y - expected.y) < 1e-8,
        player.color + " render position differs from movement position at " + progress
      );
    }
  }
});

test("movement path rejects invalid colors, token slots and impossible base jumps", () => {
  assert.throws(() => tokenMovementPath("purple", 0, 1), /Unknown color/);
  assert.throws(() => tokenMovementPath("yellow", -1, 1), /Leaving base/);
  assert.throws(() => tokenMovementPath("yellow", 0, 57), /outside/);
  assert.throws(() => tokenMovementPath("yellow", 4, 3), /follow origin/);
  assert.throws(() => tokenMovementPath("yellow", -1, 0, 4), /Token index/);
});

test("the engine and animation path agree at home entry and the exact finish for every color", () => {
  const roster = [
    { id: "yellow-player", color: "yellow", characterId: "optimist" },
    { id: "blue-player", color: "blue", characterId: "poison" },
    { id: "red-player", color: "red", characterId: "husky" },
    { id: "green-player", color: "green", characterId: "lilya-detective" }
  ];

  for (const player of roster) {
    const tokenId = player.id + ":2";

    const entryState = createClassicState(roster);
    entryState.currentPlayer = player.id;
    entryState.tokens[tokenId].stepProgress = 50;
    const entryRoll = rollClassicDice(entryState, player.id, 1);
    const entryMove = applyClassicMove(entryRoll.state, player.id, tokenId);
    const entryPath = tokenMovementPath(player.color, 50, 51, 2);

    assert.equal(entryMove.state.tokens[tokenId].stepProgress, 51);
    assert.equal(entryMove.state.lastAction.to.zone, "home");
    assert.equal(entryPath.length, 1);
    assert.equal(entryPath[0].homeIndex, 0);
    assert.deepEqual(
      { x: entryPath[0].x, y: entryPath[0].y },
      { x: getHomeCell(player.color, 0).x, y: getHomeCell(player.color, 0).y }
    );

    const finishState = createClassicState(roster);
    finishState.currentPlayer = player.id;
    finishState.tokens[tokenId].stepProgress = 55;
    const finishRoll = rollClassicDice(finishState, player.id, 1);
    const finishMove = applyClassicMove(finishRoll.state, player.id, tokenId);
    const finishPath = tokenMovementPath(player.color, 55, 56, 2);
    const renderedFinish = buildTokenRenderModel(finishMove.state).find((item) => item.tokenId === tokenId);

    assert.equal(finishMove.state.tokens[tokenId].stepProgress, 56);
    assert.equal(finishMove.state.lastAction.to.zone, "finished");
    assert.equal(finishPath.length, 1);
    assert.equal(finishPath[0].finishSlot, 2);
    assert.deepEqual(
      { x: finishPath[0].x, y: finishPath[0].y },
      { x: renderedFinish.x, y: renderedFinish.y }
    );
  }
});
