"use client";

import { use } from "react";
import { GameScreen } from "@/components/chess/GameScreen";

/** Deep link target (Time Machine branches, MCP create_branch results). */
export default function GamePage({ params }: { params: Promise<{ gameKey: string }> }) {
  const { gameKey } = use(params);
  return <GameScreen key={gameKey} gameKey={gameKey} defaults={{ mode: "full_power", opponentId: "full-power-standard", humanColor: "w" }} />;
}
