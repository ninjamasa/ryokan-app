"use client";

import { useState, type CSSProperties } from "react";
import { EMPTY, useRyokan } from "@/lib/client/store";
import { PHASE_COLOR, PHASE_LABEL } from "@/lib/client/visuals";
import type { Order } from "@/lib/types";

const NEXT_ACTION: Partial<Record<Order["phase"], string>> = {
  placed: "調理開始",
  cooking: "調理完了",
  ready: "配膳に出発",
  delivering: "配膳完了",
};

export function TaskBoard() {
  const orders = useRyokan((s) => s.state?.orders ?? EMPTY);
  const rooms = useRyokan((s) => s.state?.rooms ?? EMPTY);
  const advance = useRyokan((s) => s.advanceOrder);
  const setFocus = useRyokan((s) => s.setFocus);
  const [open, setOpen] = useState(true);

  const roomName = (id: string) => rooms.find((r) => r.id === id)?.name ?? id;

  // 厨房タスク: 受付/調理中, 配膳タスク: 配膳待ち/配膳中
  const kitchen = orders.filter((o) => o.phase === "placed" || o.phase === "cooking");
  const serving = orders.filter((o) => o.phase === "ready" || o.phase === "delivering");
  const done = orders.filter((o) => o.phase === "done");

  const Item = (o: Order) => (
    <div key={o.id} style={item} onClick={() => setFocus({ kind: "room", id: o.roomId })}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <strong style={{ fontSize: 13 }}>{roomName(o.roomId)}</strong>
        <span style={{ ...pill, background: PHASE_COLOR[o.phase] }}>{PHASE_LABEL[o.phase]}</span>
      </div>
      <div style={{ fontSize: 12, opacity: 0.85, margin: "4px 0" }}>
        {o.items.map((i) => `${i.name}×${i.qty}`).join(", ")}
      </div>
      {NEXT_ACTION[o.phase] && (
        <button
          style={advanceBtn}
          onClick={(e) => {
            e.stopPropagation();
            advance(o.id);
          }}
        >
          {NEXT_ACTION[o.phase]} ▶
        </button>
      )}
    </div>
  );

  if (!open) {
    return (
      <button style={{ ...toggle, bottom: 16 }} onClick={() => setOpen(true)}>
        タスクボード ▲ ({kitchen.length + serving.length})
      </button>
    );
  }

  return (
    <div style={board}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <strong style={{ fontSize: 14 }}>リアルタイム・タスクボード</strong>
        <button style={toggleInline} onClick={() => setOpen(false)}>
          ▼
        </button>
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <Column title={`🍳 厨房 (${kitchen.length})`} color="#ef4444">
          {kitchen.length === 0 ? <Empty /> : kitchen.map(Item)}
        </Column>
        <Column title={`🛎 配膳 (${serving.length})`} color="#f59e0b">
          {serving.length === 0 ? <Empty /> : serving.map(Item)}
        </Column>
        <Column title={`✅ 完了 (${done.length})`} color="#64748b">
          {done.length === 0 ? <Empty /> : done.map(Item)}
        </Column>
      </div>
    </div>
  );
}

function Column({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <div style={{ flex: 1, minWidth: 150 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color, marginBottom: 6 }}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 200, overflowY: "auto" }}>
        {children}
      </div>
    </div>
  );
}
function Empty() {
  return <div style={{ fontSize: 11, opacity: 0.4, padding: "8px 0" }}>なし</div>;
}

const board: CSSProperties = {
  position: "absolute",
  bottom: 16,
  left: 16,
  width: 540,
  maxWidth: "calc(100vw - 32px)",
  background: "rgba(10,16,30,0.82)",
  backdropFilter: "blur(10px)",
  border: "1px solid rgba(56,189,248,0.25)",
  borderRadius: 14,
  padding: 14,
  color: "#e2e8f0",
  boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
  zIndex: 20,
};
const item: CSSProperties = {
  background: "rgba(30,41,59,0.6)",
  border: "1px solid #334155",
  borderRadius: 10,
  padding: 8,
  cursor: "pointer",
};
const pill: CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  padding: "1px 6px",
  borderRadius: 999,
  color: "#0b1220",
};
const advanceBtn: CSSProperties = {
  width: "100%",
  background: "#0ea5e9",
  border: "none",
  color: "#04121f",
  fontWeight: 700,
  padding: "5px 0",
  borderRadius: 8,
  cursor: "pointer",
  fontSize: 12,
};
const toggle: CSSProperties = {
  position: "absolute",
  left: 16,
  background: "rgba(10,16,30,0.9)",
  border: "1px solid rgba(56,189,248,0.3)",
  color: "#e2e8f0",
  padding: "8px 14px",
  borderRadius: 10,
  cursor: "pointer",
  zIndex: 20,
};
const toggleInline: CSSProperties = {
  background: "transparent",
  border: "none",
  color: "#94a3b8",
  cursor: "pointer",
};
