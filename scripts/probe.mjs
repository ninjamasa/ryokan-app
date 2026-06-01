// ブラウザ実行時エラーを捕捉するデバッグスクリプト（ヘッドレスChrome / puppeteer）
//
// 使い方:
//   npm run dev                                   # 別ターミナルで起動
//   URL=http://localhost:3000/ node scripts/probe.mjs
//
// console.error / pageerror / 4xx応答 / Next.jsエラーオーバーレイのメッセージを表示し、
// scripts/last-screenshot.png にスクリーンショットを保存する。
// 画面が見えない環境で「ブラウザのエラーを見て直す」ときの第一手。

import puppeteer from "puppeteer";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const URL = process.env.URL || "http://localhost:3000/";
const WAIT_MS = Number(process.env.WAIT_MS || 4000);

const logs = [];
const fails = [];

const browser = await puppeteer.launch({
  headless: "new",
  args: [
    "--no-sandbox",
    "--use-gl=swiftshader", // GPUなし環境でWebGLをソフトウェア描画
    "--enable-unsafe-swiftshader",
    "--disable-dev-shm-usage",
  ],
});

const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });
page.on("console", (m) => {
  const t = m.type();
  if (t === "error" || t === "warning") logs.push(`[console.${t}] ${m.text()}`);
});
page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}`));
page.on("response", (r) => {
  if (r.status() >= 400) fails.push(`${r.status()} ${r.url()}`);
});

try {
  await page.goto(URL, { waitUntil: "networkidle2", timeout: 30000 });
} catch (e) {
  logs.push(`[goto-error] ${e.message}`);
}
await new Promise((r) => setTimeout(r, WAIT_MS));

// Next.js dev のエラーオーバーレイ（shadow DOM内）からメッセージを抽出
const overlay = await page.evaluate(() => {
  const portal = document.querySelector("nextjs-portal");
  if (!portal || !portal.shadowRoot) return null;
  const root = portal.shadowRoot;
  const sels = [
    "[data-nextjs-dialog-header]",
    "#nextjs__container_errors_desc",
    "[data-nextjs-codeframe]",
  ];
  const out = [];
  for (const s of sels)
    for (const el of root.querySelectorAll(s)) {
      const t = el.innerText?.trim();
      if (t && !out.includes(t)) out.push(t);
    }
  return out.join("\n---\n");
});

const shot = join(__dirname, "last-screenshot.png");
await page.screenshot({ path: shot });

console.log(`URL: ${URL}`);
console.log("\n===== CONSOLE / PAGE ERRORS =====");
console.log(logs.join("\n") || "(none)");
console.log("\n===== 4xx/5xx RESPONSES =====");
console.log(fails.join("\n") || "(none)");
console.log("\n===== NEXT ERROR OVERLAY =====");
console.log(overlay || "(no overlay)");
console.log(`\nスクリーンショット: ${shot}`);

await browser.close();
