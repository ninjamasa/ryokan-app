"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import type { Order } from "@/lib/types";
import { KITCHEN_ID, standPos } from "@/lib/layout";
import { PHASE_COLOR, PHASE_LABEL } from "@/lib/client/visuals";
import { useRyokan } from "@/lib/client/store";

const FLY_MS = 1100; // 注文受付→厨房へ「瞬時に流れる」時間
const LIFT = 1.7; // 床からの浮遊高さ

export function OrderFlow() {
  const orders = useRyokan((s) => s.state?.orders ?? []);
  return (
    <group>
      {orders.map((o) => (
        <OrderToken key={o.id} order={o} />
      ))}
    </group>
  );
}

function OrderToken({ order }: { order: Order }) {
  const ref = useRef<THREE.Group>(null);
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  const mountAt = useRef<number>(performance.now());
  const focusRoom = useRyokan((s) => s.setFocus);

  const room = standPos(order.roomId);
  const kitchen = standPos(KITCHEN_ID);

  useFrame(() => {
    const grp = ref.current;
    if (!grp) return;
    const now = performance.now();
    const t = now / 1000;
    const bob = Math.sin(t * 3) * 0.08;
    let x = kitchen.x,
      y = kitchen.y + LIFT,
      z = kitchen.z,
      opacity = 1;

    // 最新の状態をフレーム内で直接参照(購読による再描画を避ける)
    const live = useRyokan.getState().state;
    const cur = live?.orders.find((o) => o.id === order.id) ?? order;

    switch (cur.phase) {
      case "placed": {
        // 客室 → 厨房 へ弧を描いて飛ぶ
        const f = Math.min(1, (now - mountAt.current) / FLY_MS);
        const e = 1 - Math.pow(1 - f, 3); // ease-out
        x = room.x + (kitchen.x - room.x) * e;
        y = room.y + LIFT + (kitchen.y - room.y) * e + Math.sin(e * Math.PI) * 2.2;
        z = room.z + (kitchen.z - room.z) * e;
        break;
      }
      case "cooking":
      case "ready":
        x = kitchen.x;
        y = kitchen.y + LIFT + bob;
        z = kitchen.z;
        break;
      case "delivering": {
        // 担当の配膳スタッフに同行して運ばれる
        const server = live?.staff.find((s) => s.id === cur.serverId);
        const p = server?.pos ?? kitchen;
        x = p.x;
        y = p.y + 1.4 + bob;
        z = p.z;
        break;
      }
      case "done": {
        // 上昇しながらフェードアウト
        const f = Math.min(1, (now - mountAt.current) / 1500);
        x = room.x;
        y = room.y + LIFT + f * 1.5;
        z = room.z;
        opacity = 1 - f * 0.8;
        break;
      }
    }

    grp.position.set(x, y, z);
    grp.rotation.y = t * 1.5;
    if (matRef.current) matRef.current.opacity = opacity;
  });

  const color = PHASE_COLOR[order.phase];

  return (
    <group
      ref={ref}
      onClick={(e) => {
        e.stopPropagation();
        focusRoom({ kind: "room", id: order.roomId });
      }}
    >
      <mesh>
        <icosahedronGeometry args={[0.3, 0]} />
        <meshStandardMaterial
          ref={matRef}
          color={color}
          emissive={color}
          emissiveIntensity={1.1}
          transparent
          roughness={0.2}
        />
      </mesh>
      {/* 光の粒(オーラ) */}
      <pointLight color={color} intensity={2} distance={3} />
      <Html center distanceFactor={22} occlude={false} zIndexRange={[30, 0]}>
        <div
          style={{
            pointerEvents: "none",
            whiteSpace: "nowrap",
            fontSize: 9,
            fontWeight: 700,
            color: "#0b1220",
            background: color,
            padding: "1px 6px",
            borderRadius: 8,
            transform: "translateY(-22px)",
            boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
          }}
        >
          {PHASE_LABEL[order.phase]}
        </div>
      </Html>
    </group>
  );
}
