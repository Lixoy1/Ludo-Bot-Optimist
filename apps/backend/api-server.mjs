import { createServer } from "node:http";
import { RoomService } from "./room-service.mjs";

const MAX_BODY_BYTES = 16 * 1024;

function send(response, status, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    "cache-control": "no-store",
    "x-content-type-options": "nosniff"
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
  if (/authentication failed/.test(error.message)) return 401;
  if (/not found or expired/.test(error.message)) return 404;
  if (/not your turn|Only the room host|full|not accepting|already started|At least two|not started|There is no pending move|Illegal move|cannot be rolled/.test(error.message)) return 409;
  if (/required|Unknown character|Unknown/.test(error.message)) return 400;
  return 400;
}

export function createApiServer({ service = new RoomService() } = {}) {
  return createServer(async (request, response) => {
    if (request.method !== "GET" && request.method !== "POST") {
      send(response, 405, { error: "Method not allowed." });
      return;
    }

    let url;
    try {
      url = new URL(request.url ?? "/", "http://localhost");
    } catch {
      send(response, 400, { error: "Invalid URL." });
      return;
    }

    try {
      if (request.method === "POST" && url.pathname === "/api/rooms") {
        const body = await readJson(request);
        const result = service.createRoom(body);
        send(response, 201, result);
        return;
      }

      const match = url.pathname.match(/^\/api\/rooms\/([A-HJ-NP-Z2-9]{6})(?:\/(join|start|roll|move))?$/i);
      if (!match) {
        send(response, 404, { error: "Endpoint not found." });
        return;
      }

      const [, roomId, action] = match;
      const auth = credentials(request);

      if (request.method === "GET" && !action) {
        send(response, 200, service.getRoom(roomId, auth.playerId, auth.secret));
        return;
      }
      if (request.method !== "POST" || !action) {
        send(response, 405, { error: "Method not allowed." });
        return;
      }

      if (action === "join") {
        send(response, 200, service.joinRoom(roomId, await readJson(request)));
      } else if (action === "start") {
        send(response, 200, service.startRoom(roomId, auth.playerId, auth.secret));
      } else if (action === "roll") {
        send(response, 200, service.roll(roomId, auth.playerId, auth.secret));
      } else if (action === "move") {
        const body = await readJson(request);
        if (typeof body.tokenId !== "string") throw Object.assign(new Error("tokenId is required."), { status: 400 });
        send(response, 200, service.move(roomId, auth.playerId, auth.secret, body.tokenId));
      }
    } catch (error) {
      send(response, statusFor(error), { error: error.message || "Request failed." });
    }
  });
}
