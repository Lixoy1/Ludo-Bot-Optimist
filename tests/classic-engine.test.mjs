import test from "node:test";
import assert from "node:assert/strict";
import {
  applyClassicMove,
  assertClassicState,
  buildOccupancy,
  createClassicState,
  globalTrackIndex,
  legalMoves,
  rollClassicDice
} from "../src/engine/classic-engine.mjs";

const roster = [
  { id: "p1", color: "yellow", username: "Player One" },
  { id: "p2", color: "blue", username: "Player Two" },
  { id: "p3", color: "red", username: "Player Three" },
  { id: "p4", color: "green", username: "Player Four" }
];

function stateWithProgress(progressByToken) {
  const state = createClassicState(roster.slice(0, 2));
  for (const [tokenId, progress] of Object.entries(progressByToken)) {
    state.tokens[tokenId].stepProgress = progress;
  }
  return state;
}

test("creates a valid 2–4 player game with four base tokens per player", () => {
  for (const count of [2, 3, 4]) {
    const state = createClassicState(roster.slice(0, count));
    assert.equal(state.players.length, count);
    assert.equal(Object.keys(state.tokens).length, count * 4);
    assert.equal(state.currentPlayer, "p1");
    assert.equal(state.dice, null);
    assert.equal(assertClassicState(state), true);
    assert.ok(Object.values(state.tokens).every((token) => token.stepProgress === -1));
  }
});

test("rejects duplicate IDs, duplicate colors and invalid roster sizes", () => {
  assert.throws(() => createClassicState([roster[0]]), /2–4 players/);
  assert.throws(() => createClassicState([roster[0], { ...roster[1], id: "p1" }]), /unique/);
  assert.throws(() => createClassicState([roster[0], { ...roster[1], color: "yellow" }]), /unique/);
});

test("a non-six roll with every token in base passes the turn", () => {
  const state = createClassicState(roster.slice(0, 2));
  const result = rollClassicDice(state, "p1", 5);
  assert.deepEqual(result.legalTokenIds, []);
  assert.equal(result.state.currentPlayer, "p2");
  assert.equal(result.state.dice, null);
  assert.equal(result.turnAdvanced, true);
});

test("six opens all four base tokens onto the player's color-specific start cell", () => {
  const state = createClassicState(roster.slice(0, 2));
  const result = rollClassicDice(state, "p1", 6);
  assert.deepEqual(result.legalTokenIds, ["p1:0", "p1:1", "p1:2", "p1:3"]);
  const moved = applyClassicMove(result.state, "p1", "p1:0");
  assert.equal(moved.state.tokens["p1:0"].stepProgress, 0);
  assert.equal(globalTrackIndex("yellow", 0), 0);
  assert.equal(moved.state.currentPlayer, "p1");
  assert.equal(moved.bonusRoll, true);
  assert.equal(moved.state.dice, null);
});

test("regular movement advances by the die value and then passes the turn", () => {
  const state = stateWithProgress({ "p1:0": 4 });
  const rolled = rollClassicDice(state, "p1", 3);
  assert.deepEqual(rolled.legalTokenIds, ["p1:0"]);
  const moved = applyClassicMove(rolled.state, "p1", "p1:0");
  assert.equal(moved.state.tokens["p1:0"].stepProgress, 7);
  assert.equal(moved.state.currentPlayer, "p2");
  assert.equal(moved.turnAdvanced, true);
  assert.equal(moved.bonusRoll, false);
});

test("landing on an unprotected enemy token captures it and grants another roll", () => {
  const state = stateWithProgress({ "p1:0": 1, "p2:0": 42 });
  const rolled = rollClassicDice(state, "p1", 2);
  assert.deepEqual(rolled.legalTokenIds, ["p1:0"]);
  const moved = applyClassicMove(rolled.state, "p1", "p1:0");
  assert.deepEqual(moved.captured, ["p2:0"]);
  assert.equal(moved.state.tokens["p2:0"].stepProgress, -1);
  assert.equal(moved.state.tokens["p1:0"].stepProgress, 3);
  assert.equal(moved.bonusRoll, true);
  assert.equal(moved.state.currentPlayer, "p1");
});

test("safe cells protect an enemy token from capture", () => {
  const state = stateWithProgress({ "p1:0": 7, "p2:0": 47 });
  const rolled = rollClassicDice(state, "p1", 1);
  assert.deepEqual(rolled.legalTokenIds, ["p1:0"]);
  const moved = applyClassicMove(rolled.state, "p1", "p1:0");
  assert.deepEqual(moved.captured, []);
  assert.equal(moved.state.tokens["p2:0"].stepProgress, 47);
  assert.equal(moved.bonusRoll, false);
});

test("a two-token blockade cannot be landed on or crossed", () => {
  const state = stateWithProgress({
    "p1:0": 1,
    "p2:0": 42,
    "p2:1": 42
  });
  assert.deepEqual(legalMoves(state, "p1", 2), []);
  const rolled = rollClassicDice(state, "p1", 2);
  assert.deepEqual(rolled.legalTokenIds, []);
  assert.equal(rolled.state.currentPlayer, "p2");
});

test("three consecutive sixes skip the player's turn", () => {
  let state = createClassicState(roster.slice(0, 2));
  let rolled = rollClassicDice(state, "p1", 6);
  state = applyClassicMove(rolled.state, "p1", "p1:0").state;
  rolled = rollClassicDice(state, "p1", 6);
  state = applyClassicMove(rolled.state, "p1", "p1:0").state;
  const third = rollClassicDice(state, "p1", 6);
  assert.equal(third.skipped, true);
  assert.equal(third.state.currentPlayer, "p2");
  assert.equal(third.state.consecutiveSixes, 0);
  assert.equal(third.state.dice, null);
});

test("a token must roll the exact value to finish and receives a bonus for finishing", () => {
  const state = stateWithProgress({ "p1:0": 55 });
  const rolled = rollClassicDice(state, "p1", 1);
  assert.deepEqual(rolled.legalTokenIds, ["p1:0"]);
  const moved = applyClassicMove(rolled.state, "p1", "p1:0");
  assert.equal(moved.state.tokens["p1:0"].stepProgress, 56);
  assert.equal(moved.bonusRoll, true);
  assert.equal(moved.state.phase, "playing");
});

test("a roll that would overshoot the finish is not a legal move", () => {
  const state = stateWithProgress({ "p1:0": 54 });
  const rolled = rollClassicDice(state, "p1", 3);
  assert.deepEqual(rolled.legalTokenIds, []);
  assert.equal(rolled.state.currentPlayer, "p2");
});

test("the fourth finished token ends the game and sets the winner", () => {
  const state = stateWithProgress({
    "p1:0": 55,
    "p1:1": 56,
    "p1:2": 56,
    "p1:3": 56
  });
  const rolled = rollClassicDice(state, "p1", 1);
  const moved = applyClassicMove(rolled.state, "p1", "p1:0");
  assert.equal(moved.state.phase, "finished");
  assert.equal(moved.state.winner, "p1");
  assert.equal(moved.state.players[0].status, "finished");
  assert.equal(moved.bonusRoll, false);
  assert.equal(assertClassicState(moved.state), true);
});

test("occupancy separates outer track, home lane, base and finished tokens", () => {
  const state = stateWithProgress({
    "p1:0": 0,
    "p1:1": 51,
    "p1:2": 56
  });
  const occupancy = buildOccupancy(state);
  assert.deepEqual(occupancy.track["0"], ["p1:0"]);
  assert.deepEqual(occupancy.home["yellow:0"], ["p1:1"]);
  assert.deepEqual(occupancy.finished.p1, ["p1:2"]);
  assert.deepEqual(occupancy.base.p1, ["p1:3"]);
});
