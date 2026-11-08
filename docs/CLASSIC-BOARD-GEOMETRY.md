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

The 12 source characters are portrait WebP images with measured original pixel dimensions recorded in `src/characters.mjs`. Render by normalized height and preserve each image's aspect ratio. A solo pawn uses 94% of the cell height, leaving a narrow inset from the top and bottom borders. When multiple pawns share one cell, switch to a 2×2 mini-cell layout: each pawn uses 50% of the original cell height and gets its own quadrant. Two pawns use opposite quadrants, three use three quadrants, and four fill all four. The same grouping applies across different player colors on a shared outer-track cell. The mini-cell logic changes only visual coordinates; logical movement coordinates remain at the cell centers. Base wells use four fixed anchors.

## Movement contract

The server progress model is:
- -1: base;
- 0–50: 51 outer-track steps for that player's route;
- 51–55: five cells in that player's home lane;
- 56: finished.

The board contains 52 shared outer-track cells. Each color begins at its own start index (YELLOW 0, BLUE 13, RED 26, GREEN 39) and enters its own home lane at `(startIndex + 50) % 52`. The last outer-track cell connects directly to home-lane cell 0; home-lane cell 4 connects directly to that player's finish anchor.

`tokenMovementPath()` returns every intermediate cell, including the destination. For a token leaving base, the path is first `-1 → 0`; later movement is requested from its current progress. The client must animate through the returned sequence in order and must never jump directly from the old position to the final position across multiple cells. The visual renderer must map each path step to the same logical cell coordinate; sprite size and mini-cell offsets must not alter that logical route.

## Geometry preview

Open [CLASSIC-BOARD-TOKEN-PREVIEW.png](./CLASSIC-BOARD-TOKEN-PREVIEW.png) to inspect the raster board preview with 16 demo pawns placed over the source artwork. This PNG is the reliable visual review file; the SVG is retained only as a generated technical artifact. The preview deliberately shows four YELLOW pawns sharing one outer-track cell in a 2×2 mini-grid; BLUE, RED and GREEN each show a solo pawn on the route, one pawn in the home lane, and two in their base. It is a geometry and asset-placement check, not a live game state and not the final OPTIMIST visual skin.

Regenerate the SVG with `npm run build:preview` and the PNG with `npm run build:preview:png` (requires `sharp`). CI publishes the PNG preview automatically. The normal `npm run build` regenerates the canonical coordinate JSON and SVG preview.
