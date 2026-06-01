// 旅館サイボーグ ドメインモデル
// 3D空間とサーバーシミュレーションで共有する型定義

export type Vec3 = { x: number; y: number; z: number };

// ── 空間 ───────────────────────────────────────────────
export type RoomKind = "guest" | "kitchen" | "dining" | "bath" | "front" | "corridor";

export interface Room {
  id: string;
  name: string;
  kind: RoomKind;
  floor: number;
  /** 部屋中心のワールド座標 */
  pos: Vec3;
  /** 部屋の広さ (x,z) */
  size: { w: number; d: number };
}

// ── お客様 ─────────────────────────────────────────────
export type GuestActivity =
  | "dining" // 食事中
  | "relaxing" // くつろぎ中
  | "bathing" // 入浴中
  | "sleeping" // 就寝
  | "out" // 外出中
  | "checkin"; // チェックイン手続き

export interface Guest {
  id: string;
  name: string;
  roomId: string;
  activity: GuestActivity;
  /** 滞在の満足度の簡易指標 0-100 */
  satisfaction: number;
}

// ── 従業員 ─────────────────────────────────────────────
export type StaffRole = "kitchen" | "serving" | "front" | "cleaning";

export interface PlannedTask {
  id: string;
  label: string;
  /** 向かう場所(部屋ID) */
  locationId: string;
  /** 予定開始からの相対分。UI表示用 */
  etaMin: number;
}

export interface Staff {
  id: string;
  name: string;
  role: StaffRole;
  /** 現在のワールド座標 */
  pos: Vec3;
  /** 移動目標 (なければ待機) */
  target: Vec3 | null;
  /** 現在向かっている/作業している部屋ID */
  locationId: string;
  /** 現在のタスク説明 */
  currentTask: string;
  /** この先の計画タスク列 */
  plan: PlannedTask[];
}

// ── 注文 / タスク ──────────────────────────────────────
export type OrderItem = {
  name: string;
  qty: number;
};

// 注文のライフサイクル: 受付 → 調理 → 配膳待ち → 配膳中 → 完了
export type OrderPhase =
  | "placed" // お客様がボタンを押した直後 (調理場へ流れる)
  | "cooking" // 調理場が着手
  | "ready" // 配膳待ち (配膳係へ流れる)
  | "delivering" // 配膳係が運搬中
  | "done"; // 配膳完了 (タスク消化)

export interface Order {
  id: string;
  roomId: string;
  items: OrderItem[];
  phase: OrderPhase;
  createdAt: number;
  updatedAt: number;
  /** 担当中の調理スタッフ */
  cookId: string | null;
  /** 担当中の配膳スタッフ */
  serverId: string | null;
}

// ── スナップショット (クライアントへ配信する全体像) ──────
export interface RyokanState {
  tick: number;
  rooms: Room[];
  guests: Guest[];
  staff: Staff[];
  orders: Order[];
}

// SSE で流すイベント
export type RyokanEvent =
  | { type: "snapshot"; state: RyokanState }
  | { type: "order:new"; order: Order }
  | { type: "order:update"; order: Order };
