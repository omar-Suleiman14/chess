// A tab switch is a sideways jump, not a push: the page template should
// cross-fade instead of sliding. The tab bar marks the intent just before
// navigating; the next page template reads it. The mark expires on its own,
// so a tap that never navigates (Cmd-click, prevented) can't affect a later link,
// and reading it has no side effect (safe in render, StrictMode and retries).

const WINDOW_MS = 800;
let markedAt = -Infinity;

export function markTabNavigation(): void {
  markedAt = performance.now();
}

/** True shortly after a tab tap. */
export function isTabNavigation(): boolean {
  return typeof performance !== "undefined" && performance.now() - markedAt < WINDOW_MS;
}

/** Called once the new page has committed. */
export function clearTabNavigation(): void {
  markedAt = -Infinity;
}

/** Re-tapping the current tab asks its page to return to its start (e.g. the bot list). */
export const TAB_RESELECT_EVENT = "cbc:tab-reselect";
