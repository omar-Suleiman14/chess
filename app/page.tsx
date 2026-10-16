"use client";

import { GameScreen } from "@/components/chess/GameScreen";

export default function Home() {
  return (
    <GameScreen
      defaults={{ mode: "full_power", opponentId: "full-power-standard", humanColor: "w" }}
      resumeMode={["full_power", "practice", "import"]}
    />
  );
}
