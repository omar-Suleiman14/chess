"use client";

import Link from "@/components/navigation/PrefetchLink";
import { AccountCard } from "./AppShell";
import { AppMark, NavIcon } from "./NavIcon";
import { isActive, PRIMARY, SIDEBAR_SECONDARY, type NavItem } from "./navigation";

function Item({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isActive(pathname, item.href);
  return (
    <li>
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        title={item.label}
        className={`group flex min-h-12 items-center gap-3 rounded-xl px-3 text-[15px] font-semibold transition-colors max-xl:flex-col max-xl:justify-center max-xl:gap-1 max-xl:px-1 max-xl:py-2 max-xl:text-[11px] ${active ? "bg-[color-mix(in_srgb,var(--brand)_16%,transparent)] text-ink" : "text-muted hover:bg-surface-2 hover:text-ink"}`}
      >
        {item.icon && <NavIcon name={item.icon} active={active} className="h-6 w-6 shrink-0" />}
        <span className="truncate max-xl:max-w-full">{item.label}</span>
      </Link>
    </li>
  );
}

/** Desktop navigation, chess.com style: the same destinations as the phone tabs, always one click away. */
export function Sidebar({ pathname }: { pathname: string }) {
  return (
    <nav aria-label="Main" className="sidebar fixed inset-y-0 start-0 z-40 hidden flex-col border-e border-line bg-surface px-2 py-4 lg:flex">
      <Link href="/" className="mb-4 flex items-center gap-2.5 px-2 max-xl:justify-center" aria-label="Chess by Chaos, play">
        <AppMark size={34} />
        <span className="text-[17px] font-bold tracking-tight max-xl:hidden">Chess by Chaos</span>
      </Link>
      <ul className="grid gap-1">{PRIMARY.map((item) => <Item key={item.href} item={item} pathname={pathname} />)}</ul>
      <div className="mx-2 my-3 h-px bg-line" />
      <ul className="grid gap-1">{SIDEBAR_SECONDARY.map((item) => <Item key={item.href} item={item} pathname={pathname} />)}</ul>
      <div className="flex-1" />
      <ul className="grid gap-1">
        <Item item={{ href: "/settings", label: "Settings", icon: "settings" }} pathname={pathname} />
        <Item item={{ href: "/more", label: "More", icon: "more" }} pathname={pathname} />
      </ul>
      <div className="mt-3 border-t border-line px-1 pt-3 max-xl:flex max-xl:justify-center">
        <AccountCard compact />
      </div>
    </nav>
  );
}
