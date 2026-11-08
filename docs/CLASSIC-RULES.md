# CLASSIC rules engine

The implementation in `src/engine/classic-engine.mjs` is a pure, deterministic rules module. It does not depend on Telegram, WebSockets, HTTP handlers, storage, or rendering. The backend owns the authoritative state and calls this module to produce the next state.

## Game setup

- 2–4 players.
- Four tokens per player.
- Each roster entry has a unique player ID and a unique board color.
- The first roster entry takes the opening turn.
- All tokens begin at progress `-1` (base).

## Movement

- A token leaves base only on a six and lands on its own start cell.
- Outer-track progress is `0..50`.
- Home-lane progress is `51..55`.
- Progress `56` means finished.
- A move must finish on an exact roll. A roll that would pass progress 56 is not legal.
- The engine returns every legal token ID; the client cannot choose a destination cell.

## Turn and capture rules

- Rolling a six grants another roll, even when no token can move.
- Capturing one or more opposing tokens grants another roll.
- Reaching the finish grants another roll unless it ends the game.
- Three consecutive sixes cancel the third roll and pass the turn.
- Safe outer-track indices are `0, 8, 13, 21, 26, 34, 39, 47`. Opposing tokens on these cells cannot be captured.
- Two or more tokens belonging to the same player on one outer-track cell form a blockade. Other tokens cannot land on or pass through it.
- A blockade is checked along the whole path, not only at the destination.
- Landing on an unprotected, non-safe outer-track cell sends opposing tokens on that cell back to base.

## Server boundary

`rollClassicDice(state, playerId, dice)` accepts a die value so the rules can be tested deterministically. Production backend code must generate that value on the server with a cryptographically secure random source; never accept a client-supplied dice result.

The engine does not persist state or broadcast events. A backend service must validate the caller, load the latest state, apply one engine action, atomically save the returned state/revision, and then broadcast the committed result. The same revision must not be applied twice.

## Public engine API

- `createClassicState(roster)`: create a validated game state.
- `rollClassicDice(state, playerId, dice)`: resolve a roll and return legal token IDs, or pass/skip a turn when there are no legal moves.
- `legalMoves(state, playerId, dice)`: list legal token IDs for a player and die value.
- `applyClassicMove(state, playerId, tokenId)`: apply a selected legal token move, captures, bonus roll, or win.
- `buildOccupancy(state)`: group tokens by track, home lane, base, and finish.
- `assertClassicState(state)`: validate state invariants.
- `globalTrackIndex(color, progress)`: map an outer-track progress step to the shared 52-cell loop.

All actions are immutable: the input state is not mutated. A successful action returns a new state with an incremented `revision`.
