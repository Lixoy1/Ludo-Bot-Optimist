import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.PORT ?? 4173);
const HOST = process.env.HOST ?? "0.0.0.0";

const MIME = Object.freeze({
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".ico": "image/x-icon"
});

export function createDevServer(root = ROOT) {
  const appRoot = resolve(root);
  return createServer(async (request, response) => {
    if (!["GET", "HEAD"].includes(request.method ?? "GET")) {
      response.writeHead(405, { "content-type": "text/plain; charset=utf-8", allow: "GET, HEAD" });
      response.end("Method not allowed");
      return;
    }

    let pathname;
    try {
      pathname = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname);
    } catch {
      response.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
      response.end("Bad request");
      return;
    }

    if (pathname.includes("\\0") || pathname.includes("\\")) {
      response.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
      response.end("Invalid path");
      return;
    }

    const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
    let filePath = resolve(appRoot, relative);
    if (filePath !== appRoot && !filePath.startsWith(appRoot + sep)) {
      response.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
      response.end("Forbidden");
      return;
    }

    try {
      const info = await stat(filePath);
      if (info.isDirectory()) filePath = resolve(filePath, "index.html");
      const body = await readFile(filePath);
      response.writeHead(200, {
        "content-type": MIME[extname(filePath).toLowerCase()] ?? "application/octet-stream",
        "content-length": body.length,
        "cache-control": "no-store",
        "x-content-type-options": "nosniff"
      });
      response.end(request.method === "HEAD" ? undefined : body);
    } catch (error) {
      const status = error?.code === "ENOENT" || error?.code === "ENOTDIR" ? 404 : 500;
      response.writeHead(status, { "content-type": "text/plain; charset=utf-8" });
      response.end(status === 404 ? "Not found" : "Internal server error");
    }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = createDevServer();
  server.listen(PORT, HOST, () => {
    process.stdout.write(`OPTIMIST LUDO demo: http://localhost:${PORT}\n`);
  });
}
