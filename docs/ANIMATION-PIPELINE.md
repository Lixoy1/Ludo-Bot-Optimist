# CLASSIC movement animation pipeline

The animation layer is a deterministic presentation module. The game engine remains authoritative: it commits the new state first, and the client then animates from the previous state to that committed state.

## Files

- `src/board/movement-animation.mjs`: builds cell-by-cell movement and capture timelines and samples them at any elapsed time.
- `src/board/coordinates.mjs`: supplies every route waypoint.
- `src/board/token-render-model.mjs`: resolves the correct sprite size and slot at each waypoint, including shared-cell mini-grids.
- `src/board/pawn-layout.mjs`: the approved solo/full-cell and shared-cell 2×2 sizing rules.

## Public API

- `createPawnMoveAnimation(beforeState, afterState, tokenId, options)`: one segment for every cell entered. A base departure is a separate launch arc from the token's own base slot to its start cell.
- `createPawnCaptureAnimation(beforeState, afterState, tokenId, options)`: a curved return from the captured outer-track cell to that token's own base slot.
- `createTurnAnimationPlan(beforeState, afterState, options)`: combines the mover and all captured-token returns. If several opponents are captured, their return animations are staggered.
- `samplePawnMoveAnimation(animation, elapsedMs)`: returns the interpolated sprite for the requested time.
- `samplePawnCaptureAnimation(animation, elapsedMs)`: returns the captured sprite's position, scale, opacity and rotation.
- `sampleTurnAnimationPlan(plan, elapsedMs)`: samples every part of a committed move and returns the IDs whose static copies must remain hidden.

## Default timing

- Normal cell-to-cell step: 135 ms, scaled by cell distance for diagonal connectors.
- Base launch: 220 ms with a small upward arc.
- Captured token return: 360 ms with a higher arc.
- Stagger between several captured-token returns: 75 ms.

All durations and arc ratios can be overridden by the options object. All sampling is deterministic; equal plans and equal elapsed times produce equal frames. A small epsilon is used at completion boundaries so floating-point timing cannot leave an already-finished sprite hidden.

## Mini App integration contract

1. Send the player's action to the backend and receive the committed `beforeState` reference (the state before applying the action) and `afterState` returned by the authoritative engine. Do not run the move locally as the source of truth.
2. Build `const plan = createTurnAnimationPlan(beforeState, afterState)`.
3. Render the static board from `afterState`, but omit every token ID in the current sample's `suppressedTokenIds`.
4. Draw the mover overlay using `sample.mover` until `sample.mover.done`. Draw each capture overlay only when its `active` flag is true.
5. Drive samples with the host's animation frame loop, passing elapsed milliseconds since the plan started. Stop when `sample.done` is true; the final static render of `afterState` then contains every token at its committed destination.

Example browser adapter:

```js
const plan = createTurnAnimationPlan(beforeState, afterState);
const startedAt = performance.now();

function frame(now) {
  const sample = sampleTurnAnimationPlan(plan, now - startedAt);
  renderBoard({
    state: afterState,
    hiddenTokenIds: sample.suppressedTokenIds,
    movingPawn: sample.mover.done ? null : sample.mover,
    capturedPawns: sample.captures.filter((item) => item.active)
  });

  if (!sample.done) requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
```

The render adapter above is intentionally not coupled to a particular DOM, Canvas, SVG, Telegram WebApp, or framework. The current repository has the tested timeline and sampling API; the actual interactive Mini App board renderer and its browser event loop are a separate frontend integration task.

## Important visual behavior

- A moving pawn follows every route cell in order. It never jumps directly from its start to its final cell.
- At every intermediate waypoint, the renderer recalculates the occupancy of that cell. A pawn temporarily becomes a mini-cell sprite when it shares a cell and returns to full-cell size when alone.
- The final waypoint uses the committed after-state, so a pawn grows or shrinks to match the true destination occupancy.
- Captured tokens fly to their own indexed base slots. A completed capture is unsuppressed immediately, even if another captured token is still returning.
- Logical game-cell coordinates are not changed by sprite size, hop arcs, or mini-cell offsets.
