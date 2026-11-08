import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildCoordinateMap } from "../src/board/coordinates.mjs";
const output = resolve(process.cwd(), "Coordinates_Map.json");
await writeFile(output, JSON.stringify(buildCoordinateMap(), null, 2) + "\n", "utf8");
console.log("Wrote " + output);
