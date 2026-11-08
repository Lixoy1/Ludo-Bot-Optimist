import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createDevServer } from "./dev-server.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const server = createDevServer();
await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", resolve);
});

let browser;
try {
  const address = server.address();
  const origin = "http://127.0.0.1:" + address.port;
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true
  });
  const pageErrors = [];
  const failedRequests = [];

  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("requestfailed", (request) => failedRequests.push(request.url() + " — " + (request.failure()?.errorText ?? "failed")));

  const response = await page.goto(origin + "/", { waitUntil: "networkidle" });
  if (!response?.ok()) throw new Error("Browser app returned HTTP " + response?.status());

  await page.locator("#pawn-layer image[data-token-id]").first().waitFor();
  const startingPawnCount = await page.locator("#pawn-layer image[data-token-id]").count();
  if (startingPawnCount !== 16) throw new Error("Expected 16 starting pawns, received " + startingPawnCount);

  const boardImageUrl = await page.locator("#game-board > image").getAttribute("href");
  const boardResponse = await page.request.get(new URL(boardImageUrl, origin).toString());
  if (!boardResponse.ok()) throw new Error("Board image did not load: " + boardResponse.status());

  let legalCount = 0;
  let rolls = 0;
  while (legalCount === 0 && rolls < 60) {
    const button = page.locator("#roll-button");
    if (!(await button.isEnabled())) {
      await page.waitForTimeout(50);
    } else {
      await button.click();
      rolls += 1;
    }
    legalCount = await page.locator("#pawn-layer image.is-legal").count();
  }

  if (legalCount === 0) throw new Error("No movable pawn was offered after " + rolls + " rolls.");

  const selectedPawn = page.locator("#pawn-layer image.is-legal").first();
  const tokenId = await selectedPawn.getAttribute("data-token-id");
  const revisionBeforeMove = Number((await page.locator("#game-revision").textContent()).replace(/\\D/g, ""));
  await selectedPawn.click();

  await page.waitForFunction((expected) => {
    const value = document.querySelector("#game-revision")?.textContent ?? "";
    return Number(value.replace(/\\D/g, "")) === expected;
  }, revisionBeforeMove + 1, { timeout: 5000 });
  await page.waitForFunction(() => document.querySelector("#legal-hint")?.textContent.includes("дополнительный бросок") ||
    document.querySelector("#legal-hint")?.textContent.includes("Ход завершён"), null, { timeout: 5000 });

  if (pageErrors.length) throw new Error("Browser JavaScript errors: " + pageErrors.join(" | "));
  if (failedRequests.length) throw new Error("Browser network failures: " + failedRequests.join(" | "));

  const screenshotPath = resolve(ROOT, "dist/browser-smoke.png");
  await mkdir(dirname(screenshotPath), { recursive: true });
  await page.screenshot({ path: screenshotPath, fullPage: true });
  process.stdout.write(JSON.stringify({
    status: "passed",
    viewport: "390x844",
    startingPawns: startingPawnCount,
    rollsUntilMove: rolls,
    selectedToken: tokenId,
    revisionAfterMove: revisionBeforeMove + 1,
    screenshot: "dist/browser-smoke.png"
  }) + "\n");
} finally {
  if (browser) await browser.close();
  await new Promise((resolve) => server.close((error) => error ? process.stderr.write(String(error) + "\n") : resolve()));
}
