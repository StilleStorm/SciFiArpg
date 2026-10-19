# S10 tester

GREEN. `npm run check` 0, `SMOKE_PORT=4192 npm run smoke` 0.

## Added
- smoke: teczka leg now asserts exactly one item pickup dropped; seal leg asserts a `.t-stamp` printed (ZWOLNIONO) besides RunState.buffs.
- smoke: new "urzędnik: a real touch on the figure" (touchscreen tap on the drawn clerk opens the sheet).
- smoke: new "tablica": accept on the board by click, finish, report from the board; ZAŁATWIONO stamp, stars paid, off the active list.
- smoke: old hook side-ticket check accepts the first offer (the epoch moves after a completion, so 'kill' may not be offered).
- src/world/s10Contract.test.ts (5): seal/event/clerk copy resolves; placement deterministic by seed; teczka drops one item and opens once; seal refreshes not stacks; accept-complete-reward survives the character save round trip.

## Failures found
None in game code.

## Frame time
40 enemies: 17.36 ms avg, 16.8 ms p95 (vsync floor).

## Not covered
Events (formularz, przesylka, audyt) in the browser; quest item rewards (parked); the joystick proximity open of a teczka.
