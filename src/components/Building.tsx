"use client";

import { useMemo, useState } from "react";
import { Edges, Html } from "@react-three/drei";
import type { Room } from "@/lib/types";
import { BUILDING, FLOOR_HEIGHT, floorBaseY } from "@/lib/layout";
import { ROOM_COLOR } from "@/lib/client/visuals";
import { useRyokan } from "@/lib/client/store";

const TOTAL_H = BUILDING.floors * FLOOR_HEIGHT;

export function Building() {
  const rooms = useRyokan((s) => s.state?.rooms ?? []);

  return (
    <group>
      {/* 建物の外殻(半透明ガラス) */}
      <mesh position={[0, TOTAL_H / 2, 0]}>
        <boxGeometry args={[BUILDING.width + 1, TOTAL_H + 0.4, BUILDING.depth + 1]} />
        <meshStandardMaterial
          color="#bae6fd"
          transparent
          opacity={0.045}
          roughness={0.1}
          metalness={0.1}
          depthWrite={false}
        />
        <Edges color="#38bdf8" />
      </mesh>

      {/* 各階の床スラブ */}
      {Array.from({ length: BUILDING.floors }).map((_, f) => (
        <mesh key={f} position={[0, floorBaseY(f), 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[BUILDING.width, BUILDING.depth]} />
          <meshStandardMaterial
            color="#0f172a"
            transparent
            opacity={0.35}
            roughness={0.9}
          />
        </mesh>
      ))}

      {/* 部屋 */}
      {rooms.map((r) => (
        <RoomBox key={r.id} room={r} />
      ))}
    </group>
  );
}

function RoomBox({ room }: { room: Room }) {
  const setFocus = useRyokan((s) => s.setFocus);
  const focus = useRyokan((s) => s.focus);
  const guest = useRyokan((s) => s.state?.guests.find((g) => g.roomId === room.id));
  const [hover, setHover] = useState(false);

  const isCorridor = room.kind === "corridor";
  const height = isCorridor ? 0.15 : FLOOR_HEIGHT - 0.8;
  const cy = isCorridor
    ? floorBaseY(room.floor) + 0.08
    : floorBaseY(room.floor) + height / 2 + 0.2;

  const selected = focus?.kind === "room" && focus.id === room.id;
  const color = ROOM_COLOR[room.kind];
  const opacity = isCorridor ? 0.22 : selected ? 0.5 : hover ? 0.38 : 0.16;

  const labelPos = useMemo<[number, number, number]>(
    () => [room.pos.x, cy + height / 2 + 0.2, room.pos.z],
    [room.pos.x, room.pos.z, cy, height],
  );

  return (
    <group>
      <mesh
        position={[room.pos.x, cy, room.pos.z]}
        onClick={(e) => {
          e.stopPropagation();
          setFocus({ kind: "room", id: room.id });
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHover(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          setHover(false);
          document.body.style.cursor = "auto";
        }}
      >
        <boxGeometry args={[room.size.w, height, room.size.d]} />
        <meshStandardMaterial
          color={color}
          transparent
          opacity={opacity}
          roughness={0.4}
          emissive={selected ? color : "#000000"}
          emissiveIntensity={selected ? 0.4 : 0}
          depthWrite={false}
        />
        {!isCorridor && (
          <Edges color={color} opacity={selected ? 0.95 : 0.5} transparent />
        )}
      </mesh>

      {!isCorridor && (
        <Html
          position={labelPos}
          center
          distanceFactor={26}
          occlude={false}
          zIndexRange={[10, 0]}
        >
          <div
            style={{
              pointerEvents: "none",
              whiteSpace: "nowrap",
              fontSize: 11,
              fontWeight: 600,
              color: "#e2e8f0",
              textShadow: "0 1px 3px rgba(0,0,0,0.9)",
              background: selected ? "rgba(56,189,248,0.25)" : "transparent",
              padding: "1px 6px",
              borderRadius: 6,
            }}
          >
            {room.name}
            {guest ? ` · ${guest.name}` : ""}
          </div>
        </Html>
      )}
    </group>
  );
}
