import { ImageResponse } from "next/og";

export const alt = "One Wallet Radar — event, venue and organizer leads in Thailand";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Generated rather than shipped as a file: no binary in the repo, and the text
// stays in step with the copy. onewallet.co.th publishes no og:image at all.
export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "#fbfaf8",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 28 }}>
          <div style={{ width: 28, height: 28, borderRadius: 14, background: "#ff5c00" }} />
          <div style={{ fontSize: 30, color: "#6b6b6b", letterSpacing: 1 }}>ONE WALLET RADAR</div>
        </div>
        <div style={{ fontSize: 66, color: "#1a1a1a", lineHeight: 1.15, fontWeight: 700 }}>
          Events, venues and organizers
        </div>
        <div style={{ fontSize: 66, color: "#ff5c00", lineHeight: 1.15, fontWeight: 700 }}>
          Bangkok · Chiang Mai · Phuket
        </div>
        <div style={{ fontSize: 30, color: "#6b6b6b", marginTop: 34 }}>
          Upcoming events and the partners behind them, as a spreadsheet.
        </div>
      </div>
    ),
    size,
  );
}
