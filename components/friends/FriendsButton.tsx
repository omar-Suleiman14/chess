"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { NeedsInternet } from "@/components/shell/NeedsInternet";
import Link from "@/components/navigation/PrefetchLink";

const FriendsContent = dynamic(() => import("./FriendsContent").then((mod) => mod.FriendsContent), {
  loading: () => <p role="status" className="py-6 text-center text-sm text-muted">Loading friends…</p>,
});

/** Friends as a half-screen drawer over the game: challenges first, swipe down to get back to the board. */
export function FriendsSheet({ onClose }: { onClose: () => void }) {
  return (
    <Sheet
      title="Friends"
      onClose={onClose}
      footer={<div className="grid grid-cols-2 gap-2">
        <Link href="/play" className="grid min-h-12 place-items-center rounded-2xl bg-accent text-sm font-semibold text-accent-text">Play with a link</Link>
        <Link href="/friends" className="grid min-h-12 place-items-center rounded-2xl bg-surface-2 text-sm font-semibold">All friends</Link>
      </div>}
    >
      <div className="grid gap-3">
        <NeedsInternet what="Friends and challenges" />
        <FriendsContent embedded />
      </div>
    </Sheet>
  );
}

export function FriendsButton() {
  const [open, setOpen] = useState(false);
  return <>
    <Button onClick={() => setOpen(true)} aria-label="Friends" aria-haspopup="dialog" aria-expanded={open} className="grid h-11 w-11 shrink-0 place-items-center rounded-full">
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="9" cy="8" r="3" /><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 4v2" strokeLinecap="round" /></svg>
    </Button>
    {open && <FriendsSheet onClose={() => setOpen(false)} />}
  </>;
}
