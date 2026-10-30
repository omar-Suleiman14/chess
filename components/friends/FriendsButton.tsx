"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";

const FriendsContent = dynamic(() => import("./FriendsContent").then((mod) => mod.FriendsContent), {
  loading: () => <p role="status">Loading friends…</p>,
});

/** The Friends popup on its own, so a game's Options sheet can open it too. */
export function FriendsDialog({ onClose }: { onClose: () => void }) {
  return <Dialog title="Friends" onClose={onClose}>
    <div className="max-h-[65dvh] overflow-y-auto overscroll-contain"><FriendsContent embedded /></div>
    <button onClick={onClose} className="min-h-11 rounded-full bg-surface-2">Back to game</button>
  </Dialog>;
}

export function FriendsButton() {
  const [open, setOpen] = useState(false);
  return <>
    <Button onClick={() => setOpen(true)} aria-label="Friends" aria-haspopup="dialog" aria-expanded={open} className="grid h-11 w-11 shrink-0 place-items-center rounded-full">
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="9" cy="8" r="3" /><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 4v2" strokeLinecap="round" /></svg>
    </Button>
    {open && <FriendsDialog onClose={() => setOpen(false)} />}
  </>;
}
