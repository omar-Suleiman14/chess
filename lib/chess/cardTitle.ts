// Playstyle title for the Chess card (like Chaos' "Patient Guide").
// Deterministic from real stats; never implies a rating.

export type CardStats = { wins: number; losses: number; draws: number; undos: number; lessons: number; climbBeaten: number };

export function cardTitle(s: CardStats): string {
  const games = s.wins + s.losses + s.draws;
  if (s.climbBeaten >= 8) return "Summit Seeker";
  if (s.wins >= 10) return "Fatma's Nemesis";
  if (s.wins >= 3) return "Stubborn Rival";
  if (s.climbBeaten >= 4) return "Steady Climber";
  if (s.lessons >= 8) return "Patient Student";
  if (games > 0 && s.undos / Math.max(1, games) >= 5) return "Time Traveller";
  if (s.lessons >= 3) return "Curious Learner";
  if (games >= 10) return "Brave Challenger";
  if (games > 0) return "Fresh Contender";
  return "New Arrival";
}
