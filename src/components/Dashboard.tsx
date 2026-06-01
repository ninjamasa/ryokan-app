"use client";

import { useEffect } from "react";
import { Scene } from "./Scene";
import { Hud } from "./Hud";
import { FocusPanel } from "./FocusPanel";
import { TaskBoard } from "./TaskBoard";
import { useRyokan } from "@/lib/client/store";

export function Dashboard() {
  const connect = useRyokan((s) => s.connect);

  useEffect(() => {
    const disconnect = connect();
    return disconnect;
  }, [connect]);

  return (
    <div style={{ position: "fixed", inset: 0, overflow: "hidden" }}>
      <Scene />
      <Hud />
      <FocusPanel />
      <TaskBoard />
    </div>
  );
}
