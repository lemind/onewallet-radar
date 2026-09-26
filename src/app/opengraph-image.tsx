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
          {/* The brand mark from src/app/icon.svg, inlined: Satori cannot read a local file. */}
          <img src="data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20140%20133%22%20width%3D%2232%22%20height%3D%2232%22%3E%3Cpath%20d%3D%22M123.397%2025.1582C98.4442%20-4.21374%2054.1895%20-7.86863%2024.7309%2017.0109C-4.72771%2041.8905%20-8.39326%2086.015%2016.5597%20115.387C24.941%20125.247%2036.6442%20131.263%2049.5693%20132.329C50.9439%20132.443%2052.2994%20132.5%2053.6549%20132.5C65.11%20132.5%2076.0878%20128.503%2084.9273%20121.041C95.1223%20112.418%20101.365%2099.8349%20102.014%2086.529C102.014%2086.529%20102.014%2085.8248%20102.014%2085.4821C102.014%2067.8932%2087.6574%2053.5593%2069.9975%2053.5593C52.3376%2053.5593%2037.9806%2067.8742%2037.9806%2085.4821C37.9806%2098.1789%2045.4646%20109.162%2056.2514%20114.302C54.5522%20114.454%2052.8148%20114.454%2051.0775%20114.302C43.0017%20113.636%2035.6514%20109.867%2030.4203%20103.699C11.9395%2081.9414%2014.6505%2049.2382%2036.4724%2030.8117C58.2942%2012.3853%2091.0938%2015.0883%20109.575%2036.846C118.051%2046.8207%20122.385%2059.4984%20121.813%2072.5378C121.24%2085.5201%20115.856%2097.6839%20106.673%20106.821L119.483%20119.632C131.893%20107.297%20139.148%2090.8501%20139.931%2073.3374C140.713%2055.7294%20134.852%2038.6164%20123.416%2025.1582M69.9784%2071.6241C77.6342%2071.6241%2083.8581%2077.8298%2083.8581%2085.4631C83.8581%2093.0963%2077.6342%2099.3019%2069.9784%2099.3019C62.3226%2099.3019%2056.0986%2093.0963%2056.0986%2085.4631C56.0986%2077.8298%2062.3226%2071.6241%2069.9784%2071.6241Z%22%20fill%3D%22%23FF5C00%22%2F%3E%3C%2Fsvg%3E" width={30} height={30} alt="" />
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
