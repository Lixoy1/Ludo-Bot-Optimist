import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildClassicBoardPreviewSvg } from "../src/board/preview.mjs";

const output = resolve(process.cwd(), "docs/CLASSIC-BOARD-TOKEN-PREVIEW.svg");
await writeFile(output, buildClassicBoardPreviewSvg(), "utf8");
console.log("Wrote " + output);
