"use client";

import dynamic from "next/dynamic";

// three.js / WebGL はクライアント専用のため SSR を無効化して読み込む
const Dashboard = dynamic(
  () => import("@/components/Dashboard").then((m) => m.Dashboard),
  {
    ssr: false,
    loading: () => (
      <div
        style={{
          position: "fixed",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#38bdf8",
          fontSize: 14,
        }}
      >
        館内システムを起動中…
      </div>
    ),
  },
);

export default function Page() {
  return <Dashboard />;
}
