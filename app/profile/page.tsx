"use client";

import { SignInButton } from "@clerk/nextjs";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "@/convex/_generated/api";
import { FatmaToggle } from "@/components/fatma/FatmaPanel";
import { FatmaSprite } from "@/components/fatma/FatmaSprite";
import { CardDeck } from "@/components/profile/CardDeck";
import { CARD_THEMES } from "@/components/profile/ChessCard";
import { SwitchRow } from "@/components/ui/Switch";
import { PageHeader } from "@/components/shell/AppShell";
import { useSettings } from "@/lib/client/settings";
import { store } from "@/lib/client/store";
import { useFatma } from "@/lib/client/useFatma";

const SCOPES = [
  { id: "chess.read", label: "Read games, analysis and progress" },
  { id: "chess.write", label: "Create practice branches from your games" },
  { id: "lessons.write", label: "Create lessons and practice positions" },
  { id: "fatma.write", label: "Propose upgrades for Fatma" },
] as const;

export default function ProfilePage() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { reducedMotion } = useSettings();
  const fatma = useFatma();

  if (!isLoading && !isAuthenticated) {
    return (
      <main className="mx-auto max-w-xl pb-12">
        <PageHeader title="Profile & Fatma" />
        <div className="grid gap-4 px-4">
          <section className="flex items-center gap-4 rounded-2xl bg-surface p-4 shadow-[var(--shadow)]">
            <FatmaSprite expression={fatma.enabled ? "smug" : "idle"} size={72} reducedMotion={reducedMotion} />
            <div className="grid gap-2">
              <p className="text-sm text-muted">{fatma.enabled ? "Fatma is on." : "Fatma is off."}</p>
              <FatmaToggle fatma={fatma} />
            </div>
          </section>
          <p>Sign in for a Chess card, synced Fatma memory and AI coach access.</p>
          <SignInButton mode="modal">
            <button className="justify-self-start rounded-full bg-accent px-4 py-2 text-accent-text">Sign in</button>
          </SignInButton>
        </div>
      </main>
    );
  }
  return <SignedInProfile fatma={fatma} reducedMotion={reducedMotion} />;
}

function SignedInProfile({ fatma, reducedMotion }: { fatma: ReturnType<typeof useFatma>; reducedMotion: boolean }) {
  const profile = useQuery(api.profiles.mine);
  const ensure = useMutation(api.profiles.ensure);
  const update = useMutation(api.profiles.update);
  const packs = useQuery(api.fatma.packs);
  const decide = useMutation(api.fatma.decidePack);
  const grant = useQuery(api.mcp.myGrant);
  const setGrant = useMutation(api.mcp.setGrant);
  const revoke = useMutation(api.mcp.revokeClient);
  const deleteData = useMutation(api.profiles.deleteMyData);
  const exportData = useQuery(api.profiles.exportMyData);
  const [aliasEdit, setAliasDraft] = useState<string | null>(null);
  const aliasDraft = aliasEdit ?? profile?.alias ?? "";
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState("");

  // Creates the profile, or assigns a card number to an older one.
  const needsEnsure = profile === null || (profile !== undefined && profile.memberNumber === undefined);
  useEffect(() => {
    if (needsEnsure) void ensure({});
  }, [needsEnsure, ensure]);

  const save = async (patch: Parameters<typeof update>[0]) => {
    setError(null);
    try {
      await update(patch);
    } catch (e) {
      setError((e as { data?: { message?: string } }).data?.message ?? "Could not save.");
    }
  };

  const card = useQuery(api.profiles.myCard);
  const [hueDraft, setHueDraft] = useState<number | null>(null);
  const cardUrl = typeof window !== "undefined" && profile ? `${window.location.origin}/u/${profile.alias}` : "";

  const scopes = grant?.grant?.scopes ?? [];
  const mcpUrl = typeof window !== "undefined" ? `${window.location.origin}/mcp` : "/mcp";

  return (
    <main className="mx-auto min-h-dvh max-w-xl pb-16">
      <PageHeader title="Profile & Fatma" />
      <div className="grid gap-6 px-4">
        {profile && (
          <section aria-labelledby="card" className="grid gap-4">
            <h2 id="card" className="sr-only">Chess card</h2>
            {card && (
              <CardDeck
                cards={[{ id: "me", face: "identity", data: hueDraft === null ? card : { ...card, hue: hueDraft }, url: cardUrl, label: `@${card.alias}` }]}
                reducedMotion={reducedMotion}
              />
            )}
            <div className="overflow-hidden rounded-2xl bg-surface shadow-[var(--shadow)]">
              <div className="grid gap-2 border-b border-line p-4">
                <label htmlFor="alias" className="text-sm text-muted">Chess alias (separate from your Chaos identity)</label>
                <div className="flex gap-2">
                  <input id="alias" value={aliasDraft} onChange={(e) => setAliasDraft(e.target.value.toLowerCase())} maxLength={20} className="min-h-11 flex-1 rounded-xl bg-surface-2 px-3" />
                  <button onClick={() => void save({ alias: aliasDraft })} disabled={aliasDraft === profile.alias} className="rounded-xl bg-accent px-4 font-medium text-accent-text disabled:opacity-40">Save</button>
                </div>
              </div>
              <div className="grid gap-2 border-b border-line p-4">
                <span className="text-sm text-muted">Card colour</span>
                <div className="flex flex-wrap gap-3" role="radiogroup" aria-label="Card colour">
                  {Object.entries(CARD_THEMES).map(([id, t]) => (
                    <button
                      key={id}
                      role="radio"
                      aria-checked={profile.cardTheme === id}
                      aria-label={`${id} card`}
                      onClick={() => void save({ cardTheme: id })}
                      className={`h-11 w-11 rounded-full transition-transform active:scale-90 ${profile.cardTheme === id ? "ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--surface)]" : ""}`}
                      style={{ background: t.art }}
                    />
                  ))}
                </div>
              </div>
              <div className="grid gap-1 border-b border-line p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted">Avatar colour</span>
                  <button onClick={() => void save({ avatarSeed: Math.random().toString(36).slice(2, 10) })} className="text-sm font-medium" style={{ color: "var(--focus)" }}>
                    New avatar
                  </button>
                </div>
                <input type="range" min={0} max={359} value={hueDraft ?? profile.hue} onChange={(e) => setHueDraft(Number(e.target.value))} onPointerUp={() => hueDraft !== null && void save({ hue: hueDraft }).then(() => setHueDraft(null))} onKeyUp={() => hueDraft !== null && void save({ hue: hueDraft }).then(() => setHueDraft(null))} className="ios-range hue w-full" aria-label="Avatar hue" />
              </div>
              <SwitchRow label="Public card" hint={`Anyone with the link can see /u/${profile.alias}`} checked={profile.visibility === "public"} onChange={(v) => void save({ visibility: v ? "public" : "private" })} />
              <SwitchRow label="Show stats on card" checked={profile.showRatings} onChange={(v) => void save({ showRatings: v })} />
              {profile.visibility === "public" && (
                <button
                  onClick={async () => {
                    if (navigator.share) await navigator.share({ title: "My chess card", url: cardUrl }).catch(() => {});
                    else await navigator.clipboard?.writeText(cardUrl);
                  }}
                  className="min-h-12 w-full text-center font-medium"
                  style={{ color: "var(--focus)" }}
                >
                  Share card
                </button>
              )}
            </div>
            {error && <p className="text-sm text-danger" role="alert">{error}</p>}
          </section>
        )}

        <section aria-labelledby="fatma" className="grid gap-3 rounded-2xl bg-surface p-4 shadow-[var(--shadow)]">
          <div className="flex items-center gap-4">
            <FatmaSprite expression={fatma.enabled ? "smug" : "idle"} size={72} reducedMotion={reducedMotion} />
            <div>
              <h2 id="fatma" className="font-semibold">Fatma</h2>
              <p className="text-sm text-muted">
                {fatma.enabled ? "On" : "Off"} · turned off {fatma.memory.disableCount}× · brought back {fatma.memory.reenableCount}×
              </p>
            </div>
          </div>
          <FatmaToggle fatma={fatma} />
          {packs && packs.pending.length > 0 && (
            <div className="grid gap-2">
              <p className="text-sm font-medium">Upgrades waiting for you</p>
              {packs.pending.map((p) => (
                <div key={`${p.packId}@${p.version}`} className="rounded-xl bg-surface-2 p-3 text-sm">
                  <p className="font-medium">{p.pack.name} · v{p.version}</p>
                  <p className="text-muted">{p.pack.description}</p>
                  <ul className="mt-2 list-disc pl-5">
                    {p.pack.lines.slice(0, 5).map((l) => (
                      <li key={l.id}>“{l.text}” <span className="text-muted">({l.event.replace(/_/g, " ")})</span></li>
                    ))}
                  </ul>
                  <div className="mt-2 flex gap-2">
                    <button onClick={() => void decide({ packId: p.packId, version: p.version, decision: "install" })} className="rounded-full bg-accent px-3 py-1.5 text-accent-text">Install</button>
                    <button onClick={() => void decide({ packId: p.packId, version: p.version, decision: "reject" })} className="rounded-full bg-surface px-3 py-1.5">Reject</button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {packs && packs.installed.length > 0 && (
            <div className="grid gap-1 text-sm">
              <p className="font-medium">Installed upgrades</p>
              {packs.installed.map((p) => (
                <p key={p.packId} className="flex justify-between">
                  <span>{p.pack.name} · v{p.version}</span>
                  <button onClick={() => void decide({ packId: p.packId, version: p.version, decision: "uninstall" })} className="underline">Uninstall</button>
                </p>
              ))}
            </div>
          )}
        </section>

        <section aria-labelledby="ai" className="grid gap-3 rounded-2xl bg-surface p-4 shadow-[var(--shadow)]">
          <h2 id="ai" className="font-semibold">AI coaches (ChatGPT & Claude)</h2>
          <p className="text-sm text-muted">
            Add this MCP server as a custom connector. It works from the web, desktop and mobile apps; the board stays here, they get links to it.
          </p>
          <code className="select-all rounded-xl bg-surface-2 px-3 py-2 text-sm">{mcpUrl}</code>
          <p className="text-sm font-medium">What they may do</p>
          <div className="-mx-4 border-y border-line">
            {SCOPES.map((sc) => (
              <SwitchRow
                key={sc.id}
                label={sc.label}
                checked={scopes.includes(sc.id)}
                onChange={(on) =>
                  void setGrant({
                    scopes: on ? [...scopes, sc.id] : scopes.filter((x) => x !== sc.id),
                    allowAutoInstall: grant?.grant?.allowAutoInstall ?? false,
                  })
                }
              />
            ))}
            <SwitchRow label="Install Fatma upgrades without asking me" checked={grant?.grant?.allowAutoInstall ?? false} onChange={(on) => void setGrant({ scopes, allowAutoInstall: on })} />
          </div>
          {grant && grant.audits.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer">Recent activity</summary>
              <ul className="mt-2 grid gap-1">
                {grant.audits.map((a) => (
                  <li key={a._id} className="flex justify-between gap-2">
                    <span>
                      {a.tool} <span className="text-muted">· {a.clientId.slice(0, 16)}</span>
                    </span>
                    <span className={a.outcome === "ok" ? "text-ok" : "text-danger"}>{a.outcome}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex flex-wrap gap-2">
                {[...new Set(grant.audits.map((a) => a.clientId))].map((c) => (
                  <button key={c} onClick={() => void revoke({ clientId: c })} className="rounded-full bg-surface-2 px-3 py-1">Revoke {c.slice(0, 12)}</button>
                ))}
              </div>
            </details>
          )}
          <button onClick={() => void setGrant({ scopes: [], allowAutoInstall: false })} className="justify-self-start text-sm text-danger underline">
            Revoke all AI access
          </button>
        </section>

        <section aria-labelledby="data" className="grid gap-3 rounded-2xl bg-surface p-4 shadow-[var(--shadow)]">
          <h2 id="data" className="font-semibold">Your data</h2>
          <button
            disabled={!exportData}
            onClick={() => {
              const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "chess-by-chaos-export.json";
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="justify-self-start rounded-full bg-surface-2 px-4 py-2 text-sm"
          >
            Download my data (JSON)
          </button>
          <p className="text-xs text-muted">Export individual games as PGN from Time Machine.</p>
          <label className="grid gap-1 text-sm">
            <span>Type DELETE to erase every chess record on your account</span>
            <span className="flex gap-2">
              <input value={confirmDelete} onChange={(e) => setConfirmDelete(e.target.value)} className="min-h-11 flex-1 rounded-xl bg-surface-2 px-3" aria-label="Type DELETE to confirm" />
              <button
                disabled={confirmDelete !== "DELETE"}
                onClick={async () => {
                  await deleteData({ confirm: "DELETE" });
                  await store.clearAll();
                  setConfirmDelete("");
                }}
                className="rounded-xl bg-danger px-4 text-white disabled:opacity-40"
              >
                Delete
              </button>
            </span>
          </label>
        </section>
      </div>
    </main>
  );
}
