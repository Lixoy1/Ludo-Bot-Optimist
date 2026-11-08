import test from "node:test";
import assert from "node:assert/strict";

import {
  createPawnMoveAnimation,
  createPawnCaptureAnimation,
  createTurnAnimationPlan,
  samplePawnMoveAnimation,
  samplePawnCaptureAnimation,
  sampleTurnAnimationPlan
} from "../src/board/movement-animation.mjs";
import { getTrackCell, baseSlotPoint } from "../src/board/classic-geometry.mjs";
import { createClassicState, rollClassicDice, applyClassicMove } from "../src/engine/classic-engine.mjs";

const roster = [
  { id: "p1", color: "yellow", characterId: "optimist" },
  { id: "p2", color: "blue", characterId: "poison" }
];

function applyMove(state, playerId, tokenId, dice) {
  state.currentPlayer = playerId;
  const roll = rollClassicDice(state, playerId, dice);
  assert.ok(roll.legalTokenIds.includes(tokenId), "the test move must be legal");
  return applyClassicMove(roll.state, playerId, tokenId).state;
}

test("a six from base creates one deliberate launch animation from the token's own base slot", () => {
  const before = createClassicState(roster);
  const after = applyMove(before, "p1", "p1:0", 6);
  const animation = createPawnMoveAnimation(before, after, "p1:0");

  assert.equal(animation.kind, "move");
  assert.equal(animation.fromProgress, -1);
  assert.equal(animation.toProgress, 0);
  assert.equal(animation.segments.length, 1);
  assert.equal(animation.segments[0].durationMs, 220);
  assert.ok(animation.segments[0].arcHeight > 0);

  const start = samplePawnMoveAnimation(animation, 0);
  const end = samplePawnMoveAnimation(animation, animation.durationMs);
  const base = baseSlotPoint("yellow", 0);
  const entry = getTrackCell(0);

  assert.equal(start.done, false);
  assert.ok(Math.abs(start.x - base.x) < 1e-8);
  assert.ok(Math.abs(start.y - (base.y + 62.08849 * 0.47)) < 1e-8);
  assert.equal(end.done, true);
  assert.ok(Math.abs(end.x - entry.x) < 1e-8);
  assert.equal(end.progress, 0);
});

test("a multi-cell move is split into consecutive eased cell-to-cell segments", () => {
  const before = createClassicState(roster);
  before.tokens["p1:0"].stepProgress = 0;
  const after = applyMove(before, "p1", "p1:0", 3);
  const animation = createPawnMoveAnimation(before, after, "p1:0");

  assert.equal(animation.segments.length, 3);
  assert.equal(animation.segments[0].waypoint.progress, 1);
  assert.equal(animation.segments[1].waypoint.progress, 2);
  assert.equal(animation.segments[2].waypoint.progress, 3);
  assert.equal(animation.segments[0].startMs, 0);
  assert.equal(animation.segments[1].startMs, animation.segments[0].endMs);
  assert.equal(animation.segments[2].startMs, animation.segments[1].endMs);

  const firstHalf = samplePawnMoveAnimation(animation, animation.segments[0].durationMs / 2);
  const firstCell = getTrackCell(0);
  const secondCell = getTrackCell(1);
  assert.equal(firstHalf.segmentIndex, 0);
  assert.ok(firstHalf.x >= Math.min(firstCell.x, secondCell.x) - 1e-8 && firstHalf.x <= Math.max(firstCell.x, secondCell.x) + 1e-8);
  assert.ok(firstHalf.y >= Math.min(firstCell.y, secondCell.y) && firstHalf.y <= Math.max(firstCell.y, secondCell.y) + 62.08849 * 0.47);
  const firstSegment = animation.segments[0];
  assert.ok(firstHalf.y < (firstSegment.from.anchorY + firstSegment.to.anchorY) / 2);

  const exactFirstStep = samplePawnMoveAnimation(animation, animation.segments[0].endMs);
  assert.equal(exactFirstStep.segmentIndex, 1);
  assert.equal(exactFirstStep.segmentProgress, 0);
  assert.ok(Math.abs(exactFirstStep.x - secondCell.x) < 1e-8);

  const end = samplePawnMoveAnimation(animation, animation.durationMs);
  assert.equal(end.done, true);
  assert.equal(end.progress, 3);
  assert.deepEqual(
    { x: end.x, y: end.y },
    { x: animation.segments.at(-1).to.x, y: animation.segments.at(-1).to.y }
  );
});

test("the moving pawn shrinks into a shared mini-cell and expands after leaving it", () => {
  const before = createClassicState(roster);
  before.tokens["p1:0"].stepProgress = 1;
  before.tokens["p2:0"].stepProgress = 41;
  const after = applyMove(before, "p1", "p1:0", 2);
  const animation = createPawnMoveAnimation(before, after, "p1:0");

  assert.equal(animation.segments.length, 2);
  assert.equal(animation.segments[0].waypoint.progress, 2);
  assert.equal(animation.segments[0].to.scale, 0.5);
  assert.equal(animation.segments[1].waypoint.progress, 3);
  assert.equal(animation.segments[1].to.scale, 1);

  const atFirstDestination = samplePawnMoveAnimation(animation, animation.segments[0].endMs);
  assert.equal(atFirstDestination.scale, 0.5);
  const final = samplePawnMoveAnimation(animation, animation.durationMs);
  assert.equal(final.scale, 1);
});

test("a captured pawn follows a curved return animation to its own base slot", () => {
  const before = createClassicState(roster);
  before.tokens["p1:0"].stepProgress = 1;
  before.tokens["p2:0"].stepProgress = 42;
  const after = applyMove(before, "p1", "p1:0", 2);
  const capture = createPawnCaptureAnimation(before, after, "p2:0");
  const base = baseSlotPoint("blue", 0);
  const track = getTrackCell(3);

  assert.equal(after.tokens["p2:0"].stepProgress, -1);
  assert.equal(capture.fromProgress, 42);
  assert.equal(capture.toProgress, -1);
  assert.ok(capture.arcHeight > 0);

  const start = samplePawnCaptureAnimation(capture, 0);
  const middle = samplePawnCaptureAnimation(capture, capture.durationMs / 2);
  const end = samplePawnCaptureAnimation(capture, capture.durationMs);

  assert.ok(Math.abs(start.x - track.x) < 1e-8);
  assert.ok(Math.abs(start.y - (track.y + 62.08849 * 0.47)) < 1e-8);
  assert.ok(middle.y < (start.y + end.y) / 2, "capture arc must rise above the straight return path");
  assert.ok(middle.opacity < 1);
  assert.equal(end.done, true);
  assert.ok(Math.abs(end.x - base.x) < 1e-8);
  assert.ok(Math.abs(end.y - (base.y + 62.08849 * 0.47)) < 1e-8);
  assert.equal(end.scale, 1);
});

test("a complete capture turn plan suppresses static copies and staggers captured tokens", () => {
  const before = createClassicState(roster);
  before.tokens["p1:0"].stepProgress = 1;
  before.tokens["p2:0"].stepProgress = 42;
  const after = applyMove(before, "p1", "p1:0", 2);
  const plan = createTurnAnimationPlan(before, after, {
    stepDurationMs: 100,
    captureDurationMs: 300,
    captureStaggerMs: 80
  });

  assert.equal(plan.kind, "turn");
  assert.equal(plan.mover.segments.length, 2);
  assert.deepEqual(plan.captures.map((item) => item.tokenId), ["p2:0"]);
  assert.equal(plan.captures[0].delayMs, plan.mover.durationMs);
  assert.deepEqual(plan.suppressedTokenIds, ["p1:0", "p2:0"]);
  assert.equal(plan.durationMs, plan.mover.durationMs + 300);

  const beforeCapture = sampleTurnAnimationPlan(plan, plan.mover.durationMs - 1);
  assert.equal(beforeCapture.captures[0].active, false);
  const returning = sampleTurnAnimationPlan(plan, plan.mover.durationMs + 150);
  assert.equal(returning.captures[0].active, true);
  const captureAnimation = plan.captures[0].animation;
  const straightMidpointY = (captureAnimation.from.anchorY + captureAnimation.to.anchorY) / 2;
  assert.ok(returning.captures[0].y < straightMidpointY);
  const done = sampleTurnAnimationPlan(plan, plan.durationMs);
  assert.equal(done.done, true);
  assert.equal(done.mover.done, true);
  assert.equal(done.captures[0].done, true);
  assert.equal(done.captures[0].active, false);
});

test("animation constructors reject invalid durations and unrelated captured tokens", () => {
  const before = createClassicState(roster);
  const after = applyMove(before, "p1", "p1:0", 6);
  assert.throws(
    () => createPawnMoveAnimation(before, after, "p1:0", { stepDurationMs: 0 }),
    /positive number/
  );
  assert.throws(
    () => createPawnCaptureAnimation(before, after, "p1:0"),
    /return an outer-track pawn/
  );
});

test("a full 56-step animation route is generated for every player color", () => {
  const players = [
    { id: "yellow", color: "yellow", characterId: "optimist" },
    { id: "blue", color: "blue", characterId: "poison" },
    { id: "red", color: "red", characterId: "husky" },
    { id: "green", color: "green", characterId: "lilya-detective" }
  ];

  for (const player of players) {
    const before = createClassicState(players);
    before.tokens[player.id + ":0"].stepProgress = 0;
    const after = structuredClone(before);
    after.tokens[player.id + ":0"].stepProgress = 56;
    const animation = createPawnMoveAnimation(before, after, player.id + ":0");

    assert.equal(animation.segments.length, 56, player.color + " segment count");
    assert.equal(animation.segments[0].waypoint.progress, 1);
    assert.equal(animation.segments[50].waypoint.zone, "home");
    assert.equal(animation.segments[55].waypoint.zone, "finished");
    assert.equal(samplePawnMoveAnimation(animation, animation.durationMs).done, true);
  }
});

test("two captured opponents return separately and are unsuppressed as each flight completes", () => {
  const threePlayers = [
    { id: "yellow", color: "yellow", characterId: "optimist" },
    { id: "blue", color: "blue", characterId: "poison" },
    { id: "red", color: "red", characterId: "husky" }
  ];
  const before = createClassicState(threePlayers);
  before.tokens["yellow:0"].stepProgress = 1;
  before.tokens["blue:0"].stepProgress = 42;
  before.tokens["red:0"].stepProgress = 29;
  before.currentPlayer = "yellow";
  const roll = rollClassicDice(before, "yellow", 2);
  const after = applyClassicMove(roll.state, "yellow", "yellow:0").state;

  assert.deepEqual(after.lastAction.captured, ["blue:0", "red:0"]);
  const plan = createTurnAnimationPlan(before, after, {
    stepDurationMs: 100,
    captureDurationMs: 300,
    captureStaggerMs: 80
  });

  assert.deepEqual(plan.captures.map((capture) => capture.delayMs), [
    plan.mover.durationMs,
    plan.mover.durationMs + 80
  ]);

  const firstFlightFinished = sampleTurnAnimationPlan(plan, plan.mover.durationMs + 300);
  assert.deepEqual(firstFlightFinished.suppressedTokenIds, ["red:0"]);
  assert.equal(firstFlightFinished.captures[0].active, false);
  assert.equal(firstFlightFinished.captures[1].active, true);

  const completed = sampleTurnAnimationPlan(plan, plan.durationMs);
  assert.deepEqual(completed.suppressedTokenIds, []);
  assert.equal(completed.done, true);
});

test("turn animation plan rejects a MOVE action that does not match its supplied states", () => {
  const before = createClassicState(roster);
  const after = applyMove(before, "p1", "p1:0", 6);
  after.lastAction.fromProgress = 12;
  assert.throws(() => createTurnAnimationPlan(before, after), /does not match/);
});
