# Puzzles and analysis

Solve tactics, race the clock, and analyse any position.

## Solve puzzles

1. Open **Puzzles** (desktop sidebar, or **Learn** on a phone).
2. Tap **Solve puzzles**. The opponent's last move plays first; then it's your turn.
3. Play the best move. A green tick means it was right; the opponent replies and you keep going until the line is finished.
4. A wrong move shows a red cross. Tap **Retry** to try again from the same position, **Solution** to watch the line, or **Next puzzle**.

Any checkmate counts, even if it isn't the move the puzzle expected. **Hint** first highlights the piece to move, then draws the move.

Pick a theme on the Puzzles page (mates, forks, sacrifices, endgames and more) to practise one idea.

## Puzzle rating

Your puzzle rating starts at 1200 and uses the same Glicko-2 system as games. Each puzzle has its own rating; solving it raises yours and missing it lowers it.

- Only your first try at a puzzle is rated.
- A mistake, a hint, or the solution counts as a miss.
- Signed out, the rating lives on this device. Signed in, the server keeps it and checks each puzzle's rating itself.

## Puzzle Rush

Choose **3 minutes**, **5 minutes**, or **Survival** (no clock). Puzzles start easy and get harder. Each solve scores a point; each wrong move is a strike. Three strikes end the run. Your best score per mode is saved; tap any square in the results to replay that puzzle.

## Daily puzzle

Everyone gets the same puzzle each UTC day. It isn't rated.

## Analysis board

Open **Analysis** from the sidebar or **More**. Move both sides freely; Stockfish shows its top three lines, an evaluation bar and an arrow for its best move. Tap a line to play its first move. Use ←/→, Home/End to step through moves, **F** to flip, and **FEN** to load a position. After a puzzle, **Analyse this position** opens it here.

## Time Machine review

After a game, tap **Review in Time Machine** on the result screen (or **Start review** in Time Machine).

1. **Analysing:** the game replays on the board in step with Stockfish as it grades every move on your device, while Sherine shares a tip and a progress bar fills.
2. **Summary:** her verdict, the evaluation graph (tap it to jump), both players, accuracy, how many moves earned each label (Brilliant, Great, Best, Excellent, Good, Book, Inaccuracy, Mistake, Miss, Blunder), an estimated game rating, and a verdict per phase (opening, middlegame, endgame).
3. **Start Review:** step through the game with **Next**. Sherine names each move's label and the better move, the board shows the label badge and an arrow, and the engine's top choices sit above the board. **Summary** returns to step 2.

The game rating is a rough estimate from accuracy, not a rating change.

## Board annotations

On every board, right-click a square to highlight it, or right-drag to draw an arrow. Hold Shift (green), Alt (blue) or Ctrl (another colour) while clicking. Knight moves bend into an L. A left click clears them; they also clear after a move.

## Where puzzles come from

The puzzles are original: `scripts/generate-puzzles.mjs` plays varied Stockfish 19 games, finds positions where one side blunders, and keeps the position only if every solver move is clearly the only winning one (Lichess-style winning-chances test, depth 15). Puzzle ratings are fixed estimates, spread over 500–2600 by difficulty (solution length, search depth needed, quiet first moves, sacrifices). They don't yet adjust as people play them. Regenerate or extend the set with:

```bash
node scripts/generate-puzzles.mjs --out .cache/puzzles-1.jsonl --games 200 --seed 1
node scripts/generate-puzzles.mjs --merge .cache/puzzles-*.jsonl > lib/chess/puzzles/data.json
```

`lib/chess/puzzles/puzzles.test.ts` replays every puzzle and checks each one is legal and ends on the solver's move.
