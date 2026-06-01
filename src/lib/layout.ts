// 旅館の空間レイアウト定義
// 3Dシーンの描画座標と、サーバーシミュレーションの移動ロジックが
// 同じ座標系を参照できるよう一箇所に集約する。

import type { Room, Vec3 } from "./types";

export const FLOOR_HEIGHT = 4;
/** 各階で人やオブジェクトが立つ高さ(床からのオフセット) */
export const STAND_OFFSET = 0.6;

export const BUILDING = {
  width: 20, // x方向
  depth: 14, // z方向
  floors: 2,
};

/** 階番号から床のワールドY座標 */
export function floorBaseY(floor: number): number {
  return floor * FLOOR_HEIGHT;
}

/** 階の立ち位置Y */
export function standY(floor: number): number {
  return floorBaseY(floor) + STAND_OFFSET;
}

// 部屋定義 ─────────────────────────────────────────────
// floor 0: フロント / 大浴場 / 食事処 / 厨房 / 廊下
// floor 1: 客室 6室 / 廊下
export const ROOMS: Room[] = [
  // ── 1階 (floor 0) ──
  { id: "front", name: "フロント", kind: "front", floor: 0, pos: v(-6.5, 4.5), size: { w: 5, d: 3 } },
  { id: "dining", name: "食事処", kind: "dining", floor: 0, pos: v(3, 4.5), size: { w: 8, d: 3 } },
  { id: "kitchen", name: "厨房", kind: "kitchen", floor: 0, pos: v(6.5, -4.5), size: { w: 5, d: 3 } },
  { id: "bath", name: "大浴場", kind: "bath", floor: 0, pos: v(-6.5, -4.5), size: { w: 5, d: 3 } },
  { id: "corridor0", name: "1階廊下", kind: "corridor", floor: 0, pos: v(0, 0), size: { w: 17, d: 2 } },

  // ── 2階 (floor 1) ── 客室
  { id: "201", name: "客室 201 月の間", kind: "guest", floor: 1, pos: v(-6.5, 4.5), size: { w: 4, d: 3 } },
  { id: "202", name: "客室 202 雪の間", kind: "guest", floor: 1, pos: v(-2, 4.5), size: { w: 4, d: 3 } },
  { id: "203", name: "客室 203 花の間", kind: "guest", floor: 1, pos: v(2, 4.5), size: { w: 4, d: 3 } },
  { id: "204", name: "客室 204 風の間", kind: "guest", floor: 1, pos: v(6.5, 4.5), size: { w: 4, d: 3 } },
  { id: "205", name: "客室 205 星の間", kind: "guest", floor: 1, pos: v(-4.5, -4.5), size: { w: 4, d: 3 } },
  { id: "206", name: "客室 206 海の間", kind: "guest", floor: 1, pos: v(4.5, -4.5), size: { w: 4, d: 3 } },
  { id: "corridor1", name: "2階廊下", kind: "corridor", floor: 1, pos: v(0, 0), size: { w: 17, d: 2 } },
];

// 部屋中心の立ち位置(人が立つ高さ)を返すヘルパ
function v(x: number, z: number): Vec3 {
  // floor は ROOMS 側で持つので、Y は後段の standPos で確定させる。
  // ここでは床平面上の中心を保持(Yは floorBaseY で上書き)。
  return { x, y: 0, z };
}

const roomMap = new Map(ROOMS.map((r) => [r.id, r]));

export function getRoom(id: string): Room {
  const r = roomMap.get(id);
  if (!r) throw new Error(`unknown room: ${id}`);
  return r;
}

/** 部屋の「立ち位置」ワールド座標(床上) */
export function standPos(roomId: string): Vec3 {
  const r = getRoom(roomId);
  return { x: r.pos.x, y: standY(r.floor), z: r.pos.z };
}

/** 主要拠点ID */
export const KITCHEN_ID = "kitchen";
export const FRONT_ID = "front";
export const DINING_ID = "dining";

export const GUEST_ROOM_IDS = ROOMS.filter((r) => r.kind === "guest").map((r) => r.id);

/** 階段(エレベータ)位置: 廊下の端。階移動の中継点として使う */
export const STAIR_XZ = { x: -8.5, z: 0 };

export function stairPos(floor: number): Vec3 {
  return { x: STAIR_XZ.x, y: standY(floor), z: STAIR_XZ.z };
}
