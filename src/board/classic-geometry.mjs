export const BOARD = Object.freeze({
  id: "CLASSIC",
  viewBox: { x: 0, y: 0, width: 1000, height: 1000 },
  grid: { columns: 15, rows: 15, originX: 33.617188, originY: 34.494141, cellPitch: 62.08849 },
  trackLength: 52,
  maxOuterSteps: 50,
  homeCells: 5,
  finishStep: 56,
  players: 4,
  tokensPerPlayer: 4
});

const RAW_TRACK = [
  [1, 6], [2, 6], [3, 6], [4, 6], [5, 6], [6, 5], [6, 4], [6, 3],
  [6, 2], [6, 1], [6, 0], [7, 0], [8, 0], [8, 1], [8, 2], [8, 3],
  [8, 4], [8, 5], [9, 6], [10, 6], [11, 6], [12, 6], [13, 6], [14, 6],
  [14, 7], [14, 8], [13, 8], [12, 8], [11, 8], [10, 8], [9, 8], [8, 9],
  [8, 10], [8, 11], [8, 12], [8, 13], [8, 14], [7, 14], [6, 14], [6, 13],
  [6, 12], [6, 11], [6, 10], [6, 9], [5, 8], [4, 8], [3, 8], [2, 8],
  [1, 8], [0, 8], [0, 7], [0, 6]
];

// Rotate the canonical loop so index 0 is the yellow entry cell.
export const TRACK_GRID = Object.freeze(
  Array.from({ length: 52 }, (_, index) => {
    const [col, row] = RAW_TRACK[(index + 13) % 52];
    return Object.freeze({ index, col, row });
  })
);

const ROWS = {
  yellow: {
    label: "YELLOW",
    startIndex: 0,
    baseCorner: "top-right",
    // The four cells of the 2x2 empty well inside the yellow base.
    baseSlots: [[11, 2], [12, 2], [11, 3], [12, 3]],
    homeLane: [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5]],
    finishCell: [7, 6]
  },
  blue: {
    label: "BLUE",
    startIndex: 13,
    baseCorner: "bottom-right",
    baseSlots: [[11, 11], [12, 11], [11, 12], [12, 12]],
    homeLane: [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]],
    finishCell: [8, 7]
  },
  red: {
    label: "RED",
    startIndex: 26,
    baseCorner: "bottom-left",
    baseSlots: [[2, 11], [3, 11], [2, 12], [3, 12]],
    homeLane: [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9]],
    finishCell: [7, 8]
  },
  green: {
    label: "GREEN",
    startIndex: 39,
    baseCorner: "top-left",
    baseSlots: [[2, 2], [3, 2], [2, 3], [3, 3]],
    homeLane: [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]],
    finishCell: [6, 7]
  }
};

export const PLAYER_CONFIG = Object.freeze(
  Object.fromEntries(
    Object.entries(ROWS).map(([color, config]) => [
      color,
      Object.freeze({
        ...config,
        homeEntryIndex: (config.startIndex + 50) % 52
      })
    ])
  )
);

export const COLORS = Object.freeze(["yellow", "blue", "red", "green"]);
export const SAFE_TRACK_INDICES = Object.freeze([0, 8, 13, 21, 26, 34, 39, 47]);

export function cellCenter(col, row) {
  if (!Number.isInteger(col) || !Number.isInteger(row) || col < 0 || col > 14 || row < 0 || row > 14) {
    throw new RangeError("Grid coordinates must be integers 0..14.");
  }
  const { originX, originY, cellPitch } = BOARD.grid;
  return {
    x: originX + (col + 0.5) * cellPitch,
    y: originY + (row + 0.5) * cellPitch
  };
}

export function baseSlotPoint(color, index) {
  const config = PLAYER_CONFIG[color];
  if (!config || !Number.isInteger(index) || index < 0 || index > 3) {
    throw new RangeError("Invalid base slot.");
  }
  const [col, row] = config.baseSlots[index];
  return cellCenter(col, row);
}

export function getTrackCell(index) {
  if (!Number.isInteger(index) || index < 0 || index >= 52) {
    throw new RangeError("Track index out of range.");
  }
  const point = TRACK_GRID[index];
  return { ...point, ...cellCenter(point.col, point.row) };
}

export function getHomeCell(color, index) {
  const config = PLAYER_CONFIG[color];
  if (!config || !Number.isInteger(index) || index < 0 || index > 4) {
    throw new RangeError("Invalid home cell.");
  }
  const [col, row] = config.homeLane[index];
  return { col, row, index, ...cellCenter(col, row) };
}

export function getFinishAnchor(color) {
  const config = PLAYER_CONFIG[color];
  if (!config) throw new RangeError("Unknown color.");
  const [col, row] = config.finishCell;
  return { col, row, ...cellCenter(col, row) };
}

export function getFinishSlots(color) {
  const anchor = getFinishAnchor(color);
  const offset = BOARD.grid.cellPitch * 0.14;
  return [[-offset, -offset], [offset, -offset], [-offset, offset], [offset, offset]]
    .map(([x, y]) => ({ x: anchor.x + x, y: anchor.y + y }));
}
