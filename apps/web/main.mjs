import {
  COLORS,
  PLAYER_CONFIG
} from "../../src/board/classic-geometry.mjs";
import { createClassicState, rollClassicDice, applyClassicMove, legalMoves } from "../../src/engine/classic-engine.mjs";
import { buildTokenRenderModel } from "../../src/board/token-render-model.mjs";
import { createTurnAnimationPlan, sampleTurnAnimationPlan } from "../../src/board/movement-animation.mjs";

const PALETTE = Object.freeze({
  yellow: "#f4bf2a",
  blue: "#3997ff",
  red: "#ff5555",
  green: "#34c56b"
});
const PLAYERS = Object.freeze([
  { id: "yellow", color: "yellow", username: "OPTIMIST", characterId: "optimist" },
  { id: "blue", color: "blue", username: "POISON", characterId: "poison" },
  { id: "red", color: "red", username: "HUSKY", characterId: "husky" },
  { id: "green", color: "green", username: "DETECTIVE", characterId: "lilya-detective" }
]);
const $ = (selector) => document.querySelector(selector);
const layer = $("#pawn-layer");
const rollButton = $("#roll-button");
const newGameButton = $("#new-game-button");
const diceFace = $("#dice-face");
const diceCaption = $("#dice-caption");
const turnPlayer = $("#turn-player");
const turnHint = $("#turn-hint");
const legalHint = $("#legal-hint");
const playerList = $("#player-list");
const revisionLabel = $("#game-revision");
const liveStatus = $("#live-status");

let state = createClassicState(PLAYERS);
let legalTokenIds = [];
let isAnimating = false;
let animationFrame = 0;

let network = null;
let networkRoomStatus = null;
let networkSocket = null;
const networkPanel = document.createElement("section");
networkPanel.className = "network-panel";
networkPanel.innerHTML = `
  <div class="eyebrow">СЕТЕВАЯ ПАРТИЯ</div>
  <div class="network-actions">
    <button id="create-room" class="secondary-button" type="button">Создать комнату</button>
    <button id="join-room" class="secondary-button" type="button">Войти по коду</button>
    <button id="start-room" class="primary-button" type="button" hidden>Начать партию</button>
  </div>
  <div id="room-status" class="dice-caption" aria-live="polite">Пока локальная игра</div>
  <div id="room-code" class="room-code" hidden></div>`;
$(".game-panel").insertBefore(networkPanel, newGameButton);
const roomStatus = networkPanel.querySelector("#room-status");
const roomCode = networkPanel.querySelector("#room-code");
const startRoomButton = networkPanel.querySelector("#start-room");
const createRoomButton = networkPanel.querySelector("#create-room");
const joinRoomButton = networkPanel.querySelector("#join-room");
const API_BASE = window.OPTIMIST_API_BASE || "http://localhost:4174";
const API_URL = new URL(API_BASE, location.href);
function savedCredentials() {
  try { return JSON.parse(sessionStorage.getItem("optimist-ludo-player") || "null"); } catch { return null; }
}
function saveCredentials(value) { sessionStorage.setItem("optimist-ludo-player", JSON.stringify(value)); }
async function api(path, {method="GET", body, auth=true}={}) {
  const headers = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  if (auth && network) {
    headers["x-player-id"] = network.playerId;
    headers["x-player-secret"] = network.playerSecret;
  }
  const response = await fetch(new URL(path, API_URL).toString(), {method, headers, body: body === undefined ? undefined : JSON.stringify(body)});
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Ошибка сетевого запроса");
  return payload;
}
function showNetworkError(error) {
  roomStatus.textContent = error?.message || "Не удалось выполнить запрос";
}
function applyRoom(room) {
  if (!room) return;
  networkRoomStatus = room.status;
  if (room.state) {
    state = room.state;
    legalTokenIds = state.dice === null ? [] : legalMoves(state, network.playerId);
    diceFace.textContent = state.dice === null ? "—" : String(state.dice);
    diceCaption.textContent = state.dice === null ? "Ожидает броска" : "Выбери подсвеченную фишку";
    render();
  } else {
    renderControls();
  }
  const host = room.players?.[0]?.id === network?.playerId;
  startRoomButton.hidden = !(host && room.status === "waiting" && room.players.length >= 2);
  roomStatus.textContent = room.status === "waiting"
    ? `Ожидание игроков: ${room.players.length}/4`
    : room.status === "finished" ? "Партия завершена" : "Сетевая партия активна";
  roomCode.hidden = false;
  roomCode.textContent = "КОД КОМНАТЫ: " + room.id;
}
let reconnectTimer = null;
let reconnectAttempt = 0;
let socketGeneration = 0;
let reconnecting = false;
const MAX_RECONNECT_DELAY_MS = 15_000;

function scheduleRoomReconnect() {
  if (!network || reconnectTimer || reconnecting) return;
  const delay = Math.min(1000 * (2 ** reconnectAttempt), MAX_RECONNECT_DELAY_MS);
  reconnectAttempt = Math.min(reconnectAttempt + 1, 5);
  roomStatus.textContent = `Соединение потеряно. Повтор через ${Math.ceil(delay / 1000)} сек.`;
  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;
    await openRoomSocket(true);
  }, delay);
}

async function openRoomSocket(refreshRoom = false) {
  if (!network || reconnecting) return;
  reconnecting = true;
  const generation = ++socketGeneration;
  try {
    if (refreshRoom) applyRoom(await api("/api/rooms/" + network.roomId));
    const {ticket} = await api("/api/rooms/" + network.roomId + "/ticket", {method:"POST"});
    if (generation !== socketGeneration || !network) return;
    const scheme = API_URL.protocol === "https:" ? "wss:" : "ws:";
    const socket = new WebSocket(scheme + "//" + API_URL.host + "/api/rooms/" + network.roomId + "/events?ticket=" + encodeURIComponent(ticket));
    networkSocket = socket;
    socket.addEventListener("open", () => {
      if (socket !== networkSocket) return;
      reconnectAttempt = 0;
      roomStatus.textContent = "Соединение восстановлено";
    });
    socket.addEventListener("message", event => {
      if (socket !== networkSocket) return;
      try {
        const message = JSON.parse(event.data);
        if (message.type === "room:update") {
          legalTokenIds = [];
          applyRoom(message.room);
        }
      } catch {}
    });
    socket.addEventListener("close", () => {
      if (socket !== networkSocket) return;
      networkSocket = null;
      scheduleRoomReconnect();
    });
    socket.addEventListener("error", () => {
      if (socket === networkSocket) socket.close();
    });
  } catch (error) {
    if (generation === socketGeneration) {
      roomStatus.textContent = "Не удалось подключиться. Повторяем…";
      scheduleRoomReconnect();
    }
  } finally {
    reconnecting = false;
  }
}

async function connectRoom(result) {
  network = {roomId: result.room.id, playerId: result.playerId, playerSecret: result.playerSecret};
  saveCredentials(network);
  applyRoom(result.room);
  reconnectAttempt = 0;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = null;
  networkSocket?.close();
  networkSocket = null;
  roomStatus.textContent = "Подключаемся к комнате…";
  await openRoomSocket(false);
}
createRoomButton.addEventListener("click", async () => {
  const username = prompt("Твоё имя в игре:", "OPTIMIST");
  if (!username) return;
  try { await connectRoom(await api("/api/rooms", {method:"POST", auth:false, body:{username, characterId:"optimist"}})); }
  catch (error) { showNetworkError(error); }
});
joinRoomButton.addEventListener("click", async () => {
  const code = prompt("Введи шестизначный код комнаты:");
  if (!code) return;
  const username = prompt("Твоё имя в игре:", "PLAYER");
  if (!username) return;
  try {
    const joined = await api("/api/rooms/" + encodeURIComponent(code.trim().toUpperCase()) + "/join", {method:"POST", auth:false, body:{username, characterId:"poison"}});
    await connectRoom(joined);
  } catch (error) { showNetworkError(error); }
});
startRoomButton.addEventListener("click", async () => {
  if (!network) return;
  try { applyRoom(await api("/api/rooms/" + network.roomId + "/start", {method:"POST"})); }
  catch (error) { showNetworkError(error); }
});
const priorCredentials = savedCredentials();
if (priorCredentials?.roomId && priorCredentials?.playerId && priorCredentials?.playerSecret) {
  network = priorCredentials;
  openRoomSocket(true).catch(() => {});
}


function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;"
  })[character]);
}

function secureRandomDie() {
  const values = new Uint32Array(1);
  const limit = Math.floor(0x100000000 / 6) * 6;
  do {
    crypto.getRandomValues(values);
  } while (values[0] >= limit);
  return (values[0] % 6) + 1;
}

function playerFor(id) {
  return state.players.find((player) => player.id === id);
}

function colorLabel(color) {
  return ({ yellow: "ЖЁЛТЫЙ", blue: "СИНИЙ", red: "КРАСНЫЙ", green: "ЗЕЛЁНЫЙ" })[color] ?? color.toUpperCase();
}

function describeCurrentTurn() {
  const player = playerFor(state.currentPlayer);
  if (!player) return;
  turnPlayer.textContent = colorLabel(player.color);
  turnPlayer.style.color = PALETTE[player.color];
  const count = Object.values(state.tokens).filter((token) => token.owner === player.id && token.stepProgress === 56).length;
  turnHint.textContent = state.phase === "finished"
    ? "Партия завершена."
    : count > 0 ? `На финише: ${count} из 4 фишек.` : "Твой ход. Бросай кубик.";
}

function renderPlayers() {
  playerList.innerHTML = state.players.map((player) => {
    const atFinish = Object.values(state.tokens).filter((token) => token.owner === player.id && token.stepProgress === 56).length;
    const onBoard = Object.values(state.tokens).filter((token) => token.owner === player.id && token.stepProgress >= 0 && token.stepProgress < 56).length;
    const current = state.currentPlayer === player.id;
    return `<div class="player-row ${current ? "is-current" : ""}">
      <span class="player-dot" style="background:${PALETTE[player.color]}"></span>
      <span class="player-name">${escapeXml(player.username)}</span>
      <span class="player-count">${onBoard}/4 · ${atFinish} финиш</span>
    </div>`;
  }).join("");
}

function assetUrl(path) {
  const value = String(path);
  return new URL(value.startsWith("/") ? value.slice(1) : value, document.baseURI).href;
}

function imageMarkup(item, { animated = false, legal = false } = {}) {
  const width = Number(item.width);
  const height = Number(item.height);
  const imageX = Number(item.imageX);
  const imageY = Number(item.imageY);
  return `<image
    href="${escapeXml(assetUrl(item.src))}"
    x="${imageX.toFixed(3)}"
    y="${imageY.toFixed(3)}"
    width="${width.toFixed(3)}"
    height="${height.toFixed(3)}"
    preserveAspectRatio="xMidYMax meet"
    class="${animated ? "animation-image" : "pawn-image"}${legal ? " is-legal" : ""}"
    data-token-id="${escapeXml(item.tokenId)}"
    ${legal ? 'tabindex="0"' : ""}
    role="${legal ? "button" : "img"}"
    aria-label="${escapeXml(item.characterId)} · ${escapeXml(item.color)}">
    <title>${escapeXml(item.characterId)} — ${escapeXml(item.color)}</title>
  </image>`;
}

function renderBoard(sample = null) {
  const suppressed = new Set(sample?.suppressedTokenIds ?? []);
  const pawns = buildTokenRenderModel(state);
  const markup = [];

  for (const pawn of pawns) {
    if (suppressed.has(pawn.tokenId)) continue;
    const legal = legalTokenIds.includes(pawn.tokenId);
    if (legal) {
      markup.push(`<circle class="legal-ring" cx="${pawn.x.toFixed(3)}" cy="${pawn.y.toFixed(3)}" r="${Math.max(13, pawn.width * 0.62).toFixed(3)}"></circle>`);
    }
    markup.push(imageMarkup(pawn, { legal }));
  }

  if (sample && !sample.mover.done) {
    markup.push(imageMarkup(sample.mover, { animated: true }));
  }
  if (sample) {
    for (const capture of sample.captures) {
      if (capture.active) markup.push(imageMarkup(capture, { animated: true }));
    }
  }

  layer.innerHTML = markup.join("");
  layer.querySelectorAll("[data-token-id].is-legal").forEach((image) => {
    image.addEventListener("click", () => handleTokenClick(image.dataset.tokenId));
    image.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handleTokenClick(image.dataset.tokenId);
      }
    });
  });
}

function renderControls() {
  describeCurrentTurn();
  renderPlayers();
  revisionLabel.textContent = "ХОД " + state.revision;
  rollButton.disabled = isAnimating || state.phase === "finished" || legalTokenIds.length > 0 || state.dice !== null || (network && (networkRoomStatus !== "playing" || state.currentPlayer !== network.playerId));
  rollButton.textContent = state.dice !== null && legalTokenIds.length > 0 ? "Выбери фишку" : "Бросить кубик";
  if (network && networkRoomStatus === "waiting") turnHint.textContent = "Ожидаем второго игрока. Код комнаты выше.";
  if (state.phase === "finished") {
    const winner = playerFor(state.winner);
    turnHint.textContent = (winner?.username ?? "Игрок") + " победил!";
    rollButton.disabled = true;
  }
}

function render() {
  renderBoard();
  renderControls();
}

function setMessage(message) {
  legalHint.textContent = message;
  liveStatus.textContent = message;
}

async function handleRoll() {
  if (isAnimating || state.phase !== "playing" || state.dice !== null) return;
  try {
    let result;
    if (network) {
      if (state.currentPlayer !== network.playerId) return;
      result = await api("/api/rooms/" + network.roomId + "/roll", { method: "POST" });
      state = result.room.state;
    } else {
      const dice = secureRandomDie();
      result = rollClassicDice(state, state.currentPlayer, dice);
      state = result.state;
    }
    const dice = result.dice ?? state.lastAction?.dice;
    diceFace.textContent = String(dice ?? "—");
    diceCaption.textContent = result.skipped
      ? "Три шестёрки — пропуск хода"
      : result.legalTokenIds.length
        ? "Выбери подсвеченную фишку"
        : result.bonusRoll ? "Шестёрка — бросай ещё раз" : "Нет возможных ходов";
    legalTokenIds = result.legalTokenIds ?? [];
    render();
    if (result.skipped) setMessage("Три шестёрки подряд. Ход переходит следующему игроку.");
    else if (legalTokenIds.length) setMessage(`Выпало ${dice}. Нажми на одну из ${legalTokenIds.length} подсвеченных фишек.`);
    else if (result.bonusRoll) setMessage("Ни одна фишка не может выйти, но шестёрка даёт дополнительный бросок.");
    else setMessage("Хода нет. Передаём очередь следующему игроку.");
  } catch (error) {
    showNetworkError(error);
    if (network) {
      try { applyRoom(await api("/api/rooms/" + network.roomId)); } catch {}
    }
  }
}

async function handleTokenClick(tokenId) {
  if (isAnimating || !legalTokenIds.includes(tokenId)) return;
  const before = state;
  let result;
  try {
    if (network) {
      if (state.currentPlayer !== network.playerId) return;
      result = await api("/api/rooms/" + network.roomId + "/move", { method: "POST", body: { tokenId } });
      state = result.room.state;
    } else {
      result = applyClassicMove(before, before.currentPlayer, tokenId);
      state = result.state;
    }
  } catch (error) {
    showNetworkError(error);
    if (network) {
      try { applyRoom(await api("/api/rooms/" + network.roomId)); } catch {}
    }
    return;
  }
  legalTokenIds = [];
  const plan = createTurnAnimationPlan(before, state);
  isAnimating = true;
  renderControls();

  const startedAt = performance.now();
  cancelAnimationFrame(animationFrame);
  const tick = (now) => {
    const sample = sampleTurnAnimationPlan(plan, now - startedAt);
    renderBoard(sample);
    if (!sample.done) {
      animationFrame = requestAnimationFrame(tick);
    } else {
      isAnimating = false;
      render();
      if (state.phase === "finished") {
        setMessage("Победа! " + (playerFor(state.winner)?.username ?? "") + " завершил все четыре фишки.");
      } else if (result.bonusRoll) {
        setMessage("Отлично! Получаешь дополнительный бросок.");
        diceCaption.textContent = "Дополнительный ход";
      } else {
        setMessage("Ход завершён. Теперь играет " + colorLabel(playerFor(state.currentPlayer).color) + ".");
        diceCaption.textContent = "Ожидает броска";
      }
    }
  };
  animationFrame = requestAnimationFrame(tick);
}

function startNewGame() {
  if (network) { setMessage("Чтобы начать новую сетевую партию, создай новую комнату."); return; }
  cancelAnimationFrame(animationFrame);
  isAnimating = false;
  state = createClassicState(PLAYERS);
  legalTokenIds = [];
  diceFace.textContent = "—";
  diceCaption.textContent = "Ожидает броска";
  setMessage("Новая партия. Для выхода из базы нужна шестёрка.");
  render();
}

rollButton.addEventListener("click", handleRoll);
newGameButton.addEventListener("click", startNewGame);

if (PLAYER_CONFIG[PLAYERS[0].color] === undefined || COLORS.length !== 4) {
  throw new Error("Classic color mapping is inconsistent.");
}

setMessage("Новая партия. Для выхода из базы нужна шестёрка.");
render();
