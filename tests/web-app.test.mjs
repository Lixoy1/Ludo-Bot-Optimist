import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { request } from "node:http";
import { createDevServer } from "../scripts/dev-server.mjs";

test("the browser app loads a responsive board and the interactive game module", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const css = await readFile(new URL("../apps/web/styles.css", import.meta.url), "utf8");
  const js = await readFile(new URL("../apps/web/main.mjs", import.meta.url), "utf8");

  assert.match(html, /id="game-board"/);
  assert.match(html, /id="roll-button"/);
  assert.match(html, /type="module" src="\.\/apps\/web\/main\.mjs"/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(js, /rollClassicDice/);
  assert.match(js, /applyClassicMove/);
  assert.match(js, /createTurnAnimationPlan/);
  assert.match(js, /sampleTurnAnimationPlan/);
  assert.match(js, /buildTokenRenderModel/);
  assert.match(js, /legalTokenIds/);
});

test("the development server serves the app, browser modules and character assets", async (context) => {
  const server = createDevServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));

  const address = server.address();
  const origin = "http://127.0.0.1:" + address.port;
  const checks = [
    ["/", "text/html", "<title>OPTIMIST LUDO"],
    ["/apps/web/main.mjs", "text/javascript", "createTurnAnimationPlan"],
    ["/apps/web/styles.css", "text/css", ".game-board"],
    ["/src/board/movement-animation.mjs", "text/javascript", "sampleTurnAnimationPlan"],
    ["/assets/boards/ludo-board-web.svg", "image/svg+xml", "<svg"],
    ["/assets/characters/optimist.webp", "image/webp", null]
  ];

  for (const [path, mime, marker] of checks) {
    const response = await fetch(origin + path);
    assert.equal(response.status, 200, path);
    assert.ok(response.headers.get("content-type").startsWith(mime), path);
    if (marker) assert.ok((await response.text()).includes(marker), path);
    else assert.ok(Number(response.headers.get("content-length")) > 1000, path);
  }

  const missing = await fetch(origin + "/not-found");
  assert.equal(missing.status, 404);
  const deniedStatus = await new Promise((resolve, reject) => {
    const req = request({
      hostname: "127.0.0.1",
      port: address.port,
      method: "GET",
      path: "/%2e%2e/package.json"
    }, (response) => {
      response.resume();
      response.on("end", () => resolve(response.statusCode));
    });
    req.on("error", reject);
    req.end();
  });
  assert.equal(deniedStatus, 400);
});
