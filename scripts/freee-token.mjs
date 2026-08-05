// freee OAuth2: 認可コード → アクセストークン 交換スクリプト（依存なし・Node 18+）
//
// freeeのトークン取得は2段階:
//   ① ブラウザで認可 → 「認可コード(authorization code)」が表示される（使い捨て・約10分で失効）
//   ② 認可コードを client_id / client_secret と一緒にトークンエンドポイントへ送って
//      「アクセストークン(access_token)」に交換する ← このスクリプトがやること
//
// 使い方:
//   export FREEE_CLIENT_ID=アプリのClient ID
//   export FREEE_CLIENT_SECRET=アプリのClient Secret
//   export FREEE_AUTH_CODE=ブラウザに表示された認可コード
//   # リダイレクトURIが「コードを表示」以外なら FREEE_REDIRECT_URI で上書き
//   node scripts/freee-token.mjs
//
// 出力された access_token をそのまま請求書作成へ:
//   export FREEE_ACCESS_TOKEN=（出力されたaccess_token）
//   npm run invoice
//
// client_id / client_secret は freee 開発者サイトのアプリ管理画面
// （アプリ詳細 > 基本情報）で確認できます。

const TOKEN_ENDPOINT = "https://accounts.secure.freee.co.jp/public_api/token";
// 「コードを表示」タイプのアプリ（画面に認可コードが出るもの）はこの固定値。
const OOB_REDIRECT = "urn:ietf:wg:oauth:2.0:oob";

const clientId = process.env.FREEE_CLIENT_ID;
const clientSecret = process.env.FREEE_CLIENT_SECRET;
const code = process.env.FREEE_AUTH_CODE;
const redirectUri = process.env.FREEE_REDIRECT_URI || OOB_REDIRECT;

const missing = [];
if (!clientId) missing.push("FREEE_CLIENT_ID");
if (!clientSecret) missing.push("FREEE_CLIENT_SECRET");
if (!code) missing.push("FREEE_AUTH_CODE");
if (missing.length) {
  console.error(`✗ 次の環境変数が未設定です: ${missing.join(", ")}`);
  console.error("  FREEE_CLIENT_ID / FREEE_CLIENT_SECRET は freee 開発者サイトのアプリ管理画面で確認できます。");
  console.error("  FREEE_AUTH_CODE はブラウザの認可後に表示された認可コードです（使い捨て・約10分で失効）。");
  process.exit(1);
}

const body = new URLSearchParams({
  grant_type: "authorization_code",
  client_id: clientId,
  client_secret: clientSecret,
  code,
  redirect_uri: redirectUri,
});

const res = await fetch(TOKEN_ENDPOINT, {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
  body,
});
const text = await res.text();
let json;
try { json = JSON.parse(text); } catch { json = { raw: text }; }

if (!res.ok) {
  console.error(`✗ トークン交換に失敗 (HTTP ${res.status})`);
  console.error(JSON.stringify(json, null, 2));
  if (json.error === "invalid_grant") {
    console.error("\nヒント: 認可コードは使い捨て・約10分で失効します。ブラウザで認可し直して新しいコードで再実行してください。");
    console.error("       redirect_uri がアプリ登録値と一致していないときも invalid_grant になります（FREEE_REDIRECT_URI を確認）。");
  }
  process.exit(1);
}

const expiresInMin = json.expires_in ? Math.round(json.expires_in / 60) : "?";
console.log("✓ アクセストークンを取得しました");
console.log("─────────────────────────────────────────────");
console.log(`  access_token  : ${json.access_token}`);
console.log(`  refresh_token : ${json.refresh_token ?? "(なし)"}`);
console.log(`  有効期限      : 約${expiresInMin}分（発行から）`);
if (json.scope) console.log(`  scope         : ${json.scope}`);
console.log("─────────────────────────────────────────────");
console.log("\n次のコマンドで請求書を作成できます（有効期限内に実行してください）:");
console.log(`  export FREEE_ACCESS_TOKEN=${json.access_token}`);
console.log("  DRY_RUN=1 npm run invoice   # 内容確認");
console.log("  npm run invoice             # 下書き作成");
