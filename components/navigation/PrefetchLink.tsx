"use client";

import Link from "next/link";
import { useLinkStatus } from "next/link";
import { useEffect, useSyncExternalStore, type ComponentProps } from "react";
import { useNavigation } from "./NavigationProvider";

function PendingNavigation() {
  const { pending } = useLinkStatus();
  const { track } = useNavigation();
  useEffect(() => { if (pending) return track(); }, [pending, track]);
  return null;
}

type Connection = EventTarget & { saveData?: boolean; effectiveType?: string };
const connection = () => (navigator as Navigator & { connection?: Connection }).connection;
function subscribe(listener: () => void) {
  const network = connection();
  network?.addEventListener("change", listener);
  return () => network?.removeEventListener("change", listener);
}
function allowed() {
  const network = connection();
  return !network?.saveData && !["slow-2g", "2g"].includes(network?.effectiveType ?? "");
}

/** Warm visible destinations before a tap, including full dynamic-route payloads. */
export default function PrefetchLink({ children, prefetch, ...props }: ComponentProps<typeof Link>) {
  const canPrefetch = useSyncExternalStore(subscribe, allowed, () => false);
  return <Link {...props} prefetch={canPrefetch ? prefetch ?? true : false}>
    {children}<PendingNavigation />
  </Link>;
}
