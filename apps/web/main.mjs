import {
  COLORS,
  PLAYER_CONFIG
} from "../../src/board/classic-geometry.mjs";
import { createClassicState, rollClassicDice, applyClassicMove } from "../../src/engine/classic-engine.mjs";
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

function imageMarkup(item, { animated = false, legal = false } = {}) {
  const width = Number(item.width);
  const height = Number(item.height);
  const imageX = Number(item.imageX);
  const imageY = Number(item.imageY);
  return `<image
    href="${escapeXml(item.src)}"
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
  rollButton.disabled = isAnimating || state.phase === "finished" || legalTokenIds.length > 0 || state.dice !== null;
  rollButton.textContent = state.dice !== null && legalTokenIds.length > 0 ? "Выбери фишку" : "Бросить кубик";
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

function handleRoll() {
  if (isAnimating || state.phase !== "playing" || state.dice !== null) return;
  const before = state;
  const dice = secureRandomDie();
  const result = rollClassicDice(before, before.currentPlayer, dice);
  state = result.state;
  diceFace.textContent = String(dice);
  diceCaption.textContent = result.skipped
    ? "Три шестёрки — пропуск хода"
    : result.legalTokenIds.length
      ? "Выбери подсвеченную фишку"
      : result.bonusRoll ? "Шестёрка — бросай ещё раз" : "Нет возможных ходов";

  legalTokenIds = result.legalTokenIds;
  render();
  if (result.skipped) {
    setMessage("Три шестёрки подряд. Ход переходит следующему игроку.");
  } else if (legalTokenIds.length) {
    setMessage(`Выпало ${dice}. Нажми на одну из ${legalTokenIds.length} подсвеченных фишек.`);
  } else if (result.bonusRoll) {
    setMessage("Ни одна фишка не может выйти, но шестёрка даёт дополнительный бросок.");
  } else {
    setMessage("Хода нет. Передаём очередь следующему игроку.");
  }
}

function handleTokenClick(tokenId) {
  if (isAnimating || !legalTokenIds.includes(tokenId)) return;
  const before = state;
  const result = applyClassicMove(before, before.currentPlayer, tokenId);
  state = result.state;
  legalTokenIds = [];
  selectedTokenId = tokenId;
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
      selectedTokenId = null;
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
  cancelAnimationFrame(animationFrame);
  isAnimating = false;
  state = createClassicState(PLAYERS);
  legalTokenIds = [];
  selectedTokenId = null;
  lastDice = null;
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
