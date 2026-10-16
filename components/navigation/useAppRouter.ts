"use client";

import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { useNavigation } from "./NavigationProvider";

/** Keep imperative navigation on the same pending/dimming path as links. */
export function useAppRouter(): ReturnType<typeof useRouter> {
  const router = useRouter();
  const { navigate, refresh } = useNavigation();
  return useMemo(() => ({
    ...router,
    push: (...args: Parameters<typeof router.push>) => navigate(() => router.push(...args)),
    replace: (...args: Parameters<typeof router.replace>) => navigate(() => router.replace(...args)),
    back: () => navigate(() => router.back()),
    forward: () => navigate(() => router.forward()),
    refresh,
  }), [router, navigate, refresh]);
}
