import { subscribe } from "@/lib/simulation";
import type { RyokanEvent } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Server-Sent Events で旅館の状態と注文イベントを全クライアントへ配信する。
// これにより「客室タブレット」「厨房ディスプレイ」「配膳ディスプレイ」が
// 同じ状態をリアルタイムに共有できる。
export async function GET(req: Request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (e: RyokanEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
        } catch {
          /* 既に閉じている */
        }
      };

      const unsubscribe = subscribe(send);

      // 接続維持用のキープアライブ(コメント行)
      const keepAlive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: keepalive\n\n`));
        } catch {
          /* noop */
        }
      }, 15000);

      const close = () => {
        clearInterval(keepAlive);
        unsubscribe();
        try {
          controller.close();
        } catch {
          /* noop */
        }
      };

      req.signal.addEventListener("abort", close);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
