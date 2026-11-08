import {
  BOARD,
  baseSlotPoint,
  getFinishSlots,
  getHomeCell,
  getTrackCell
} from "./classic-geometry.mjs";
import { getPawnDimensions, getPawnStackLayout } from "./pawn-layout.mjs";
import { getCharacter } from "../characters.mjs";
import { assertClassicState, globalTrackIndex } from "../engine/classic-engine.mjs";

export const SPRITE_BASELINE_RATIO = 1;
const CELL_INSET_RATIO = 0.03;
const FINISH_TOKEN_SCALE = 0.28;

function imageBox(anchorX, anchorY, size) {
  return {
    anchorX,
    anchorY,
    imageX: anchorX - size.width / 2,
    imageY: anchorY - size.height * SPRITE_BASELINE_RATIO,
    baselineRatio: SPRITE_BASELINE_RATIO
  };
}

function createRenderItem(item, options = {}) {
  const scale = options.scale ?? 1;
  const slotPitch = BOARD.grid.cellPitch * scale;
  const size = getPawnDimensions(item.character, BOARD.grid.cellPitch, scale);
  const anchorX = item.x + (options.offsetX ?? 0);
  const anchorY = item.y + (options.offsetY ?? 0) + slotPitch * (0.5 - CELL_INSET_RATIO);

  return {
    tokenId: item.token.id,
    owner: item.player.id,
    color: item.token.color,
    characterId: item.player.characterId,
    src: item.character.src,
    zone: item.zone,
    progress: item.token.stepProgress,
    baseSlot: item.zone === "base" ? item.token.index : undefined,
    finishSlot: item.zone === "finished" ? item.token.index : undefined,
    trackIndex: item.zone === "track" ? item.trackIndex : undefined,
    homeIndex: item.zone === "home" ? item.homeIndex : undefined,
    cellKey: item.cellKey,
    // Logical location stays at the center of the original game cell/slot.
    x: item.x + (options.offsetX ?? 0),
    y: item.y + (options.offsetY ?? 0),
    width: size.width,
    height: size.height,
    scale,
    slotPitch,
    ...imageBox(anchorX, anchorY, size)
  };
}

export function buildTokenRenderModel(state) {
  assertClassicState(state);

  const players = new Map(state.players.map((player) => [player.id, player]));
  const descriptors = Object.values(state.tokens).map((token) => {
    const player = players.get(token.owner);
    const character = getCharacter(player.characterId);
    const zone = token.stepProgress === -1
      ? "base"
      : token.stepProgress <= 50
        ? "track"
        : token.stepProgress <= 55
          ? "home"
          : "finished";

    if (zone === "base") {
      const point = baseSlotPoint(token.color, token.index);
      return { token, player, character, zone, cellKey: `base:${token.owner}:${token.index}`, ...point };
    }

    if (zone === "track") {
      const trackIndex = globalTrackIndex(token.color, token.stepProgress);
      const point = getTrackCell(trackIndex);
      return { token, player, character, zone, cellKey: `track:${trackIndex}`, trackIndex, x: point.x, y: point.y };
    }

    if (zone === "home") {
      const homeIndex = token.stepProgress - 51;
      const point = getHomeCell(token.color, homeIndex);
      return { token, player, character, zone, cellKey: `home:${token.color}:${homeIndex}`, homeIndex, x: point.x, y: point.y };
    }

    const point = getFinishSlots(token.color)[token.index];
    return { token, player, character, zone, cellKey: `finished:${token.owner}:${token.index}`, ...point };
  });

  const movableGroups = new Map();
  const fixed = [];

  for (const item of descriptors) {
    if (item.zone === "track" || item.zone === "home") {
      const group = movableGroups.get(item.cellKey) ?? [];
      group.push(item);
      movableGroups.set(item.cellKey, group);
    } else {
      fixed.push(item);
    }
  }

  const renderItems = fixed.map((item) => {
    if (item.zone === "finished") {
      return createRenderItem(item, { scale: FINISH_TOKEN_SCALE });
    }
    return createRenderItem(item);
  });

  for (const [cellKey, group] of movableGroups) {
    const layout = getPawnStackLayout(group.length, BOARD.grid.cellPitch);
    group.forEach((item, index) => {
      const slot = layout[index];
      renderItems.push(createRenderItem(item, {
        scale: slot.scale,
        offsetX: slot.x,
        offsetY: slot.y
      }));
    });
  }

  return renderItems;
}
