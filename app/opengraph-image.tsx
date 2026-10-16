import { ImageResponse } from "next/og";

export const alt = "Chess by Chaos — free chess, interactive lessons, and game review";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(<div style={{ width: "100%", height: "100%", display: "flex", background: "#f6f4ef", color: "#1d1c1a", padding: 72, alignItems: "center", justifyContent: "space-between" }}>
    <div style={{ display: "flex", flexDirection: "column", width: 690 }}>
      <div style={{ fontSize: 23, letterSpacing: 5, color: "#6d6a64" }}>PLAY. LEARN. REPLAY.</div>
      <div style={{ fontSize: 90, fontWeight: 700, lineHeight: 1.05, marginTop: 28 }}>Chess by Chaos</div>
      <div style={{ fontSize: 28, marginTop: 32, color: "#6d6a64" }}>Your free, open-source chess gym.</div>
      <div style={{ fontSize: 22, marginTop: 50 }}>chess.chaos.fail</div>
    </div>
    <div style={{ display: "flex", flexWrap: "wrap", width: 256, height: 256, border: "8px solid #1d1c1a", borderRadius: 8, overflow: "hidden" }}>{Array.from({ length: 16 }, (_, i) => <div key={i} style={{ width: 60, height: 60, background: (Math.floor(i / 4) + i % 4) % 2 ? "#c3a982" : "#efe6d5" }} />)}</div>
  </div>, size);
}
