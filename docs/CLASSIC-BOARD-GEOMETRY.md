# CLASSIC board geometry contract

## Immutable source

`assets/boards/ludo-board-prototype.svg` is the untouched Alpha Arts / Openclipart CC0 reference. Its SVG viewBox is 1000 × 1000. The OPTIMIST drawing will replace surface styling only; the board must not be cropped, stretched, rotated or re-proportioned.

## Coordinate transform

- Logical grid: 15 columns × 15 rows.
- SVG grid origin: (33.617188, 34.494141).
- Cell pitch: 62.08849 SVG units.
- A cell pawn anchor is its geometric centre: origin + (index + 0.5) × pitch.
- Base pawn anchors are centres of the four 2×2 wells inside each 4×4 base inset.
- Four finish anchors occupy the innermost coloured approach cells.

All overlay elements use the same 1000 × 1000 SVG coordinate space. Rendering uses preserveAspectRatio="xMidYMid meet" or an equivalent square container; never independently scale X and Y.

## Track and colour orientation

The 52-cell loop proceeds clockwise, beginning at the YELLOW entry on the top arm:

- YELLOW: top-right base, top home lane, start index 0.
- BLUE: bottom-right base, right home lane, start index 13.
- RED: bottom-left base, bottom home lane, start index 26.
- GREEN: top-left base, left home lane, start index 39.

Each player has four pawns, five home-lane cells, and a player-specific finish anchor. Safe indices are 0, 8, 13, 21, 26, 34, 39 and 47.

## Pawn art sizing

The 12 source characters are portrait WebP images with measured original pixel dimensions recorded in `src/characters.mjs`. Render by normalized height and preserve each image's aspect ratio. Recommended full-cell height is 84% of cell pitch. For two pieces on one cell use 48% size; for three/four use 42% and a compact 2×2 arrangement. Base wells use four fixed anchors.

## Movement contract

The server progress model is:
- -1: base;
- 0–50: outer track;
- 51–55: five home cells;
- 56: finished.

`tokenMovementPath()` returns every intermediate cell, including the destination. The client must animate through the returned sequence in order. It must never lerp directly from the old position to the final position across multiple cells.

## Geometry preview

Open [CLASSIC-BOARD-TOKEN-PREVIEW.svg](./CLASSIC-BOARD-TOKEN-PREVIEW.svg) to inspect the board with the 12 demo pawns placed over the source artwork. The preview deliberately stages one token per player on the outer route, one in the home lane, and two in the base. It is a geometry and asset-placement check, not a live game state and not the final OPTIMIST visual skin.

Regenerate it with `npm run build:preview`. The normal `npm run build` regenerates both the canonical coordinate JSON and this SVG preview.
