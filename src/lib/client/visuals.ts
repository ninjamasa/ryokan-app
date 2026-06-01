// 3D表示・UI共通の配色とラベル
import type { GuestActivity, OrderPhase, RoomKind, StaffRole } from "@/lib/types";

export const ROOM_COLOR: Record<RoomKind, string> = {
  guest: "#7dd3fc",
  kitchen: "#fca5a5",
  dining: "#fcd34d",
  bath: "#a5b4fc",
  front: "#86efac",
  corridor: "#94a3b8",
};

export const ROLE_COLOR: Record<StaffRole, string> = {
  kitchen: "#ef4444",
  serving: "#f59e0b",
  front: "#22c55e",
  cleaning: "#3b82f6",
};

export const ROLE_LABEL: Record<StaffRole, string> = {
  kitchen: "調理",
  serving: "配膳",
  front: "フロント",
  cleaning: "清掃",
};

export const ACTIVITY_COLOR: Record<GuestActivity, string> = {
  dining: "#f59e0b",
  relaxing: "#34d399",
  bathing: "#60a5fa",
  sleeping: "#a78bfa",
  out: "#9ca3af",
  checkin: "#f472b6",
};

export const ACTIVITY_LABEL: Record<GuestActivity, string> = {
  dining: "食事中",
  relaxing: "くつろぎ中",
  bathing: "入浴中",
  sleeping: "就寝中",
  out: "外出中",
  checkin: "チェックイン中",
};

export const PHASE_LABEL: Record<OrderPhase, string> = {
  placed: "注文受付",
  cooking: "調理中",
  ready: "配膳待ち",
  delivering: "配膳中",
  done: "完了",
};

export const PHASE_COLOR: Record<OrderPhase, string> = {
  placed: "#f472b6",
  cooking: "#ef4444",
  ready: "#f59e0b",
  delivering: "#22c55e",
  done: "#64748b",
};
