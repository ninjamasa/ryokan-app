import { NextResponse } from "next/server";
import { placeOrder } from "@/lib/simulation";
import type { OrderItem } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// お客様(客室タブレット)からのドリンク注文を受け付ける。
// 受け付けた瞬間に注文オブジェクトが厨房・配膳係へ流れ始める。
export async function POST(req: Request) {
  let body: { roomId?: string; items?: OrderItem[] } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  if (!body.roomId) {
    return NextResponse.json({ error: "roomId is required" }, { status: 400 });
  }

  try {
    const order = placeOrder(body.roomId, body.items ?? []);
    return NextResponse.json({ order }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "failed" },
      { status: 400 },
    );
  }
}
