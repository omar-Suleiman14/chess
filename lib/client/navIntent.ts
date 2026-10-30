// A tab switch is a sideways jump, not a push: the page template should
// cross-fade instead of sliding. The tab bar marks the intent just before
// navigating; the next page template reads it once.

let tab = false;

export function markTabNavigation(): void {
  tab = true;
}

/** True once after a tab tap; resets so ordinary links slide again. */
export function consumeTabNavigation(): boolean {
  const was = tab;
  tab = false;
  return was;
}

/** Re-tapping the current tab asks its page to return to its start (e.g. the bot list). */
export const TAB_RESELECT_EVENT = "cbc:tab-reselect";
