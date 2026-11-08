import { randomBytes } from "node:crypto";
import { WebSocketServer, WebSocket } from "ws";

const tickets = new Map();
const TICKET_TTL_MS = 30_000;

export function issueRealtimeTicket(roomId, playerId) {
  const ticket = randomBytes(24).toString("base64url");
  tickets.set(ticket, { roomId, playerId, expiresAt: Date.now() + TICKET_TTL_MS });
  return ticket;
}
function consumeTicket(ticket, roomId) {
  const entry = tickets.get(ticket);
  tickets.delete(ticket);
  if (!entry || entry.roomId !== roomId || entry.expiresAt < Date.now()) return null;
  return entry;
}
export function attachRealtime(server, service) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 1024 });
  const clients = new Map();
  server.on("upgrade", (request, socket, head) => {
    let url;
    try { url = new URL(request.url ?? "/", "http://localhost"); } catch { socket.destroy(); return; }
    const match = url.pathname.match(/^\/api\/rooms\/([A-HJ-NP-Z2-9]{6})\/events$/i);
    if (!match) { socket.destroy(); return; }
    const roomId = match[1].toUpperCase();
    const auth = consumeTicket(url.searchParams.get("ticket"), roomId);
    if (!auth) { socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n"); socket.destroy(); return; }
    wss.handleUpgrade(request, socket, head, (ws) => {
      const set = clients.get(roomId) ?? new Set();
      set.add(ws); clients.set(roomId, set);
      ws.send(JSON.stringify({ type: "connected", roomId }));
      ws.on("close", () => { set.delete(ws); if (!set.size) clients.delete(roomId); });
      ws.on("error", () => { set.delete(ws); if (!set.size) clients.delete(roomId); });
    });
  });
  const broadcast = (room) => {
    const set = clients.get(room.id);
    if (!set) return;
    const payload = JSON.stringify({ type: "room:update", room });
    for (const ws of set) if (ws.readyState === WebSocket.OPEN) ws.send(payload);
  };
  service.on("room:update", broadcast);
  wss.on("close", () => service.off("room:update", broadcast));
  return wss;
}
