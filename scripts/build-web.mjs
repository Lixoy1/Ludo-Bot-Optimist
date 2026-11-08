import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = resolve(ROOT, "dist");

await rm(DIST, { recursive: true, force: true });
await mkdir(DIST, { recursive: true });

async function copy(source, target) {
  await mkdir(dirname(target), { recursive: true });
  await cp(resolve(ROOT, source), target, { recursive: true });
}

await copy("index.html", resolve(DIST, "index.html"));
await copy("apps/web", resolve(DIST, "apps/web"));
await copy("src", resolve(DIST, "src"));
await copy("assets/boards/ludo-board-web.svg", resolve(DIST, "assets/boards/ludo-board-web.svg"));
await copy("assets/characters", resolve(DIST, "assets/characters"));
await writeFile(resolve(DIST, ".nojekyll"), "");
console.log("Built static browser demo in " + DIST);
