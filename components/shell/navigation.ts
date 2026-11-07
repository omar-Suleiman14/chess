/**
 * One list of destinations for every navigation surface: the phone tab bar,
 * the More page and the desktop sidebar all read from here, so they can never
 * disagree.
 */
export type NavItem = { href: string; label: string; hint?: string; icon?: NavIcon };
export type NavIcon = "play" | "bots" | "learn" | "review" | "friends" | "profile" | "settings" | "clock" | "link" | "chart" | "search" | "info" | "more" | "puzzle" | "bell" | "analysis" | "players";

/** The four main destinations (plus More on phones). */
export const PRIMARY: NavItem[] = [
  { href: "/", label: "Play", hint: "Sherine · full strength", icon: "play" },
  { href: "/climb", label: "Bots", hint: "Sherine and the Climb", icon: "bots" },
  { href: "/puzzles", label: "Puzzles", hint: "Rated · Rush · Daily", icon: "puzzle" },
  { href: "/learn", label: "Learn", icon: "learn" },
  { href: "/time-machine", label: "Review", hint: "Time Machine", icon: "review" },
];

export const MORE_SECTIONS: Array<{ title: string; items: NavItem[] }> = [
  {
    title: "Social",
    items: [
      { href: "/friends", label: "Friends", hint: "Challenges · requests", icon: "friends" },
      { href: "/u", label: "Players", hint: "Find people", icon: "players" },
      { href: "/profile", label: "Profile & Sherine", icon: "profile" },
    ],
  },
  {
    title: "Play",
    items: [
      { href: "/puzzles", label: "Puzzles", hint: "Rated · Puzzle Rush · Daily", icon: "puzzle" },
      { href: "/timed", label: "Timed games", hint: "Clock presets", icon: "clock" },
      { href: "/play", label: "Play online", hint: "Random opponent · friends", icon: "link" },
      { href: "/analysis", label: "Analysis board", hint: "Stockfish lines · FEN", icon: "analysis" },
    ],
  },
  {
    title: "You",
    items: [
      { href: "/progress", label: "Progress", icon: "chart" },
      { href: "/settings", label: "Settings", icon: "settings" },
    ],
  },
  {
    title: "Help & info",
    items: [
      { href: "/search", label: "Search lessons & help", icon: "search" },
      { href: "/help", label: "Help & FAQ", icon: "info" },
      { href: "/about", label: "About Chess by Chaos" },
      { href: "/contact", label: "Contact" },
      { href: "/privacy", label: "Privacy policy" },
      { href: "/terms", label: "Terms of use" },
      { href: "/cookies", label: "Cookies & storage" },
      { href: "/accessibility", label: "Accessibility" },
      { href: "/licenses", label: "Licences & engine source" },
    ],
  },
];

/** Desktop sidebar: the main destinations, then the most used extras. */
export const SIDEBAR_SECONDARY: NavItem[] = [
  { href: "/timed", label: "Timed", icon: "clock" },
  { href: "/play", label: "Play online", icon: "link" },
  { href: "/analysis", label: "Analysis", icon: "analysis" },
  { href: "/friends", label: "Friends", icon: "friends" },
  { href: "/u", label: "Players", icon: "players" },
  { href: "/progress", label: "Progress", icon: "chart" },
];

export function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/" || pathname.startsWith("/game/");
  return pathname === href || pathname.startsWith(`${href}/`);
}
