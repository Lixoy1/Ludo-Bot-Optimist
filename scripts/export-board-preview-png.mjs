import { writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { createClassicState } from "../src/engine/classic-engine.mjs";
import { buildTokenRenderModel } from "../src/board/token-render-model.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const roster = [
  { id: "demo-yellow", color: "yellow", username: "Optimist", characterId: "optimist" },
  { id: "demo-blue", color: "blue", username: "Poison", characterId: "poison" },
  { id: "demo-red", color: "red", username: "Husky", characterId: "husky" },
  { id: "demo-green", color: "green", username: "Detective", characterId: "lilya-detective" }
];
const state = createClassicState(roster);
[3, 9, 15, 21].forEach((progress, index) => {
  const player = roster[index];
  state.tokens[player.id + ":0"].stepProgress = progress;
  state.tokens[player.id + ":1"].stepProgress = 53;
});

const boardPath = resolve(root, "assets/boards/ludo-board-prototype.svg");
const boardRaster = await sharp(boardPath).resize(1000, 1000).png().toBuffer();
const board = await sharp({ create: { width: 1000, height: 1000, channels: 4, background: "#ffffff" } })
  .composite([{ input: boardRaster, left: 0, top: 0 }])
  .png()
  .toBuffer();
const pawns = buildTokenRenderModel(state).sort((a, b) =>
  a.anchorY - b.anchorY || a.anchorX - b.anchorX || a.tokenId.localeCompare(b.tokenId)
);
const composites = [];
for (const pawn of pawns) {
  const assetPath = resolve(root, "assets/characters", pawn.characterId + ".webp");
  const width = Math.max(1, Math.round(pawn.width));
  const height = Math.max(1, Math.round(pawn.height));
  const sprite = await sharp(assetPath)
    .resize(width, height, { fit: "contain" })
    .png()
    .toBuffer();
  composites.push({
    input: sprite,
    left: Math.round(pawn.imageX),
    top: Math.round(pawn.imageY)
  });
}

const output = resolve(root, "docs/CLASSIC-BOARD-TOKEN-PREVIEW.png");
await sharp(board).composite(composites).png().toFile(output);
console.log("Rendered " + pawns.length + " pawns to " + output);
