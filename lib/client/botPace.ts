/** An interaction preference, local to this device (never changes the bot's strength). */
export type BotPace = "instant" | "natural" | "relaxed";

const KEY = "cbc.bot.pace.v1";

export function readBotPace(): BotPace {
  try {
    const saved = localStorage.getItem(KEY);
    return saved === "instant" || saved === "relaxed" ? saved : "natural";
  } catch {
    return "natural";
  }
}

export function saveBotPace(pace: BotPace): void {
  try { localStorage.setItem(KEY, pace); } catch { /* Private browsing can disable persistence. */ }
}

/** A minimum *total* think time. Engine search counts towards it; it is not an additional delay. */
export function minimumBotTurnMs(pace: BotPace, timed: boolean): number {
  if (pace === "instant") return 0;
  if (timed) return pace === "relaxed" ? 600 : 240;
  return pace === "relaxed" ? 1150 : 650;
}
