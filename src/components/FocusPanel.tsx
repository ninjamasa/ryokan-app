"use client";

import type { CSSProperties } from "react";
import { useRyokan } from "@/lib/client/store";
import {
  ACTIVITY_COLOR,
  ACTIVITY_LABEL,
  PHASE_COLOR,
  PHASE_LABEL,
  ROLE_COLOR,
  ROLE_LABEL,
} from "@/lib/client/visuals";
import type { OrderItem } from "@/lib/types";

const DRINKS: OrderItem[][] = [
  [{ name: "生ビール", qty: 1 }],
  [{ name: "地酒(冷)", qty: 1 }],
  [{ name: "梅酒", qty: 1 }],
  [{ name: "緑茶", qty: 2 }],
];

export function FocusPanel() {
  const focus = useRyokan((s) => s.focus);
  const state = useRyokan((s) => s.state);
  const setFocus = useRyokan((s) => s.setFocus);

  if (!focus || !state) return null;

  let body: React.ReactNode = null;
  let title = "";

  if (focus.kind === "room") {
    const room = state.rooms.find((r) => r.id === focus.id);
    if (!room) return null;
    title = room.name;
    const guest = state.guests.find((g) => g.roomId === room.id);
    const staffHere = state.staff.filter((s) => s.locationId === room.id);
    const roomOrders = state.orders.filter((o) => o.roomId === room.id);
    body = (
      <>
        <Tag>{room.floor + 1}階 / {room.kind}</Tag>
        {guest && <GuestBlock guestId={guest.id} />}
        {room.kind === "guest" && <OrderButtons roomId={room.id} />}
        {roomOrders.length > 0 && (
          <Section label="この部屋の注文">
            {roomOrders.map((o) => (
              <Row key={o.id}>
                <span>{o.items.map((i) => `${i.name}×${i.qty}`).join(", ")}</span>
                <Pill color={PHASE_COLOR[o.phase]}>{PHASE_LABEL[o.phase]}</Pill>
              </Row>
            ))}
          </Section>
        )}
        {staffHere.length > 0 && (
          <Section label="この場所のスタッフ">
            {staffHere.map((s) => (
              <Row key={s.id}>
                <span>
                  <Dot color={ROLE_COLOR[s.role]} /> {s.name}
                </span>
                <span style={{ opacity: 0.8, fontSize: 12 }}>{s.currentTask}</span>
              </Row>
            ))}
          </Section>
        )}
      </>
    );
  } else if (focus.kind === "staff") {
    const staff = state.staff.find((s) => s.id === focus.id);
    if (!staff) return null;
    title = staff.name;
    const locName = state.rooms.find((r) => r.id === staff.locationId)?.name ?? "館内";
    body = (
      <>
        <Tag color={ROLE_COLOR[staff.role]}>{ROLE_LABEL[staff.role]}</Tag>
        <Section label="現在">
          <Row>
            <span>現在地</span>
            <span>{locName}</span>
          </Row>
          <Row>
            <span>タスク</span>
            <span>{staff.currentTask}</span>
          </Row>
          <Row>
            <span>状態</span>
            <span>{staff.target ? "移動中" : "待機/作業中"}</span>
          </Row>
        </Section>
        <Section label="この先の予定 (タスク計画)">
          {staff.plan.length === 0 && <Muted>予定なし</Muted>}
          {staff.plan.map((p, i) => {
            const where = state.rooms.find((r) => r.id === p.locationId)?.name ?? p.locationId;
            return (
              <Row key={p.id}>
                <span>
                  <span style={{ opacity: 0.5, marginRight: 6 }}>{i + 1}.</span>
                  {p.label} <span style={{ opacity: 0.6 }}>@{where}</span>
                </span>
                <span style={{ opacity: 0.7, fontSize: 12 }}>+{p.etaMin}分</span>
              </Row>
            );
          })}
        </Section>
      </>
    );
  } else if (focus.kind === "guest") {
    title = state.guests.find((g) => g.id === focus.id)?.name ?? "お客様";
    body = <GuestBlock guestId={focus.id} showOrder />;
  }

  return (
    <div style={panel}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>{title}</h2>
        <button style={closeBtn} onClick={() => setFocus(null)}>
          ✕
        </button>
      </div>
      <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 12 }}>
        {body}
      </div>
    </div>
  );
}

function GuestBlock({ guestId, showOrder }: { guestId: string; showOrder?: boolean }) {
  const guest = useRyokan((s) => s.state?.guests.find((g) => g.id === guestId));
  const room = useRyokan((s) => s.state?.rooms.find((r) => r.id === guest?.roomId));
  if (!guest) return null;
  return (
    <Section label="お客様">
      <Row>
        <span>{guest.name}</span>
        <Pill color={ACTIVITY_COLOR[guest.activity]}>{ACTIVITY_LABEL[guest.activity]}</Pill>
      </Row>
      <Row>
        <span>客室</span>
        <span>{room?.name ?? guest.roomId}</span>
      </Row>
      <div style={{ marginTop: 4 }}>
        <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>
          満足度 {guest.satisfaction}
        </div>
        <div style={{ height: 8, borderRadius: 4, background: "#1e293b", overflow: "hidden" }}>
          <div
            style={{
              width: `${guest.satisfaction}%`,
              height: "100%",
              background: guest.satisfaction > 75 ? "#22c55e" : guest.satisfaction > 50 ? "#f59e0b" : "#ef4444",
            }}
          />
        </div>
      </div>
      {showOrder && <OrderButtons roomId={guest.roomId} />}
    </Section>
  );
}

function OrderButtons({ roomId }: { roomId: string }) {
  const placeOrder = useRyokan((s) => s.placeOrder);
  return (
    <Section label="ドリンクを注文 (客室ボタン)">
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {DRINKS.map((items) => (
          <button
            key={items[0].name}
            style={orderBtn}
            onClick={() => placeOrder(roomId, items)}
          >
            🍶 {items[0].name}
          </button>
        ))}
      </div>
      <Muted>押すと注文が厨房・配膳係へ瞬時に流れます</Muted>
    </Section>
  );
}

// ── 小さな表示部品 ─────────────────────────────────────
function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, letterSpacing: 1, opacity: 0.55, marginBottom: 6, textTransform: "uppercase" }}>
        {label}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{children}</div>
    </div>
  );
}
function Row({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13, alignItems: "center" }}>
      {children}
    </div>
  );
}
function Tag({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <span
      style={{
        alignSelf: "flex-start",
        fontSize: 11,
        padding: "2px 8px",
        borderRadius: 999,
        background: color ? `${color}22` : "#1e293b",
        color: color ?? "#cbd5e1",
        border: `1px solid ${color ?? "#334155"}55`,
      }}
    >
      {children}
    </span>
  );
}
function Pill({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: color, color: "#0b1220" }}>
      {children}
    </span>
  );
}
function Dot({ color }: { color: string }) {
  return <span style={{ color }}>●</span>;
}
function Muted({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11, opacity: 0.5 }}>{children}</div>;
}

const panel: CSSProperties = {
  position: "absolute",
  top: 16,
  right: 16,
  width: 320,
  maxHeight: "calc(100vh - 32px)",
  overflowY: "auto",
  background: "rgba(10,16,30,0.82)",
  backdropFilter: "blur(10px)",
  border: "1px solid rgba(56,189,248,0.25)",
  borderRadius: 14,
  padding: 16,
  color: "#e2e8f0",
  boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
  zIndex: 20,
};
const closeBtn: CSSProperties = {
  background: "transparent",
  border: "none",
  color: "#94a3b8",
  cursor: "pointer",
  fontSize: 16,
};
const orderBtn: CSSProperties = {
  background: "linear-gradient(135deg,#1e293b,#0f172a)",
  border: "1px solid #334155",
  color: "#e2e8f0",
  padding: "8px 10px",
  borderRadius: 10,
  cursor: "pointer",
  fontSize: 13,
};
