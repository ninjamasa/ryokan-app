"use client";

import { create } from "zustand";
import type { OrderItem, RyokanEvent, RyokanState } from "@/lib/types";

// セレクタのフォールバックで使う安定参照の空配列。
// 毎回 `?? []` で新しい配列を作ると useSyncExternalStore が無限ループするため、
// 同一参照を返す必要がある。
export const EMPTY: never[] = [];

export type Focus =
  | { kind: "room"; id: string }
  | { kind: "staff"; id: string }
  | { kind: "guest"; id: string }
  | null;

interface RyokanStore {
  state: RyokanState | null;
  connected: boolean;
  /** 直近に発生した注文(フロー演出のトリガ) */
  lastOrderId: string | null;
  focus: Focus;
  /** SSE 接続を開始 */
  connect: () => () => void;
  setFocus: (f: Focus) => void;
  placeOrder: (roomId: string, items: OrderItem[]) => Promise<void>;
  advanceOrder: (orderId: string) => Promise<void>;
}

export const useRyokan = create<RyokanStore>((set, get) => ({
  state: null,
  connected: false,
  lastOrderId: null,
  focus: null,

  connect: () => {
    const es = new EventSource("/api/stream");
    es.onopen = () => set({ connected: true });
    es.onerror = () => set({ connected: false });
    es.onmessage = (msg) => {
      let evt: RyokanEvent;
      try {
        evt = JSON.parse(msg.data);
      } catch {
        return;
      }
      if (evt.type === "snapshot") {
        set({ state: evt.state });
      } else if (evt.type === "order:new") {
        set({ lastOrderId: evt.order.id });
      }
      // order:update はスナップショットにも反映されるため個別処理は不要
    };
    return () => es.close();
  },

  setFocus: (focus) => set({ focus }),

  placeOrder: async (roomId, items) => {
    await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId, items }),
    });
  },

  advanceOrder: async (orderId) => {
    await fetch(`/api/orders/${orderId}`, { method: "PATCH" });
  },
}));

// 派生セレクタ ------------------------------------------------------
export function useRoom(id: string | null) {
  return useRyokan((s) => (id ? s.state?.rooms.find((r) => r.id === id) ?? null : null));
}
