import Link from "@/components/navigation/PrefetchLink";

export function Overview() {
  return <section className="grid gap-5" aria-labelledby="modes-title">
    <h2 id="modes-title" className="text-2xl font-semibold">Ways to play</h2>
    <div className="grid gap-4 sm:grid-cols-2">
      {[
        { href: "/", title: "Full Power", text: "Play Sherine, powered by Stockfish 19 Lite on your device. Undo, explore another line, and try again." },
        { href: "/climb", title: "The Climb", text: "Work through 11 levels, from beginner bots to full-power Stockfish. Strength labels are estimates." },
        { href: "/learn", title: "Learn", text: "Short interactive lessons on pieces, rules, tactics, endgames, and openings." },
        { href: "/timed", title: "Timed", text: "Practise with 3+2, 5+3, 10+5, or 15+10 clocks." },
        { href: "/play", title: "Play a friend", text: "Invite someone with a private link, QR code, or PIN." },
        { href: "/time-machine", title: "Time Machine", text: "Replay games, analyse positions, import or export PGN, and continue from an earlier move." },
      ].map((item) => <div key={item.href} className="rounded-2xl bg-surface p-5"><h3 className="mb-2 text-xl font-semibold"><Link href={item.href}>{item.title}</Link></h3><p className="text-muted">{item.text}</p></div>)}
    </div>
  </section>;
}
