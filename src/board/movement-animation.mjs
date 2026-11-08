import { BOARD } from "./classic-geometry.mjs";
import { tokenMovementPath } from "./coordinates.mjs";
import { buildTokenRenderModel } from "./token-render-model.mjs";

const TIME_EPSILON_MS = 1e-7;

export const DEFAULT_ANIMATION_TIMING = Object.freeze({
  stepDurationMs: 135,
  launchDurationMs: 220,
  captureDurationMs: 360,
  captureStaggerMs: 75,
  stepHopRatio: 0.035,
  launchHopRatio: 0.16,
  captureHopRatio: 0.42
});

function assertDuration(value, label) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(label + " must be a positive number of milliseconds.");
  }
  return value;
}

function assertStatePair(beforeState, afterState, tokenId) {
  if (!beforeState || !afterState || !beforeState.tokens?.[tokenId] || !afterState.tokens?.[tokenId]) {
    throw new TypeError("Both game states must contain the moving token.");
  }
  if (beforeState.mode !== "CLASSIC" || afterState.mode !== "CLASSIC") {
    throw new TypeError("Movement animation only supports CLASSIC states.");
  }
}

function renderItemFor(state, tokenId) {
  const item = buildTokenRenderModel(state).find((candidate) => candidate.tokenId === tokenId);
  if (!item) throw new Error("Could not resolve render item for token " + tokenId + ".");
  return item;
}

function waypointState(beforeState, tokenId, progress) {
  const state = structuredClone(beforeState);
  state.tokens[tokenId].stepProgress = progress;
  return state;
}

function animationSprite(item) {
  return {
    tokenId: item.tokenId,
    characterId: item.characterId,
    src: item.src,
    color: item.color,
    owner: item.owner,
    zone: item.zone,
    cellKey: item.cellKey,
    progress: item.progress,
    x: item.anchorX,
    y: item.anchorY,
    anchorX: item.anchorX,
    anchorY: item.anchorY,
    imageX: item.imageX,
    imageY: item.imageY,
    width: item.width,
    height: item.height,
    scale: item.scale
  };
}

function distanceInCells(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y) / BOARD.grid.cellPitch;
}

function createSegment(from, to, startMs, durationMs, arcHeight, waypoint) {
  return Object.freeze({
    from: Object.freeze(animationSprite(from)),
    to: Object.freeze(animationSprite(to)),
    startMs,
    endMs: startMs + durationMs,
    durationMs,
    arcHeight,
    waypoint: Object.freeze({ ...waypoint })
  });
}

export function createPawnMoveAnimation(beforeState, afterState, tokenId, options = {}) {
  assertStatePair(beforeState, afterState, tokenId);

  const beforeToken = beforeState.tokens[tokenId];
  const afterToken = afterState.tokens[tokenId];
  const fromProgress = beforeToken.stepProgress;
  const toProgress = afterToken.stepProgress;
  if (toProgress <= fromProgress) throw new RangeError("A move animation requires forward token progress.");

  const stepDurationMs = assertDuration(
    options.stepDurationMs ?? DEFAULT_ANIMATION_TIMING.stepDurationMs,
    "stepDurationMs"
  );
  const launchDurationMs = assertDuration(
    options.launchDurationMs ?? DEFAULT_ANIMATION_TIMING.launchDurationMs,
    "launchDurationMs"
  );
  const stepHopRatio = options.stepHopRatio ?? DEFAULT_ANIMATION_TIMING.stepHopRatio;
  const launchHopRatio = options.launchHopRatio ?? DEFAULT_ANIMATION_TIMING.launchHopRatio;
  if (![stepHopRatio, launchHopRatio].every((value) => Number.isFinite(value) && value >= 0)) {
    throw new RangeError("Animation hop ratios must be non-negative numbers.");
  }

  const player = beforeState.players.find((candidate) => candidate.id === beforeToken.owner);
  if (!player || player.color !== beforeToken.color) throw new Error("Moving token owner is inconsistent.");

  const route = tokenMovementPath(beforeToken.color, fromProgress, toProgress, beforeToken.index);
  if (!route.length) throw new Error("Movement route cannot be empty.");

  const segments = [];
  let currentSprite = renderItemFor(beforeState, tokenId);
  let cursorMs = 0;

  route.forEach((waypoint, index) => {
    const isFinal = index === route.length - 1;
    const targetState = isFinal
      ? afterState
      : waypointState(beforeState, tokenId, waypoint.progress);
    const targetSprite = renderItemFor(targetState, tokenId);
    const distance = distanceInCells(currentSprite, targetSprite);
    const isLaunch = fromProgress === -1 && index === 0;
    const duration = isLaunch
      ? launchDurationMs
      : stepDurationMs * Math.max(1, distance);

    segments.push(createSegment(
      currentSprite,
      targetSprite,
      cursorMs,
      duration,
      BOARD.grid.cellPitch * (isLaunch ? launchHopRatio : stepHopRatio),
      waypoint
    ));
    cursorMs += duration;
    currentSprite = targetSprite;
  });

  return Object.freeze({
    kind: "move",
    tokenId,
    color: beforeToken.color,
    fromProgress,
    toProgress,
    segments: Object.freeze(segments),
    durationMs: cursorMs,
    timing: Object.freeze({ stepDurationMs, launchDurationMs })
  });
}

export function createPawnCaptureAnimation(beforeState, afterState, tokenId, options = {}) {
  assertStatePair(beforeState, afterState, tokenId);

  const beforeToken = beforeState.tokens[tokenId];
  const afterToken = afterState.tokens[tokenId];
  if (afterToken.stepProgress !== -1 || beforeToken.stepProgress < 0 || beforeToken.stepProgress > 50) {
    throw new RangeError("Capture animation must return an outer-track pawn to its base.");
  }

  const durationMs = assertDuration(
    options.durationMs ?? DEFAULT_ANIMATION_TIMING.captureDurationMs,
    "capture duration"
  );
  const hopRatio = options.hopRatio ?? DEFAULT_ANIMATION_TIMING.captureHopRatio;
  if (!Number.isFinite(hopRatio) || hopRatio < 0) {
    throw new RangeError("Capture hop ratio must be non-negative.");
  }

  const from = renderItemFor(beforeState, tokenId);
  const to = renderItemFor(afterState, tokenId);
  return Object.freeze({
    kind: "capture",
    tokenId,
    color: beforeToken.color,
    fromProgress: beforeToken.stepProgress,
    toProgress: -1,
    from: Object.freeze(animationSprite(from)),
    to: Object.freeze(animationSprite(to)),
    startMs: 0,
    durationMs,
    endMs: durationMs,
    arcHeight: BOARD.grid.cellPitch * hopRatio
  });
}

export function createTurnAnimationPlan(beforeState, afterState, options = {}) {
  const action = afterState?.lastAction;
  if (!action || action.type !== "MOVE" || !action.tokenId) {
    throw new TypeError("After-state must contain a committed MOVE action.");
  }

  const beforeMover = beforeState.tokens[action.tokenId];
  const afterMover = afterState.tokens[action.tokenId];
  if (
    !beforeMover ||
    !afterMover ||
    action.playerId !== beforeMover.owner ||
    action.fromProgress !== beforeMover.stepProgress ||
    action.toProgress !== afterMover.stepProgress
  ) {
    throw new Error("Committed MOVE action does not match the supplied before/after states.");
  }

  const mover = createPawnMoveAnimation(beforeState, afterState, action.tokenId, options);
  const staggerMs = options.captureStaggerMs ?? DEFAULT_ANIMATION_TIMING.captureStaggerMs;
  const captureDurationMs = options.captureDurationMs ?? DEFAULT_ANIMATION_TIMING.captureDurationMs;
  assertDuration(captureDurationMs, "captureDurationMs");
  if (!Number.isFinite(staggerMs) || staggerMs < 0) {
    throw new RangeError("captureStaggerMs must be non-negative.");
  }

  const capturedIds = action.captured ?? [];
  if (!Array.isArray(capturedIds) || capturedIds.some((id) => typeof id !== "string")) {
    throw new TypeError("Captured token IDs must be an array of strings.");
  }

  const captures = capturedIds.map((tokenId, index) => {
    const beforeVictim = beforeState.tokens[tokenId];
    const afterVictim = afterState.tokens[tokenId];
    if (!beforeVictim || !afterVictim || afterVictim.stepProgress !== -1) {
      throw new Error("Captured token must exist before and return to base after the move.");
    }
    const animation = createPawnCaptureAnimation(beforeState, afterState, tokenId, {
      durationMs: captureDurationMs,
      hopRatio: options.captureHopRatio
    });
    return Object.freeze({
      tokenId,
      delayMs: mover.durationMs + index * staggerMs,
      animation
    });
  });

  const durationMs = Math.max(
    mover.durationMs,
    ...captures.map((entry) => entry.delayMs + entry.animation.durationMs)
  );

  return Object.freeze({
    kind: "turn",
    mover,
    captures: Object.freeze(captures),
    suppressedTokenIds: Object.freeze([
      mover.tokenId,
      ...captures.map((entry) => entry.tokenId)
    ]),
    durationMs
  });
}

function smoothStep(t) {
  return t * t * (3 - 2 * t);
}

function interpolate(from, to, t) {
  return from + (to - from) * t;
}

function sampleSprite(from, to, t, arcHeight = 0) {
  const eased = smoothStep(t);
  const arc = Math.sin(Math.PI * t) * arcHeight;
  const anchorX = interpolate(from.anchorX, to.anchorX, eased);
  const anchorY = interpolate(from.anchorY, to.anchorY, eased) - arc;
  const width = interpolate(from.width, to.width, eased);
  const height = interpolate(from.height, to.height, eased);
  return {
    tokenId: from.tokenId,
    characterId: from.characterId,
    src: from.src,
    color: from.color,
    owner: from.owner,
    zone: t >= 1 ? to.zone : from.zone,
    progress: t >= 1 ? to.progress : from.progress,
    x: anchorX,
    y: anchorY,
    anchorX,
    anchorY,
    imageX: anchorX - width / 2,
    imageY: anchorY - height,
    width,
    height,
    scale: interpolate(from.scale, to.scale, eased),
    opacity: 1,
    rotationDegrees: 0
  };
}

export function samplePawnMoveAnimation(animation, elapsedMs) {
  if (!animation || animation.kind !== "move" || !Array.isArray(animation.segments)) {
    throw new TypeError("A pawn move animation is required.");
  }
  if (!Number.isFinite(elapsedMs)) throw new TypeError("elapsedMs must be finite.");
  const time = Math.max(0, elapsedMs);

  if (time >= animation.durationMs - TIME_EPSILON_MS) {
    const final = animation.segments.at(-1);
    return {
      ...sampleSprite(final.from, final.to, 1, final.arcHeight),
      done: true,
      segmentIndex: animation.segments.length - 1,
      segmentProgress: 1,
      elapsedMs: animation.durationMs
    };
  }

  const index = animation.segments.findIndex((segment) => time < segment.endMs);
  const segmentIndex = Math.max(0, index);
  const segment = animation.segments[segmentIndex];
  const t = Math.max(0, Math.min(1, (time - segment.startMs) / segment.durationMs));

  return {
    ...sampleSprite(segment.from, segment.to, t, segment.arcHeight),
    done: false,
    segmentIndex,
    segmentProgress: t,
    elapsedMs: time
  };
}

export function samplePawnCaptureAnimation(animation, elapsedMs) {
  if (!animation || animation.kind !== "capture") {
    throw new TypeError("A pawn capture animation is required.");
  }
  if (!Number.isFinite(elapsedMs)) throw new TypeError("elapsedMs must be finite.");
  const time = Math.max(0, elapsedMs);
  const done = time >= animation.durationMs - TIME_EPSILON_MS;
  const t = done ? 1 : Math.max(0, Math.min(1, time / animation.durationMs));
  const sprite = sampleSprite(animation.from, animation.to, t, animation.arcHeight);
  const fade = 1 - 0.12 * Math.sin(Math.PI * t);
  return {
    ...sprite,
    opacity: fade,
    rotationDegrees: 8 * Math.sin(Math.PI * t),
    done,
    segmentProgress: t,
    elapsedMs: Math.min(time, animation.durationMs)
  };
}

export function sampleTurnAnimationPlan(plan, elapsedMs) {
  if (!plan || plan.kind !== "turn" || !Number.isFinite(elapsedMs)) {
    throw new TypeError("A turn animation plan and finite elapsed time are required.");
  }
  const time = Math.max(0, elapsedMs);
  const mover = samplePawnMoveAnimation(plan.mover, time);
  const captures = plan.captures.map((entry) => {
    const localTime = time - entry.delayMs;
    return {
      tokenId: entry.tokenId,
      active: localTime >= 0 && localTime < entry.animation.durationMs - TIME_EPSILON_MS,
      ...samplePawnCaptureAnimation(entry.animation, localTime)
    };
  });
  const suppressedTokenIds = [
    ...(mover.done ? [] : [plan.mover.tokenId]),
    ...plan.captures
      .filter((entry) => time - entry.delayMs < entry.animation.durationMs - TIME_EPSILON_MS)
      .map((entry) => entry.tokenId)
  ];
  return {
    mover,
    captures,
    done: time >= plan.durationMs - TIME_EPSILON_MS,
    elapsedMs: Math.min(time, plan.durationMs),
    suppressedTokenIds
  };
}
