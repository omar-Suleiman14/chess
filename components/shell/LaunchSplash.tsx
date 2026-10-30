/**
 * The launch screen, in the app icon's own look: a dark tile whose light
 * squares land one by one along a knight's path, then the name, then it fades
 * into the app. Pure CSS in the first HTML, so it plays instantly (even
 * offline). Once per launch; skipped on later pages.
 */
// The icon's eight squares, landing as one runs down the long diagonal, then the other diagonal fills in.
const ORDER: Array<[number, number]> = [[0, 0], [1, 1], [2, 2], [3, 3], [2, 0], [3, 1], [0, 2], [1, 3]];

export function LaunchSplash() {
  return (
    <div className="launch-splash" aria-hidden="true">
      <div className="launch-splash__stage">
        <div className="launch-splash__tile">
          {ORDER.map(([x, y], i) => (
            <span key={`${x}${y}`} className="launch-splash__square" style={{ gridColumn: x + 1, gridRow: y + 1, animationDelay: `${120 + i * 75}ms` }} />
          ))}
        </div>
        <p className="launch-splash__name">Chess by Chaos</p>
      </div>
    </div>
  );
}
