import test from "node:test";
import assert from "node:assert/strict";
import { buildTokenRenderModel, SPRITE_BASELINE_RATIO } from "../src/board/token-render-model.mjs";
import { getFinishSlots, getHomeCell, getTrackCell, PLAYER_CONFIG } from "../src/board/classic-geometry.mjs";
import { createClassicState, rollClassicDice, applyClassicMove } from "../src/engine/classic-engine.mjs";

const roster = [
  { id: "p1", color: "yellow", characterId: "optimist" },
  { id: "p2", color: "blue", characterId: "poison" }
];

test("base tokens render at their own centered wells using the selected character portrait", () => {
  const state = createClassicState(roster);
  const model = buildTokenRenderModel(state);
  assert.equal(model.length, 8);

  for (const token of model.filter((item) => item.zone === "base")) {
    const player = state.players.find((candidate) => candidate.id === token.owner);
    const index = Number(token.tokenId.split(":")[1]);
    const slot = PLAYER_CONFIG[token.color].baseSlots[index];
    const pitch = 62.08849;
    const expected = {
      x: 33.617188 + (slot[0] + 0.5) * pitch,
      y: 34.494141 + (slot[1] + 0.5) * pitch
    };
    assert.equal(token.characterId, player.characterId);
    assert.equal(token.src, "/assets/characters/" + player.characterId + ".webp");
    assert.ok(Math.abs(token.x - expected.x) < 1e-8);
    assert.ok(Math.abs(token.y - expected.y) < 1e-8);
    assert.ok(token.width < pitch);
    assert.ok(token.height < pitch);
    assert.equal(token.scale, 1);
  }
});

test("an engine move is converted into the exact board track cell center", () => {
  const state = createClassicState(roster);
  const rolled = rollClassicDice(state, "p1", 6);
  const moved = applyClassicMove(rolled.state, "p1", "p1:0");
  const pawn = buildTokenRenderModel(moved.state).find((item) => item.tokenId === "p1:0");
  const expected = getTrackCell(0);
  assert.equal(pawn.zone, "track");
  assert.equal(pawn.cellKey, "track:0");
  assert.equal(pawn.trackIndex, 0);
  assert.deepEqual({ x: pawn.x, y: pawn.y }, { x: expected.x, y: expected.y });
});

test("three pawns stacked on one track cell receive separate compact render positions", () => {
  const state = createClassicState(roster);
  for (const id of ["p1:0", "p1:1", "p1:2"]) state.tokens[id].stepProgress = 4;
  const pawns = buildTokenRenderModel(state).filter((item) => item.cellKey === "track:4");
  assert.equal(pawns.length, 3);
  assert.ok(pawns.every((pawn) => pawn.scale === 0.5));
  assert.equal(new Set(pawns.map((pawn) => pawn.x + ":" + pawn.y)).size, 3);
  assert.ok(pawns.every((pawn) => pawn.width < 62.08849 * 0.5));
  assert.ok(pawns.every((pawn) => pawn.height < 62.08849 * 0.5));
});

test("four pawns in one home cell use a compact non-overlapping stack", () => {
  const state = createClassicState(roster);
  for (const id of ["p1:0", "p1:1", "p1:2", "p1:3"]) state.tokens[id].stepProgress = 53;
  const pawns = buildTokenRenderModel(state).filter((item) => item.cellKey === "home:yellow:2");
  const home = getHomeCell("yellow", 2);
  assert.equal(pawns.length, 4);
  assert.ok(pawns.every((pawn) => pawn.scale === 0.5));
  assert.equal(new Set(pawns.map((pawn) => pawn.x + ":" + pawn.y)).size, 4);
  assert.ok(pawns.every((pawn) => Math.abs(pawn.x - home.x) < 62.08849 / 2));
  assert.ok(pawns.every((pawn) => Math.abs(pawn.y - home.y) < 62.08849 / 2));
});

test("finished pawns use four small individual sockets in the finish cell", () => {
  const state = createClassicState(roster);
  for (let index = 0; index < 4; index += 1) {
    state.tokens["p1:" + index].stepProgress = 56;
  }
  state.players[0].status = "finished";
  state.phase = "finished";
  state.winner = "p1";

  const pawns = buildTokenRenderModel(state).filter((item) => item.zone === "finished");
  const slots = getFinishSlots("yellow");
  assert.equal(pawns.length, 4);
  assert.ok(pawns.every((pawn) => pawn.scale === 0.28));
  assert.deepEqual(
    pawns.map(({ x, y }) => ({ x, y })).sort((a, b) => a.y - b.y || a.x - b.x),
    slots.map(({ x, y }) => ({ x, y })).sort((a, b) => a.y - b.y || a.x - b.x)
  );
  for (let i = 0; i < pawns.length; i += 1) {
    for (let j = i + 1; j < pawns.length; j += 1) {
      const dx = Math.abs(pawns[i].x - pawns[j].x);
      const dy = Math.abs(pawns[i].y - pawns[j].y);
      assert.ok(dx > (pawns[i].width + pawns[j].width) / 2 ||
        dy > (pawns[i].height + pawns[j].height) / 2);
    }
  }
});

test("a solo pawn fills almost the full cell height and stays inside its borders", () => {
  const state = createClassicState(roster);
  const model = buildTokenRenderModel(state);
  for (const pawn of model.filter((item) => item.zone === "base")) {
    assert.equal(pawn.scale, 1);
    assert.ok(Math.abs(pawn.height - 62.08849 * 0.94) < 1e-8);
    assert.ok(Math.abs(pawn.imageY - (pawn.y - 62.08849 * 0.47)) < 1e-8);
    assert.ok(Math.abs(pawn.anchorY - (pawn.y + 62.08849 * 0.47)) < 1e-8);
  }
});

test("four pawns occupy the four quadrants as full-height mini-cell sprites", () => {
  const state = createClassicState(roster);
  for (const id of ["p1:0", "p1:1", "p1:2", "p1:3"]) state.tokens[id].stepProgress = 4;
  const pawns = buildTokenRenderModel(state).filter((item) => item.cellKey === "track:4");
  const expected = [[-0.25,-0.25],[0.25,-0.25],[-0.25,0.25],[0.25,0.25]];
  const center = getTrackCell(4);
  assert.equal(pawns.length, 4);
  for (let i = 0; i < 4; i++) {
    assert.equal(pawns[i].scale, 0.5);
    assert.ok(Math.abs(pawns[i].height - 62.08849 * 0.47) < 1e-8);
    assert.ok(Math.abs(pawns[i].x - center.x - expected[i][0] * 62.08849) < 1e-8);
    assert.ok(Math.abs(pawns[i].y - center.y - expected[i][1] * 62.08849) < 1e-8);
  }
});

test("all rendered sprites use pedestal-baseline anchoring rather than image-center anchoring", () => {
  const state = createClassicState(roster);
  const model = buildTokenRenderModel(state);
  assert.equal(SPRITE_BASELINE_RATIO, 1);
  for (const pawn of model) {
    assert.ok(Math.abs(pawn.imageX - (pawn.anchorX - pawn.width / 2)) < 1e-8);
    assert.ok(Math.abs(pawn.imageY + pawn.height * pawn.baselineRatio - pawn.anchorY) < 1e-8);
    assert.equal(pawn.baselineRatio, SPRITE_BASELINE_RATIO);
    assert.equal(pawn.anchorX, pawn.x);
    assert.ok(Math.abs(pawn.anchorY - (pawn.y + pawn.slotPitch * 0.47)) < 1e-8);
  }
});
