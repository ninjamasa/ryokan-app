// freee会計API で請求書を発行するスクリプト（依存なし・Node 18+ の fetch を使用）
//
// 何をするか:
//   「先月末締め・今月末期日・システム開発業務・200,000円(税込)」の請求書を
//   freee会計の請求書として作成する。日付は実行日を基準に自動算出する。
//   事業所ID / 取引先 / 勘定科目(売上高) / 税区分コード(課税売上10%) は
//   トークンさえ渡せば freee 側から自動で解決する（環境変数で上書きも可能）。
//
// 使い方:
//   export FREEE_ACCESS_TOKEN=xxxxxxxx            # 必須: freeeのアクセストークン
//   export FREEE_COMPANY_ID=123456               # 任意: 事業所が1つなら自動判定
//   node scripts/freee-invoice.mjs               # または: npm run invoice
//
//   まず内容だけ確認したい場合（APIを叩かない）:
//   DRY_RUN=1 node scripts/freee-invoice.mjs
//
// 主な環境変数（上書き用・すべて任意）:
//   FREEE_PARTNER_NAME   取引先名（既定: 合同会社セイチ / 無ければ自動作成）
//   FREEE_PARTNER_ID     取引先IDを直接指定（検索・作成をスキップ）
//   FREEE_ITEM           品目名（既定: システム開発業務）
//   FREEE_AMOUNT         税込金額（既定: 200000）
//   FREEE_TAX_RATE       税率%（既定: 10）
//   FREEE_ISSUE_DATE     請求日 YYYY-MM-DD（既定: 先月末）
//   FREEE_DUE_DATE       支払期日 YYYY-MM-DD（既定: 今月末）
//   FREEE_INVOICE_STATUS draft|unsubmitted|submitted（既定: draft=下書き）
//   FREEE_ACCOUNT_ITEM_ID / FREEE_TAX_CODE  自動解決に失敗する場合の手動指定
//
// アクセストークンの取り方:
//   freee アプリストア/開発者向けページでアプリを作成し OAuth2 でトークンを取得する。
//   検証用途なら「アプリ管理 > 対象事業所 > テスト用アクセストークン」でも可。

const BASE = "https://api.freee.co.jp";
const TOKEN = process.env.FREEE_ACCESS_TOKEN;
const DRY_RUN = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";

if (!TOKEN) {
  console.error("✗ FREEE_ACCESS_TOKEN が未設定です。freeeのアクセストークンを環境変数で渡してください。");
  process.exit(1);
}

// --- freee API 呼び出しヘルパー ---------------------------------------------
async function freee(path, { method = "GET", body, query } = {}) {
  const url = new URL(BASE + path);
  if (query) for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
  if (!res.ok) {
    const detail = JSON.stringify(json, null, 2);
    throw new Error(`freee API ${method} ${path} が失敗 (HTTP ${res.status})\n${detail}`);
  }
  return json;
}

// --- 日付ユーティリティ（実行日基準で 先月末 / 今月末 を算出）------------------
function fmt(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
const now = new Date();
const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);      // 先月末
const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);  // 今月末

const issueDate = process.env.FREEE_ISSUE_DATE || fmt(lastMonthEnd);
const dueDate = process.env.FREEE_DUE_DATE || fmt(thisMonthEnd);
const partnerName = process.env.FREEE_PARTNER_NAME || "合同会社セイチ";
const itemName = process.env.FREEE_ITEM || "システム開発業務";
const amount = Number(process.env.FREEE_AMOUNT || 200000);   // 税込金額
const taxRate = Number(process.env.FREEE_TAX_RATE || 10);
const invoiceStatus = process.env.FREEE_INVOICE_STATUS || "draft";

// --- 事業所IDの解決 ---------------------------------------------------------
async function resolveCompanyId() {
  if (process.env.FREEE_COMPANY_ID) return Number(process.env.FREEE_COMPANY_ID);
  const { companies = [] } = await freee("/api/1/companies");
  if (companies.length === 0) throw new Error("この事業所にアクセスできるトークンではありません。");
  if (companies.length > 1) {
    const list = companies.map((c) => `  - ${c.id}: ${c.display_name || c.name}`).join("\n");
    throw new Error(`事業所が複数あります。FREEE_COMPANY_ID を指定してください:\n${list}`);
  }
  return companies[0].id;
}

// --- 取引先の解決（IDあり→そのまま / 名前で検索→無ければ作成）------------------
async function resolvePartner(companyId) {
  if (process.env.FREEE_PARTNER_ID) {
    return { id: Number(process.env.FREEE_PARTNER_ID), name: partnerName };
  }
  const { partners = [] } = await freee("/api/1/partners", {
    query: { company_id: companyId, keyword: partnerName, limit: 100 },
  });
  const hit = partners.find((p) => p.name === partnerName) || partners[0];
  if (hit) return { id: hit.id, name: hit.name };

  console.log(`  取引先「${partnerName}」が見つからないため新規作成します`);
  if (DRY_RUN) return { id: 0, name: partnerName };
  const { partner } = await freee("/api/1/partners", {
    method: "POST",
    body: { company_id: companyId, name: partnerName },
  });
  return { id: partner.id, name: partner.name };
}

// --- 勘定科目（売上高）の解決 -----------------------------------------------
async function resolveAccountItemId(companyId) {
  if (process.env.FREEE_ACCOUNT_ITEM_ID) return Number(process.env.FREEE_ACCOUNT_ITEM_ID);
  const { account_items = [] } = await freee("/api/1/account_items", {
    query: { company_id: companyId },
  });
  const sales =
    account_items.find((a) => a.name === "売上高") ||
    account_items.find((a) => typeof a.name === "string" && a.name.includes("売上"));
  if (!sales) {
    throw new Error("売上高の勘定科目が見つかりません。FREEE_ACCOUNT_ITEM_ID で指定してください。");
  }
  return sales.id;
}

// --- 税区分コード（課税売上・指定税率）の解決 --------------------------------
async function resolveTaxCode(companyId) {
  if (process.env.FREEE_TAX_CODE) return Number(process.env.FREEE_TAX_CODE);
  const { taxes = [] } = await freee("/api/1/taxes/codes", { query: { company_id: companyId } });
  const rateStr = String(taxRate);
  const nameOf = (t) => t.name_ja || t.name || "";
  const wantReduced = taxRate === 8; // 8%は軽減税率、それ以外は標準税率
  // 課税売上・税率一致で、軽減税率の有無が意図と合う税区分に絞り込む。
  const candidates = taxes.filter((t) => {
    const n = nameOf(t);
    if (!n.includes("課税売上") || !n.includes(rateStr)) return false;
    return n.includes("軽減") === wantReduced;
  });
  // 「課税売上10%」のような素直な名称を最優先し、無ければ絞り込み候補の先頭。
  const pick =
    candidates.find((t) => nameOf(t) === `課税売上${rateStr}%`) ||
    candidates[0];
  if (!pick) {
    const sample = taxes.slice(0, 20).map((t) => `  - ${t.code}: ${nameOf(t)}`).join("\n");
    throw new Error(
      `税率${rateStr}%の課税売上の税区分コードが特定できません。FREEE_TAX_CODE で指定してください。\n候補一覧(一部):\n${sample}`,
    );
  }
  return pick.code;
}

// --- メイン -----------------------------------------------------------------
const companyId = await resolveCompanyId();
const partner = await resolvePartner(companyId);
const accountItemId = await resolveAccountItemId(companyId);
const taxCode = await resolveTaxCode(companyId);

const taxIncluded = amount;
const taxExcluded = Math.round(amount / (1 + taxRate / 100));
const vat = taxIncluded - taxExcluded;

const payload = {
  company_id: companyId,
  partner_id: partner.id,
  partner_display_name: partner.name,
  partner_title: "御中",
  issue_date: issueDate,
  due_date: dueDate,
  booking_date: issueDate,
  title: "請求書",
  invoice_status: invoiceStatus,
  tax_entry_method: process.env.FREEE_TAX_ENTRY_METHOD || "inclusive", // 内税（税込入力）
  invoice_contents: [
    {
      order: 1,
      type: "normal",
      description: itemName,
      qty: 1,
      unit: "式",
      unit_price: taxIncluded, // tax_entry_method=inclusive なので税込金額
      account_item_id: accountItemId,
      tax_code: taxCode,
    },
  ],
};

console.log("── 請求書の内容 ─────────────────────────────");
console.log(`  事業所ID    : ${companyId}`);
console.log(`  取引先      : ${partner.name} (id=${partner.id})`);
console.log(`  品目        : ${itemName}`);
console.log(`  金額(税込)  : ¥${taxIncluded.toLocaleString()}（本体 ¥${taxExcluded.toLocaleString()} + 消費税 ¥${vat.toLocaleString()} / ${taxRate}%）`);
console.log(`  請求日      : ${issueDate}（先月末締め）`);
console.log(`  支払期日    : ${dueDate}（今月末）`);
console.log(`  勘定科目ID  : ${accountItemId}   税区分コード: ${taxCode}`);
console.log(`  ステータス  : ${invoiceStatus}`);
console.log("─────────────────────────────────────────────");

if (DRY_RUN) {
  console.log("\n[DRY_RUN] 実際のAPI呼び出しは行いませんでした。送信予定のペイロード:");
  console.log(JSON.stringify(payload, null, 2));
  process.exit(0);
}

const { invoice } = await freee("/api/1/invoices", { method: "POST", body: payload });
console.log("\n✓ 請求書を作成しました");
console.log(`  請求書ID    : ${invoice.id}`);
console.log(`  請求書番号  : ${invoice.invoice_number ?? "(自動採番)"}`);
console.log(`  合計金額    : ¥${Number(invoice.total_amount ?? taxIncluded).toLocaleString()}`);
console.log(`  freeeで開く : https://secure.freee.co.jp/reports/invoices/${invoice.id}`);
