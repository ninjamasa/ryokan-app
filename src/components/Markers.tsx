"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, Html } from "@react-three/drei";
import * as THREE from "three";
import type { Guest, Staff } from "@/lib/types";
import { ACTIVITY_COLOR, ACTIVITY_LABEL, ROLE_COLOR, ROLE_LABEL } from "@/lib/client/visuals";
import { useRyokan } from "@/lib/client/store";

export function Markers() {
  const staff = useRyokan((s) => s.state?.staff ?? []);
  const guests = useRyokan((s) => s.state?.guests ?? []);
  return (
    <group>
      {staff.map((st) => (
        <StaffMarker key={st.id} staff={st} />
      ))}
      {guests.map((g) => (
        <GuestMarker key={g.id} guest={g} />
      ))}
    </group>
  );
}

function StaffMarker({ staff }: { staff: Staff }) {
  const ref = useRef<THREE.Group>(null);
  const setFocus = useRyokan((s) => s.setFocus);
  const focus = useRyokan((s) => s.focus);
  const selected = focus?.kind === "staff" && focus.id === staff.id;
  const color = ROLE_COLOR[staff.role];

  // スナップショットの目標位置へ毎フレーム補間して滑らかに動かす
  useFrame((_, dt) => {
    const grp = ref.current;
    if (!grp) return;
    const k = 1 - Math.pow(0.001, dt); // フレームレート非依存の追従
    grp.position.x += (staff.pos.x - grp.position.x) * k;
    grp.position.y += (staff.pos.y - grp.position.y) * k;
    grp.position.z += (staff.pos.z - grp.position.z) * k;
  });

  const moving = staff.target != null;

  return (
    <group
      ref={ref}
      position={[staff.pos.x, staff.pos.y, staff.pos.z]}
      onClick={(e) => {
        e.stopPropagation();
        setFocus({ kind: "staff", id: staff.id });
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        document.body.style.cursor = "auto";
      }}
    >
      {/* 体 */}
      <mesh position={[0, 0.55, 0]} castShadow>
        <capsuleGeometry args={[0.22, 0.5, 4, 12]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={moving ? 0.5 : 0.2}
          roughness={0.5}
        />
      </mesh>
      {/* 足元リング(選択時に強調) */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.3, 0.42, 24]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={selected ? 0.95 : 0.4}
          side={THREE.DoubleSide}
        />
      </mesh>

      <Billboard position={[0, 1.5, 0]}>
        <Html center distanceFactor={20} occlude={false} zIndexRange={[20, 0]}>
          <div
            style={{
              pointerEvents: "none",
              whiteSpace: "nowrap",
              fontSize: 10,
              lineHeight: 1.3,
              textAlign: "center",
              color: "#f8fafc",
              textShadow: "0 1px 3px rgba(0,0,0,0.95)",
            }}
          >
            <div style={{ fontWeight: 700 }}>
              <span style={{ color }}>●</span> {staff.name}
            </div>
            <div style={{ opacity: 0.85 }}>
              [{ROLE_LABEL[staff.role]}] {staff.currentTask}
            </div>
          </div>
        </Html>
      </Billboard>
    </group>
  );
}

function GuestMarker({ guest }: { guest: Guest }) {
  const setFocus = useRyokan((s) => s.setFocus);
  const focus = useRyokan((s) => s.focus);
  const room = useRyokan((s) => s.state?.rooms.find((r) => r.id === guest.roomId));
  const selected = focus?.kind === "guest" && focus.id === guest.id;
  if (!room) return null;
  const color = ACTIVITY_COLOR[guest.activity];

  // 部屋内で少しずらして配置(客室マーカー)
  const standYpos = (room.floor + 0) * 4 + 0.6;
  const pos: [number, number, number] = [room.pos.x + 0.9, standYpos + 0.35, room.pos.z - 0.6];

  return (
    <group
      position={pos}
      onClick={(e) => {
        e.stopPropagation();
        setFocus({ kind: "guest", id: guest.id });
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        document.body.style.cursor = "auto";
      }}
    >
      <mesh>
        <sphereGeometry args={[0.28, 16, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.45}
          roughness={0.3}
        />
      </mesh>
      {selected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.33, 0]}>
          <ringGeometry args={[0.36, 0.48, 24]} />
          <meshBasicMaterial color={color} transparent opacity={0.9} side={THREE.DoubleSide} />
        </mesh>
      )}
      <Billboard position={[0, 0.7, 0]}>
        <Html center distanceFactor={20} occlude={false} zIndexRange={[20, 0]}>
          <div
            style={{
              pointerEvents: "none",
              whiteSpace: "nowrap",
              fontSize: 10,
              textAlign: "center",
              color: "#f8fafc",
              textShadow: "0 1px 3px rgba(0,0,0,0.95)",
            }}
          >
            <span style={{ color }}>◆</span> {ACTIVITY_LABEL[guest.activity]}
          </div>
        </Html>
      </Billboard>
    </group>
  );
}
