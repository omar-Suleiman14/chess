"use client";

import dynamic from "next/dynamic";
import { useSettings } from "@/lib/client/settings";

const LiveBackground = dynamic(() => import("./LiveBackground").then((module) => module.LiveBackground), { ssr: false });

/** Live background behind games only (Settings → Live background). Never on other pages. */
export function GameBackground() {
  const { settings, reducedMotion } = useSettings();
  if (settings.experience.ambient.mode !== "ambient") return null;
  return <LiveBackground reducedMotion={reducedMotion} />;
}
