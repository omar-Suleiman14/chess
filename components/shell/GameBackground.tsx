"use client";

import dynamic from "next/dynamic";
import { useSettings } from "@/lib/client/settings";
import { BOARD_SEEDS } from "@/lib/experience/theme";

const CharacterField = dynamic(() => import("./CharacterField").then((module) => module.CharacterField), { ssr: false });

/** Mount only inside the immediate game layout, never in an app-wide shell. */
export function GameBackground() {
  const { settings, reducedMotion, reducedTransparency } = useSettings();
  const ambient = settings.experience.ambient;
  if (ambient.mode !== "ambient") return null;
  return <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-3xl" data-game-background="ambient" aria-hidden="true">
    <CharacterField settings={ambient} reducedMotion={reducedMotion} reducedTransparency={reducedTransparency} tint={ambient.syncBoard ? BOARD_SEEDS[settings.palette] : ambient.tint} />
  </div>;
}
