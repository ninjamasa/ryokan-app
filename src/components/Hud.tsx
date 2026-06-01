"use client";

import type { CSSProperties } from "react";
import { useRyokan } from "@/lib/client/store";
import { ACTIVITY_COLOR, ACTIVITY_LABEL, ROLE_COLOR, ROLE_LABEL } from "@/lib/client/visuals";

export function Hud() {
  const connected = useRyokan((s) => s.connected);
  const state = useRyokan((s) => s.state);

  const activeOrders = state?.orders.filter((o) => o.phase !== "done").length ?? 0;
  const guests = state?.guests ?? [];
  const avgSat = guests.length
    ? Math.round(guests.reduce((a, g) => a + g.satisfaction, 0) / guests.length)
    : 0;
  const dining = guests.filter((g) => g.activity === "dining").length;

  return (
    <div style={wrap}>
      <div style={header}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: 0.5 }}>
            旅館サイボーグ <span style={{ opacity: 0.6, fontWeight: 400, fontSize: 13 }}>Total Support</span>
          </div>
          <div style={{ fontSize: 11, opacity: 0.6 }}>館内デジタルツイン・プロトタイプ</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: connected ? "#22c55e" : "#ef4444",
              boxShadow: connected ? "0 0 8px #22c55e" : "none",
            }}
          />
          {connected ? "同期中" : "未接続"}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <Kpi label="進行中の注文" value={activeOrders} />
        <Kpi label="食事中" value={dining} />
        <Kpi label="平均満足度" value={avgSat} />
      </div>

      <div style={{ marginTop: 12 }}>
        <Legend />
      </div>
      <div style={{ fontSize: 10, opacity: 0.45, marginTop: 10, lineHeight: 1.5 }}>
        建物内をドラッグで回転 / スクロールでズーム。<br />
        部屋・スタッフ・お客様をクリックすると詳細が表示されます。
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div style={kpi}>
      <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 10, opacity: 0.6, marginTop: 4 }}>{label}</div>
    </div>
  );
}

function Legend() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={legendRow}>
        {(["kitchen", "serving", "front", "cleaning"] as const).map((r) => (
          <span key={r} style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ color: ROLE_COLOR[r] }}>●</span>
            {ROLE_LABEL[r]}
          </span>
        ))}
      </div>
      <div style={legendRow}>
        {(["dining", "relaxing", "bathing", "sleeping"] as const).map((a) => (
          <span key={a} style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ color: ACTIVITY_COLOR[a] }}>◆</span>
            {ACTIVITY_LABEL[a]}
          </span>
        ))}
      </div>
    </div>
  );
}

const wrap: CSSProperties = {
  position: "absolute",
  top: 16,
  left: 16,
  width: 300,
  background: "rgba(10,16,30,0.82)",
  backdropFilter: "blur(10px)",
  border: "1px solid rgba(56,189,248,0.25)",
  borderRadius: 14,
  padding: 16,
  color: "#e2e8f0",
  boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
  zIndex: 20,
};
const header: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
};
const kpi: CSSProperties = {
  flex: 1,
  background: "rgba(30,41,59,0.5)",
  border: "1px solid #334155",
  borderRadius: 10,
  padding: "10px 8px",
  textAlign: "center",
};
const legendRow: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 10,
};
