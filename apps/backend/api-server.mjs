import { issueRealtimeTicket } from "./realtime.mjs";
import { createServer } from "node:http";
import { RoomService } from "./room-service.mjs";

const MAX_BODY_BYTES = 16 * 1024;

function send(response, status, payload, origin = null) {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    ...(origin ? { "access-control-allow-origin": origin, "access-control-allow-headers": "content-type,x-player-id,x-player-secret", "access-control-allow-methods": "GET,POST,OPTIONS", "vary": "Origin" } : {})
  });
  response.end(body);
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw Object.assign(new Error("Request body is too large."), { status: 413 });
    chunks.push(chunk);
  }
  if (!size) return {};
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
    return value;
  } catch {
    throw Object.assign(new Error("Request body must be a JSON object."), { status: 400 });
  }
}

function credentials(request) {
  return {
    playerId: request.headers["x-player-id"],
    secret: request.headers["x-player-secret"]
  };
}

function statusFor(error) {
  if (error.status) return error.status;
  if (error.code === "ROOM_CONFLICT") return 409;
  if (/authentication failed/.test(error.message)) return 401;
  if (/not found or expired/.test(error.message)) return 404;
  if (/not your turn|Only the room host|full|not accepting|already started|At least two|not started|There is no pending move|Illegal move|cannot be rolled/.test(error.message)) return 409;
  if (/required|Unknown character|Unknown/.test(error.message)) return 400;
  return 400;
}

export function createApiServer({ service = new RoomService() } = {}) {
  return createServer(async (request, response) => {
    const requestOrigin = request.headers.origin;
    const allowedOrigins = new Set(["http://localhost:4173", "http://127.0.0.1:4173", ...(process.env.WEB_ORIGIN ? process.env.WEB_ORIGIN.split(",").map(value => value.trim()) : [])]);
    const corsOrigin = requestOrigin && allowedOrigins.has(requestOrigin) ? requestOrigin : null;
    if (request.method === "OPTIONS") {
      if (!corsOrigin) { send(response, 403, { error: "Origin not allowed." }); return; }
      response.writeHead(204, { "access-control-allow-origin": corsOrigin, "access-control-allow-headers": "content-type,x-player-id,x-player-secret", "access-control-allow-methods": "GET,POST,OPTIONS", "access-control-max-age": "600", "vary": "Origin" });
      response.end(); return;
    }
    if (requestOrigin && !corsOrigin) { send(response, 403, { error: "Origin not allowed." }); return; }
    if (request.method !== "GET" && request.method !== "POST") {
      send(response, 405, { error: "Method not allowed." }, corsOrigin);
      return;
    }

    let url;
    try {
      url = new URL(request.url ?? "/", "http://localhost");
    } catch {
      send(response, 400, { error: "Invalid URL." }, corsOrigin);
      return;
    }

    try {
      if (request.method === "POST" && url.pathname === "/api/rooms") {
        const body = await readJson(request);
        const result = await service.createRoom(body);
        send(response, 201, result, corsOrigin);
        return;
      }

      const match = url.pathname.match(/^\/api\/rooms\/([A-HJ-NP-Z2-9]{6})(?:\/(join|start|roll|move|ticket))?$/i);
      if (!match) {
        send(response, 404, { error: "Endpoint not found." }, corsOrigin);
        return;
      }

      const [, roomId, action] = match;
      const auth = credentials(request);

      if (request.method === "POST" && action === "ticket") {
        const room = await service.getRoom(roomId, auth.playerId, auth.secret);
        send(response, 200, { ticket: issueRealtimeTicket(roomId.toUpperCase(), auth.playerId), expiresInSeconds: 30 }, corsOrigin);
        return;
      }

      if (request.method === "GET" && !action) {
        send(response, 200, await service.getRoom(roomId, auth.playerId, auth.secret), corsOrigin);
        return;
      }
      if (request.method !== "POST" || !action) {
        send(response, 405, { error: "Method not allowed." }, corsOrigin);
        return;
      }

      if (action === "join") {
        send(response, 200, await service.joinRoom(roomId, await readJson(request)), corsOrigin);
      } else if (action === "start") {
        send(response, 200, await service.startRoom(roomId, auth.playerId, auth.secret), corsOrigin);
      } else if (action === "roll") {
        send(response, 200, await service.roll(roomId, auth.playerId, auth.secret), corsOrigin);
      } else if (action === "move") {
        const body = await readJson(request);
        if (typeof body.tokenId !== "string") throw Object.assign(new Error("tokenId is required."), { status: 400 });
        send(response, 200, await service.move(roomId, auth.playerId, auth.secret, body.tokenId), corsOrigin);
      }
    } catch (error) {
      send(response, statusFor(error), { error: error.message || "Request failed." }, corsOrigin);
    }
  });
}
