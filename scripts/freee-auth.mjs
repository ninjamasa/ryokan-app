// freee 認証ヘルパー: アクセストークンの取得と自動リフレッシュ（依存なし・Node 18+）
//
// 最初の1回だけブラウザ認可（npm run token）で refresh_token をローカルに保存すれば、
// 以後は refresh_token を使って自動でアクセストークンを更新する（＝ブラウザ不要）。
// 認証情報は .freee.json（gitignore 済み・パーミジョン 600）に保存する。
//
// 優先順位:
//   1) 環境変数 FREEE_ACCESS_TOKEN があればそれを使う（従来どおり）
//   2) .freee.json に有効なアクセストークンがあれば使う
//   3) refresh_token があれば自動リフレッシュして更新（新しい refresh_token に自動で差し替え）

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = process.env.FREEE_CONFIG || join(__dirname, "..", ".freee.json");
const TOKEN_ENDPOINT = "https://accounts.secure.freee.co.jp/public_api/token";

export function configPath() {
  return CONFIG_PATH;
}

export function loadConfig() {
  if (!existsSync(CONFIG_PATH)) return {};
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
  } catch {
    return {};
  }
}

export function saveConfig(cfg) {
  // mode 0o600: 本人のみ読み書き可（認証情報のため）
  writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2) + "\n", { mode: 0o600 });
}

// トークン取得成功時にレスポンスを .freee.json へ保存する（認可コード交換・リフレッシュ共通）
export function persistToken(json, extra = {}) {
  const cfg = loadConfig();
  const nowSec = Math.floor(Date.now() / 1000);
  const updated = {
    ...cfg,
    ...extra,
    access_token: json.access_token,
    // freee の refresh_token は使うたびに新しくなる（ローテーション）ので必ず上書き保存する
    refresh_token: json.refresh_token ?? cfg.refresh_token,
    expires_at: json.expires_in ? nowSec + json.expires_in : undefined,
    scope: json.scope ?? cfg.scope,
  };
  saveConfig(updated);
  return updated;
}

async function refresh(cfg) {
  const clientId = process.env.FREEE_CLIENT_ID || cfg.client_id;
  const clientSecret = process.env.FREEE_CLIENT_SECRET || cfg.client_secret;
  const refreshToken = cfg.refresh_token;
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "自動リフレッシュに必要な情報が足りません（client_id / client_secret / refresh_token）。\n" +
      "最初に一度だけ `npm run token`（ブラウザ認可）を実行してください。",
    );
  }
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }),
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!res.ok) {
    throw new Error(
      `アクセストークンの自動リフレッシュに失敗 (HTTP ${res.status})\n${JSON.stringify(json, null, 2)}\n` +
      "refresh_token が失効している可能性があります。`npm run token` で取り直してください。",
    );
  }
  const updated = persistToken(json, { client_id: clientId, client_secret: clientSecret });
  return updated.access_token;
}

// アクセストークンを解決する（必要なら自動リフレッシュ）。
export async function getAccessToken() {
  if (process.env.FREEE_ACCESS_TOKEN) return process.env.FREEE_ACCESS_TOKEN;
  const cfg = loadConfig();
  const nowSec = Math.floor(Date.now() / 1000);
  // 期限に60秒以上の余裕があるキャッシュ済みトークンはそのまま使う
  if (cfg.access_token && cfg.expires_at && cfg.expires_at - 60 > nowSec) {
    return cfg.access_token;
  }
  if (cfg.refresh_token) {
    return await refresh(cfg);
  }
  throw new Error(
    "アクセストークンがありません。最初に一度だけ `npm run token`（ブラウザ認可）を実行してください。\n" +
    "以後は保存された refresh_token で自動更新するのでブラウザ操作は不要になります。",
  );
}
