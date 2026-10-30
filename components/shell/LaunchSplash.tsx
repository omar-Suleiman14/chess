/**
 * The launch screen: a little board in your theme's colours, a brass square
 * hopping a knight's path across it, then the name, then it fades into the
 * app. Pure CSS in the first HTML, so it plays instantly (even offline) and
 * never waits for JavaScript. Once per launch; skipped on later pages.
 */
export function LaunchSplash() {
  return (
    <div className="launch-splash" aria-hidden="true">
      <div className="launch-splash__stage">
        <div className="launch-splash__board">
          {Array.from({ length: 16 }, (_, i) => (
            <span key={i} className={(Math.floor(i / 4) + i) % 2 ? "sq-dark" : "sq-light"} />
          ))}
          <span className="launch-splash__runner" />
        </div>
        <p className="launch-splash__name">Chess by Chaos</p>
      </div>
    </div>
  );
}
