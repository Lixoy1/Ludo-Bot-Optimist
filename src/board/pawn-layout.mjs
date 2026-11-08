import { BOARD, getFinishSlots } from "./classic-geometry.mjs";

const MINI_CELL_OFFSETS = Object.freeze({
  2: [[-0.25, -0.25], [0.25, 0.25]],
  3: [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25]],
  4: [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]]
});

export function getPawnStackLayout(count, pitch = BOARD.grid.cellPitch) {
  if (!Number.isInteger(count) || count < 0 || count > 4) {
    throw new RangeError("Stack count must be 0..4.");
  }
  if (!Number.isFinite(pitch) || pitch <= 0) {
    throw new RangeError("Cell pitch must be positive.");
  }
  if (count === 0) return [];
  if (count === 1) return [{ x: 0, y: 0, scale: 1, slot: 0 }];

  return MINI_CELL_OFFSETS[count].map(([x, y], slot) => ({
    x: x * pitch,
    y: y * pitch,
    scale: 0.5,
    slot
  }));
}

export function getFinishedPawnPositions(color) {
  return getFinishSlots(color);
}

export function getPawnDimensions(character, pitch = BOARD.grid.cellPitch, scale = 1) {
  if (!character || !Number.isFinite(character.width) || !Number.isFinite(character.height) || character.height <= 0) {
    throw new TypeError("Character dimensions required.");
  }
  if (!Number.isFinite(scale) || scale <= 0 || scale > 1) {
    throw new RangeError("Scale must be in (0,1].");
  }

  // A single pawn fills almost the full cell. In a stack, scale 0.5 means
  // one complete mini-cell in the 2x2 layout.
  const height = pitch * scale * 0.94;
  return { width: height * character.width / character.height, height };
}
