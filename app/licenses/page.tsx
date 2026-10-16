import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/AppShell";

export const metadata: Metadata = { title: "Licences" };

const REPO = "https://github.com/omar-Suleiman14/chess";

export default function LicensesPage() {
  return (
    <main className="mx-auto min-h-dvh max-w-xl pb-12">
      <PageHeader title="Licences" />
      <div className="grid gap-4 px-4 text-sm leading-relaxed">
        <p>
          Chess by Chaos is free software under the GNU GPL v3. Full source: <a className="underline" href={REPO}>{REPO}</a>.
        </p>
        <section>
          <h2 className="font-semibold">Stockfish 19 (Lite, single-threaded WebAssembly)</h2>
          <p>
            The engine running in your browser is Stockfish 19 via Stockfish.js 19.0.1 (npm <code>stockfish@19.0.1</code>, files{" "}
            <code>stockfish-19-lite-single.js/.wasm</code>), GPL-3.0. Stockfish is developed by the Stockfish developers; Stockfish.js by Nathan Rugg. Chess by
            Chaos is not an official Stockfish project. The exact distributed files and their licence are in{" "}
            <a className="underline" href="/engine/19.0.1/COPYING.txt">/engine/19.0.1/COPYING.txt</a>; corresponding source is available at{" "}
            <a className="underline" href="https://github.com/nmrugg/stockfish.js/tree/v19.0.1">github.com/nmrugg/stockfish.js (v19.0.1)</a> and{" "}
            <a className="underline" href="https://github.com/official-stockfish/Stockfish/tree/sf_19">github.com/official-stockfish/Stockfish (sf_19)</a>. Checksums are listed in{" "}
            <a className="underline" href={`${REPO}/blob/main/THIRD_PARTY_NOTICES.md`}>THIRD_PARTY_NOTICES.md</a>.
          </p>
        </section>
        <section>
          <h2 className="font-semibold">Other components</h2>
          <ul className="list-disc pl-5">
            <li>chess.js (BSD-2-Clause) for legal moves, FEN, SAN and PGN.</li>
            <li>blobatar (MIT) for avatars.</li>
            <li>Motion (MIT), Next.js (MIT), React (MIT), Convex client (Apache-2.0), Clerk SDK (MIT), mcp-handler and MCP SDK (Apache-2.0/MIT), zod (MIT), idb (ISC).</li>
            <li>Pieces: Classic/cburnett and Merida (GPL-2.0+), Chessnut (Apache-2.0), MP Chess (GPL-3.0+), Fantasy (MIT), from lichess-org/lila.</li>
            <li>Move and capture sounds: lichess-org/lila standard set, AGPL-3.0-or-later, used unmodified under GPL-3.0 §13.</li>
            <li>qrcode (MIT) for card QR codes.</li>
            <li>Fatma pixel-art sprite: supplied by the project owner for this project. See THIRD_PARTY_NOTICES.md for provenance.</li>
          </ul>
        </section>
      </div>
    </main>
  );
}
