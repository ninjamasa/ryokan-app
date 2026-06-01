// 旅館サイボーグ — サーバー側シミュレーション(インメモリ・シングルトン)
//
// Next.js の単一プロセス内で動く「旅館の頭脳」。
//  - 従業員の移動 / タスク計画の進行
//  - お客様のざっくりした行動
//  - ドリンク注文のライフサイクル(調理→配膳)
// を一定間隔(tick)で進め、SSE 経由で全クライアントへ配信する。
//
// 注意: 開発時のホットリロードでも状態と setInterval が二重化しないよう
// globalThis にシングルトンを保持する。

import {
  Guest,
  Order,
  OrderItem,
  RyokanEvent,
  RyokanState,
  Staff,
  StaffRole,
  Vec3,
} from "./types";
import {
  DINING_ID,
  FLOOR_HEIGHT,
  GUEST_ROOM_IDS,
  KITCHEN_ID,
  ROOMS,
  STAND_OFFSET,
  getRoom,
  stairPos,
  standPos,
  standY,
} from "./layout";

const TICK_MS = 400;
const MOVE_SPEED = 0.55; // units / tick
const ARRIVE_EPS = 0.25;
const COOK_TICKS = Math.round(7000 / TICK_MS); // 約7秒で調理完了
const DONE_LINGER_TICKS = Math.round(6000 / TICK_MS); // 完了表示を残す時間

type Subscriber = (e: RyokanEvent) => void;

interface SimInternals {
  tick: number;
  guests: Guest[];
  staff: Staff[];
  orders: Order[];
  subscribers: Set<Subscriber>;
  /** 各スタッフの移動経路(ウェイポイント列) */
  paths: Map<string, Vec3[]>;
  /** 注文ごとの状態タイムスタンプ(tick) */
  orderTimers: Map<string, { phaseStart: number }>;
  timer: ReturnType<typeof setInterval> | null;
}

// ── 初期状態の生成 ─────────────────────────────────────
function initialGuests(): Guest[] {
  const seed: Array<[string, string, Guest["activity"]]> = [
    ["g1", "田中様", "201"],
    ["g2", "佐藤様", "202"],
    ["g3", "鈴木様", "203"],
    ["g4", "高橋様", "204"],
    ["g5", "渡辺様", "205"],
    ["g6", "伊藤様", "206"],
  ].map(([id, name, room]) => [id, name, room]) as any;

  const activities: Guest["activity"][] = [
    "dining",
    "relaxing",
    "bathing",
    "dining",
    "sleeping",
    "out",
  ];

  return seed.map(([id, name, roomId], i) => ({
    id,
    name,
    roomId,
    activity: activities[i],
    satisfaction: 70 + Math.floor(Math.random() * 20),
  }));
}

function initialStaff(): Staff[] {
  const mk = (
    id: string,
    name: string,
    role: StaffRole,
    homeRoom: string,
  ): Staff => ({
    id,
    name,
    role,
    pos: { ...standPos(homeRoom) },
    target: null,
    locationId: homeRoom,
    currentTask: "待機中",
    plan: [],
  });

  const staff: Staff[] = [
    mk("k1", "板長 山本", "kitchen", KITCHEN_ID),
    mk("k2", "調理 中村", "kitchen", KITCHEN_ID),
    mk("s1", "配膳 小林", "serving", DINING_ID),
    mk("s2", "配膳 加藤", "serving", DINING_ID),
    mk("f1", "フロント 吉田", "front", "front"),
    mk("c1", "清掃 松本", "cleaning", "corridor1"),
  ];

  // 初期のタスク計画(UI表示用)
  const planFor: Record<string, Staff["plan"]> = {
    k1: [
      { id: "p-k1-1", label: "夕食の仕込み", locationId: KITCHEN_ID, etaMin: 0 },
      { id: "p-k1-2", label: "ドリンク調理対応", locationId: KITCHEN_ID, etaMin: 5 },
    ],
    k2: [{ id: "p-k2-1", label: "食器準備", locationId: KITCHEN_ID, etaMin: 0 }],
    s1: [
      { id: "p-s1-1", label: "食事処の配膳", locationId: DINING_ID, etaMin: 0 },
      { id: "p-s1-2", label: "客室ドリンク配膳", locationId: "201", etaMin: 10 },
    ],
    s2: [{ id: "p-s2-1", label: "食事処の配膳", locationId: DINING_ID, etaMin: 0 }],
    f1: [
      { id: "p-f1-1", label: "チェックイン応対", locationId: "front", etaMin: 0 },
      { id: "p-f1-2", label: "館内アナウンス", locationId: "front", etaMin: 15 },
    ],
    c1: [
      { id: "p-c1-1", label: "2階廊下の清掃", locationId: "corridor1", etaMin: 0 },
      { id: "p-c1-2", label: "大浴場の点検", locationId: "bath", etaMin: 20 },
    ],
  };
  for (const s of staff) s.plan = planFor[s.id] ?? [];
  return staff;
}

// ── シングルトン取得 ───────────────────────────────────
const g = globalThis as unknown as { __ryokanSim?: SimInternals };

function create(): SimInternals {
  const sim: SimInternals = {
    tick: 0,
    guests: initialGuests(),
    staff: initialStaff(),
    orders: [],
    subscribers: new Set(),
    paths: new Map(),
    orderTimers: new Map(),
    timer: null,
  };
  sim.timer = setInterval(() => step(sim), TICK_MS);
  return sim;
}

function sim(): SimInternals {
  if (!g.__ryokanSim) g.__ryokanSim = create();
  return g.__ryokanSim;
}

// ── ユーティリティ ─────────────────────────────────────
function dist(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function floorOf(y: number): number {
  return Math.round((y - STAND_OFFSET) / FLOOR_HEIGHT);
}

/** 現在地から目的部屋までの経路(必要なら階段を経由)を作る */
function computePath(from: Vec3, toRoomId: string): Vec3[] {
  const to = standPos(toRoomId);
  const fromFloor = floorOf(from.y);
  const toFloor = getRoom(toRoomId).floor;
  if (fromFloor === toFloor) return [to];
  return [stairPos(fromFloor), stairPos(toFloor), to];
}

function setDestination(s: SimInternals, staff: Staff, roomId: string, task: string) {
  s.paths.set(staff.id, computePath(staff.pos, roomId));
  staff.locationId = roomId;
  staff.currentTask = task;
  const next = s.paths.get(staff.id)?.[0] ?? null;
  staff.target = next ? { ...next } : null;
}

function broadcast(s: SimInternals, e: RyokanEvent) {
  for (const fn of s.subscribers) {
    try {
      fn(e);
    } catch {
      /* 個別購読者のエラーは無視 */
    }
  }
}

// ── tick: 1ステップ進める ──────────────────────────────
function step(s: SimInternals) {
  s.tick++;
  moveStaff(s);
  progressOrders(s);
  ambientGuests(s);
  // 毎tick スナップショットを配信(クライアント側で補間)
  broadcast(s, { type: "snapshot", state: snapshot(s) });
}

function moveStaff(s: SimInternals) {
  for (const staff of s.staff) {
    const path = s.paths.get(staff.id);
    if (!path || path.length === 0) {
      staff.target = null;
      continue;
    }
    const wp = path[0];
    const d = dist(staff.pos, wp);
    if (d <= MOVE_SPEED || d < ARRIVE_EPS) {
      staff.pos = { ...wp };
      path.shift();
      staff.target = path[0] ? { ...path[0] } : null;
    } else {
      const t = MOVE_SPEED / d;
      staff.pos = {
        x: staff.pos.x + (wp.x - staff.pos.x) * t,
        y: staff.pos.y + (wp.y - staff.pos.y) * t,
        z: staff.pos.z + (wp.z - staff.pos.z) * t,
      };
    }
  }
}

function busyCooks(s: SimInternals): Set<string> {
  const set = new Set<string>();
  for (const o of s.orders) if (o.phase === "cooking" && o.cookId) set.add(o.cookId);
  return set;
}
function busyServers(s: SimInternals): Set<string> {
  const set = new Set<string>();
  for (const o of s.orders) if (o.phase === "delivering" && o.serverId) set.add(o.serverId);
  return set;
}

function progressOrders(s: SimInternals) {
  const cooksBusy = busyCooks(s);
  const serversBusy = busyServers(s);

  for (const o of s.orders) {
    const timer = s.orderTimers.get(o.id);
    switch (o.phase) {
      case "placed": {
        // 空いている調理スタッフを割り当て(全員塞がっていれば厨房に滞留=タスクが溜まる)
        const cook = s.staff.find((st) => st.role === "kitchen" && !cooksBusy.has(st.id));
        if (cook) {
          cooksBusy.add(cook.id);
          o.cookId = cook.id;
          o.phase = "cooking";
          o.updatedAt = Date.now();
          s.orderTimers.set(o.id, { phaseStart: s.tick });
          cook.currentTask = `調理中: ${getRoom(o.roomId).name} ドリンク`;
          broadcast(s, { type: "order:update", order: { ...o } });
        }
        break;
      }
      case "cooking": {
        if (timer && s.tick - timer.phaseStart >= COOK_TICKS) {
          o.phase = "ready";
          o.updatedAt = Date.now();
          s.orderTimers.set(o.id, { phaseStart: s.tick });
          const cook = s.staff.find((st) => st.id === o.cookId);
          if (cook) cook.currentTask = "待機中";
          broadcast(s, { type: "order:update", order: { ...o } });
        }
        break;
      }
      case "ready": {
        // 空いている配膳スタッフを割り当て(全員塞がっていれば配膳待ちが溜まる)
        const server = s.staff.find(
          (st) => st.role === "serving" && !serversBusy.has(st.id),
        );
        if (server) {
          serversBusy.add(server.id);
          o.serverId = server.id;
          o.phase = "delivering";
          o.updatedAt = Date.now();
          s.orderTimers.set(o.id, { phaseStart: s.tick });
          setDestination(s, server, o.roomId, `配膳中: ${getRoom(o.roomId).name}`);
          broadcast(s, { type: "order:update", order: { ...o } });
        }
        break;
      }
      case "delivering": {
        const server = s.staff.find((st) => st.id === o.serverId);
        if (server) {
          const arrived = dist(server.pos, standPos(o.roomId)) < ARRIVE_EPS + 0.1;
          const pathDone = (s.paths.get(server.id)?.length ?? 0) === 0;
          if (arrived && pathDone) {
            completeDelivery(s, o, server);
          }
        }
        break;
      }
      case "done":
        // 一定時間後にボードから消す
        if (timer && s.tick - timer.phaseStart >= DONE_LINGER_TICKS) {
          (o as Order & { _remove?: boolean })._remove = true;
        }
        break;
    }
  }

  // 完了から時間が経った注文を除去
  const before = s.orders.length;
  s.orders = s.orders.filter((o) => !(o as any)._remove);
  if (s.orders.length !== before) {
    broadcast(s, { type: "snapshot", state: snapshot(s) });
  }
}

function completeDelivery(s: SimInternals, o: Order, server: Staff) {
  o.phase = "done";
  o.updatedAt = Date.now();
  s.orderTimers.set(o.id, { phaseStart: s.tick });
  // お客様の満足度を上げる
  const guest = s.guests.find((gst) => gst.roomId === o.roomId);
  if (guest) guest.satisfaction = Math.min(100, guest.satisfaction + 4);
  // 配膳スタッフは食事処へ戻る
  setDestination(s, server, DINING_ID, "待機中");
  broadcast(s, { type: "order:update", order: { ...o } });
}

// お客様のざっくりした行動を時々変化させる
function ambientGuests(s: SimInternals) {
  if (s.tick % Math.round(9000 / TICK_MS) !== 0) return;
  const transitions: Record<Guest["activity"], Guest["activity"][]> = {
    dining: ["relaxing", "dining"],
    relaxing: ["bathing", "dining", "sleeping"],
    bathing: ["relaxing"],
    sleeping: ["sleeping", "relaxing"],
    out: ["checkin", "out"],
    checkin: ["relaxing"],
  };
  const guest = s.guests[Math.floor(Math.random() * s.guests.length)];
  const opts = transitions[guest.activity];
  guest.activity = opts[Math.floor(Math.random() * opts.length)];
}

// ── スナップショット ───────────────────────────────────
function snapshot(s: SimInternals): RyokanState {
  return {
    tick: s.tick,
    rooms: ROOMS,
    guests: s.guests.map((x) => ({ ...x })),
    staff: s.staff.map((x) => ({ ...x, pos: { ...x.pos }, plan: [...x.plan] })),
    orders: s.orders.map((x) => ({ ...x, items: [...x.items] })),
  };
}

// ── 公開API ────────────────────────────────────────────
export function getSnapshot(): RyokanState {
  return snapshot(sim());
}

export function subscribe(fn: Subscriber): () => void {
  const s = sim();
  s.subscribers.add(fn);
  // 接続直後に現在のスナップショットを送る
  fn({ type: "snapshot", state: snapshot(s) });
  return () => {
    s.subscribers.delete(fn);
  };
}

let orderSeq = 1;

export function placeOrder(roomId: string, items: OrderItem[]): Order {
  const s = sim();
  getRoom(roomId); // 妥当性チェック
  const now = Date.now();
  const order: Order = {
    id: `o${orderSeq++}-${now.toString(36)}`,
    roomId,
    items: items.length ? items : [{ name: "ビール", qty: 1 }],
    phase: "placed",
    createdAt: now,
    updatedAt: now,
    cookId: null,
    serverId: null,
  };
  s.orders.push(order);
  s.orderTimers.set(order.id, { phaseStart: s.tick });
  broadcast(s, { type: "order:new", order: { ...order } });
  broadcast(s, { type: "snapshot", state: snapshot(s) });
  return order;
}

/** 注文を次のフェーズへ手動で進める(スタッフ操作用) */
export function advanceOrder(orderId: string): Order | null {
  const s = sim();
  const o = s.orders.find((x) => x.id === orderId);
  if (!o) return null;
  switch (o.phase) {
    case "placed": {
      const cook = s.staff.find((st) => st.role === "kitchen");
      o.cookId = cook?.id ?? null;
      o.phase = "cooking";
      if (cook) cook.currentTask = `調理中: ${getRoom(o.roomId).name} ドリンク`;
      break;
    }
    case "cooking":
      o.phase = "ready";
      if (o.cookId) {
        const cook = s.staff.find((st) => st.id === o.cookId);
        if (cook) cook.currentTask = "待機中";
      }
      break;
    case "ready": {
      const server =
        s.staff.find((st) => st.role === "serving" && !busyServers(s).has(st.id)) ??
        s.staff.find((st) => st.role === "serving");
      o.serverId = server?.id ?? null;
      o.phase = "delivering";
      if (server) setDestination(s, server, o.roomId, `配膳中: ${getRoom(o.roomId).name}`);
      break;
    }
    case "delivering": {
      const server = s.staff.find((st) => st.id === o.serverId);
      if (server) {
        s.paths.set(server.id, []);
        server.pos = { ...standPos(o.roomId) };
        completeDelivery(s, o, server);
        broadcast(s, { type: "snapshot", state: snapshot(s) });
        return o;
      }
      o.phase = "done";
      break;
    }
    case "done":
      return o;
  }
  o.updatedAt = Date.now();
  s.orderTimers.set(o.id, { phaseStart: s.tick });
  broadcast(s, { type: "order:update", order: { ...o } });
  broadcast(s, { type: "snapshot", state: snapshot(s) });
  return o;
}

// プロセス起動時にシミュレーションを開始しておく
sim();
