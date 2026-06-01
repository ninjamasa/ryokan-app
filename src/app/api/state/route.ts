import { NextResponse } from "next/server";
import { getSnapshot } from "@/lib/simulation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// 現在の旅館全体スナップショットを返す
export async function GET() {
  return NextResponse.json(getSnapshot());
}
