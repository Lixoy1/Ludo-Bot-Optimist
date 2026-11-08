import test from "node:test";
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { buildCoordinateMap } from "../src/board/coordinates.mjs";
import { CHARACTERS } from "../src/characters.mjs";

test("the immutable SVG prototype uses the committed 1000x1000 reference viewBox", async () => {
  const svg = await readFile(new URL("../assets/boards/ludo-board-prototype.svg", import.meta.url), "utf8");
  assert.match(svg, /viewBox="0 0 1000 1000"/);
  assert.ok(svg.length > 10_000);
});

test("the coordinate audit overlay references the original board without altering it", async () => {
  const svg = await readFile(new URL("../assets/boards/classic-coordinate-audit.svg", import.meta.url), "utf8");
  assert.match(svg, /href="ludo-board-prototype\.svg"/);
  assert.equal((svg.match(/<circle /g) || []).length >= 52, true);
  assert.match(svg, /#ffc400/);
});

test("all measured project character portraits are present as non-empty WebP files", async () => {
  assert.equal(CHARACTERS.length, 12);
  for (const character of CHARACTERS) {
    const info = await stat(new URL("../assets/characters/" + character.id + ".webp", import.meta.url));
    assert.ok(info.size > 8_000, character.id + " portrait is missing or unexpectedly small");
  }
});

test("the committed coordinate map is exactly the canonical generated map", async () => {
  const stored = JSON.parse(await readFile(new URL("../Coordinates_Map.json", import.meta.url), "utf8"));
  assert.deepEqual(stored, buildCoordinateMap());
});
