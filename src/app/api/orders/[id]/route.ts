import { NextResponse } from "next/server";
import { advanceOrder } from "@/lib/simulation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// スタッフ操作: 注文を次のフェーズへ手動で進める
//  placed → cooking → ready → delivering → done
// 配膳完了でタスクが消化される。
export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const order = advanceOrder(id);
  if (!order) {
    return NextResponse.json({ error: "order not found" }, { status: 404 });
  }
  return NextResponse.json({ order });
}
