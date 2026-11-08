import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClassicState } from "../engine/classic-engine.mjs";
import { buildTokenRenderModel } from "./token-render-model.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const readAsset = (path) => readFileSync(resolve(ROOT, path)).toString("base64");

const DEMO_ROSTER = [
  { id: "demo-yellow", color: "yellow", username: "Optimist", characterId: "optimist" },
  { id: "demo-blue", color: "blue", username: "Poison", characterId: "poison" },
  { id: "demo-red", color: "red", username: "Husky", characterId: "husky" },
  { id: "demo-green", color: "green", username: "Detective", characterId: "lilya-detective" }
];

function xml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&apos;"
  })[character]);
}

export function buildClassicBoardPreviewSvg() {
  const state = createClassicState(DEMO_ROSTER);

  // A deliberately staged, non-gameplay snapshot: each player has one pawn
  // on the outer route, one in the home lane, and two in their base.
  const sampleTrackProgress = [3, 9, 15, 21];
  for (let index = 0; index < DEMO_ROSTER.length; index += 1) {
    const player = DEMO_ROSTER[index];
    state.tokens[player.id + ":0"].stepProgress = sampleTrackProgress[index];
    state.tokens[player.id + ":1"].stepProgress = 53;
  }

  const pawns = buildTokenRenderModel(state).sort((a, b) =>
    a.anchorY - b.anchorY || a.anchorX - b.anchorX || a.tokenId.localeCompare(b.tokenId)
  );

  const boardData = "data:image/svg+xml;base64," + readAsset("assets/boards/ludo-board-prototype.svg");
  const characterData = new Map(["optimist", "poison", "husky", "lilya-detective"].map((id) => [id, "data:image/webp;base64," + readAsset("assets/characters/" + id + ".webp")]));

  const images = pawns.map((pawn) => {
    const assetPath = characterData.get(pawn.characterId);
    const label = xml(pawn.characterId + " " + pawn.color + " pawn " + pawn.tokenId);
    return `    <image
      href="${xml(assetPath)}"
      x="${pawn.imageX.toFixed(3)}"
      y="${pawn.imageY.toFixed(3)}"
      width="${pawn.width.toFixed(3)}"
      height="${pawn.height.toFixed(3)}"
      preserveAspectRatio="xMidYMax meet"
      data-token-id="${xml(pawn.tokenId)}"
      data-zone="${xml(pawn.zone)}">
      <title>${label}</title>
    </image>`;
  }).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- Geometry-only preview. Temporary source board art; not the final OPTIMIST skin. -->
<svg xmlns="http://www.w3.org/2000/svg"
     xmlns:xlink="http://www.w3.org/1999/xlink"
     width="1000" height="1000" viewBox="0 0 1000 1000">
  <title>OPTIMIST LUDO — classic board token placement preview</title>
  <image href="${boardData}"
         x="0" y="0" width="1000" height="1000"
         preserveAspectRatio="xMidYMid meet"/>
  <g id="pawns">
${images}
  </g>
</svg>
`;
}
