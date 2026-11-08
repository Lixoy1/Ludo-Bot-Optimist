import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildClassicBoardPreviewSvg } from "../src/board/preview.mjs";

test("committed classic board preview is the generated 16-pawn geometry snapshot", async () => {
  const expected = buildClassicBoardPreviewSvg();
  const stored = await readFile(
    new URL("../docs/CLASSIC-BOARD-TOKEN-PREVIEW.svg", import.meta.url),
    "utf8"
  );
  assert.equal(stored, expected);
  assert.match(stored, /ludo-board-prototype\.svg/);
  assert.equal((stored.match(/<image/g) || []).length, 17);
  assert.equal((stored.match(/data-token-id=/g) || []).length, 16);
  assert.match(stored, /data-zone="base"/);
  assert.match(stored, /data-zone="track"/);
  assert.match(stored, /data-zone="home"/);
  assert.match(stored, /\.webp/);
});
