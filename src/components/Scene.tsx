"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls, ContactShadows } from "@react-three/drei";
import { Building } from "./Building";
import { Markers } from "./Markers";
import { OrderFlow } from "./OrderFlow";
import { useRyokan } from "@/lib/client/store";

export function Scene() {
  const clearFocus = useRyokan((s) => s.setFocus);

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [18, 16, 22], fov: 42 }}
      style={{ width: "100%", height: "100%" }}
      onPointerMissed={() => clearFocus(null)}
    >
      <color attach="background" args={["#060a14"]} />
      <fog attach="fog" args={["#060a14", 35, 75]} />

      <ambientLight intensity={0.6} />
      <directionalLight position={[15, 25, 12]} intensity={1.1} castShadow />
      <directionalLight position={[-12, 10, -10]} intensity={0.4} color="#38bdf8" />

      <Building />
      <Markers />
      <OrderFlow />

      {/* 接地影と地面 */}
      <ContactShadows position={[0, -0.01, 0]} opacity={0.5} scale={50} blur={2.5} far={20} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[120, 120]} />
        <meshStandardMaterial color="#0a1020" roughness={1} />
      </mesh>
      <gridHelper args={[120, 60, "#1e293b", "#13203a"]} position={[0, 0, 0]} />

      <OrbitControls
        target={[0, 4, 0]}
        enableDamping
        dampingFactor={0.08}
        minDistance={10}
        maxDistance={60}
        maxPolarAngle={Math.PI / 2.05}
      />
    </Canvas>
  );
}
