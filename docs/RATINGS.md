# Ratings and fair play

## Read a nameplate

1. Look beside your name for the current pool rating. **?** means provisional uncertainty.
2. Open **Rating details** for game count, rating deviation (RD), volatility, and the pool name.
3. After a committed rated result, the nameplate can show the actual delta. Pending or unrated results show no predicted gain or loss.

Climb has one pool. Each Timed clock has its own `timed:<control>` pool. Full Power and practice are unrated. A new server profile starts at the configured Glicko-2 value of 1500, RD 350; that starting value is not a measured skill claim. Guests do not get an invented account rating.

## Read Sherine's strength

**Full Power** runs unrestricted Stockfish Lite. Its historical **3000** is nominal, not verified human Elo. Other bot labels are uncalibrated estimates supported only by the published [relative bot comparisons](calibration/README.md). None is a FIDE or Chess.com rating.

## Use help safely

1. Before a hint in an eligible game, confirm the one-sentence warning.
2. Wait for the unrated change to save. A signed-in synced game requires server acknowledgement before help appears.
3. Use the help, or close it. Closing after confirmation does not restore eligibility.

Undo, evaluation, hints, and engine lines permanently remove rating eligibility. Human games receive no live engine assistance. Postgame review is allowed.

## Calculation rules

Glicko-2 uses the versioned opponent, result, RD, and volatility. Full idle days increase RD without changing the rating; reads and reconnects never persist extra changes. Each validated eligible result writes one ledger row and one profile update in the same Convex transaction. Duplicate reports do nothing. Aborts have no score; abandoned unrated sessions do not award ratings. Replacing an already played rated game is a resignation, which prevents avoiding a loss by starting over.

The test suite includes Glickman's worked example, idle uncertainty, draws, pool separation, assistance, ownership, repeated results, and ledger idempotency. Human-Elo calibration remains unverified.
