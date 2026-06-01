# CLAUDE.md — 旅館サイボーグ プロジェクト引き継ぎ

このファイルは Claude Code が起動時に自動で読み込むプロジェクトメモリです。
**続きの作業を担当するエージェント向けの引き継ぎ情報**をここに集約しています。

---

## 1. これは何か

旅館全体を **デジタルツイン化** し、館内をリアルタイムに可視化・運用支援する
Webアプリの **プロトタイプ**。半透明の3D建物の中を、従業員・お客様・注文といった
「情報」が行き交う。

実装済みの体験（すべて動作確認済み）:

- 半透明3Dの館内全体像（2階建て・客室6室＋厨房/食事処/大浴場/フロント）を回転・ズーム
- 従業員の可視化（位置・現在タスク・**この先のタスク計画**、役割で色分け）
- お客様のざっくり状況（食事中/くつろぎ/入浴/就寝/外出）
- **ドリンク注文フロー**: 客室ボタン → 注文が空間を飛んで厨房へ瞬時に流れる → タスクが溜まる
  → 配膳係が客室まで運び、到着でタスク消化（満足度UP）
- クリックでフォーカス（部屋/スタッフ/お客様 → 右パネルに関連情報）
- リアルタイム・タスクボード（厨房/配膳/完了のキュー、手動前進ボタンあり）
- **SSEによるマルチクライアント同期**（複数ブラウザが同じ状態を共有）

## 2. 技術スタック

- Next.js 15 (App Router) — フロント/バックを一体実装
- React 19 / TypeScript
- three.js 0.172 + @react-three/fiber 9 + @react-three/drei 10（WebGL 3D）
- zustand 5（クライアント状態）
- Server-Sent Events（サーバー権威の状態をリアルタイム配信）
- puppeteer（devDependency。**ブラウザ実行時エラーのデバッグ用**。後述）

## 3. アーキテクチャ

```
ブラウザ (3Dシーン + UIオーバーレイ)
   │  ① 注文/操作: POST /api/orders, PATCH /api/orders/:id
   ▼
Next.js API Routes ──► サーバー側シミュレーション (src/lib/simulation.ts)
   ▲                      ・従業員の移動 / タスク計画
   │  ② 状態配信           ・お客様の行動
   └── SSE (/api/stream) ◄─ ・注文のライフサイクル(調理→配膳)
                            tick(400ms)ごとに更新し全クライアントへ broadcast
```

- **`src/lib/simulation.ts`** が「旅館の頭脳」。プロセス内インメモリ・シングルトン
  （`globalThis.__ryokanSim`）で全状態を保持し、`setInterval` で時間を進める。
  ホットリロードでも二重化しないよう globalThis に固定している。
- **座標系は `src/lib/layout.ts` に集約**。3Dの描画とサーバーの移動ロジックが
  同じ部屋/厨房/階段の座標を共有する。**新しい部屋を足すときはここを編集すれば
  サーバーと3D両方に反映される。**

### 注文のライフサイクル（`OrderPhase`）

```
placed(受付) → cooking(調理中) → ready(配膳待ち) → delivering(配膳中) → done(完了)
```

- 調理/配膳スタッフが全員ふさがっていると、その段階で滞留する（= タスクが溜まる）。
- 配膳スタッフが客室へ到着すると自動で done になる。タスクボードのボタンで手動進行も可。
- done から一定時間（`DONE_LINGER_TICKS`）でボードから消える。

## 4. ディレクトリ構成

```
src/
  app/
    layout.tsx, page.tsx(ssr:false でDashboardを動的import), globals.css
    api/
      state/route.ts        # GET   現在のスナップショット
      stream/route.ts       # GET   SSE 配信
      orders/route.ts       # POST  注文作成 (placeOrder)
      orders/[id]/route.ts  # PATCH タスクを次フェーズへ (advanceOrder)
  lib/
    types.ts                # ドメイン型 (Room/Guest/Staff/Order/RyokanState/RyokanEvent)
    layout.ts               # 旅館の空間レイアウト(座標)・主要拠点ID・階段位置
    simulation.ts           # サーバー側シミュレーション本体(シングルトン+tick)
    client/
      store.ts              # zustandストア + SSE接続 + EMPTY定数(後述)
      visuals.ts            # 配色・日本語ラベル(役割/活動/フェーズ)
  components/
    Dashboard.tsx           # 全体の組み立て(useEffectでconnect)
    Scene.tsx               # R3F Canvas / カメラ / ライト / OrbitControls
    Building.tsx            # 半透明シェル・床・クリック可能な部屋(RoomBox)
    Markers.tsx             # 従業員(StaffMarker)・お客様(GuestMarker)。位置をuseFrameで補間
    OrderFlow.tsx           # 空間を流れる注文オブジェクト(OrderToken)
    Hud.tsx                 # 左上ヘッダー / KPI / 凡例
    FocusPanel.tsx          # クリック時の右パネル + ドリンク注文ボタン
    TaskBoard.tsx           # 左下の厨房/配膳/完了タスクボード
```

## 5. 開発コマンド

```bash
npm install
npm run dev      # http://localhost:3000 (使用中なら自動で別ポート)
npm run build    # 型チェック込みの本番ビルド(変更後は必ず通すこと)
npm run start    # 本番起動
```

> **同期デモ**: ブラウザを2つ開き、片方で客室のドリンクを注文すると、
> もう片方のタスクボードと3Dシーンに即反映される。

## 6. コーディング規約・このコードベースの癖

- コメント・UIラベルは **日本語**。既存のトーンに合わせる。
- スタイルは基本 **インラインstyle**（`CSSProperties`）。CSSフレームワークは未使用。
- **【重要な落とし穴】zustandセレクタは安定参照を返すこと。**
  `useRyokan((s) => s.state?.orders ?? [])` のように毎回新しい配列/オブジェクトを
  返すと `useSyncExternalStore` が無限ループ（`Maximum update depth exceeded` /
  `getSnapshot should be cached`）になる。フォールバックには `store.ts` の
  **`EMPTY` 定数**（安定参照の空配列）を使う。新しいセレクタを追加するときも同様に注意。
  → これは過去に実際に踏んで修正済みのバグ（commit d22638b）。
- WebGL/3Dはクライアント専用。`page.tsx` で `dynamic(..., { ssr: false })` 必須。
- ドメインの型変更は `src/lib/types.ts` を起点に。座標は `src/lib/layout.ts`。

## 7. ブラウザ実行時エラーのデバッグ方法（重要）

ビルドやサーバーログに出ない **クライアント(R3F/WebGL/React)のランタイムエラー** は
ブラウザのコンソールにしか出ない。ヘッドレスChromeで捕捉できるスクリプトを同梱している:

```bash
npm run dev                       # 別ターミナルで起動(ポートを確認)
URL=http://localhost:3000/ node scripts/probe.mjs
```

`scripts/probe.mjs` は console.error / pageerror / 4xx / Next.jsエラーオーバーレイの
メッセージを表示し、`scripts/last-screenshot.png` にスクショを保存する。
**画面が見えない環境で「ブラウザのエラーを見て直す」ときの第一手。**

> ローカルで Claude にブラウザを直接操作させたい場合は、**Chrome DevTools MCP** を
> `.mcp.json` で接続済み（"chrome mcp"）。Claude Code 起動時に自動で読み込まれ、
> ページのコンソール・スクショ・DOM を直接取得できる（初回は `npx` が
> `chrome-devtools-mcp` を取得。ローカルの Chrome を使用）。
> `npm run probe`（puppeteer）は MCP を使わない簡易フォールバック。

## 8. プロトタイプの割り切り / 既知の制約

- 状態はサーバープロセスのメモリ保持（**単一プロセス前提**）。永続化・サーバーレス分散は未対応。
  本番化するなら Redis / DB＋pub-sub などへ。
- お客様の行動・初期データはダミー（`simulation.ts` の `initialGuests/initialStaff`）。
  実運用では位置測位・PMS・IoT連携を `simulation.ts` に差し込む想定。
- 認証・権限管理は未実装。
- favicon.ico が無く 404 が出る（無害）。

## 9. 次にやると良いこと（バックログ案）

- 注文以外のタスク種別（清掃依頼・客室呼び出し・チェックイン誘導）
- モバイル向け「客室タブレットUI」を別ルート(`/room/[id]`)として分離
- スタッフ視点の「配膳ディスプレイ / 厨房ディスプレイ」専用ビュー
- 状態の永続化と複数旅館対応
- アラート（満足度低下・タスク滞留・対応遅延）の可視化

## 11. 開発環境の自動準備（設定済み）

- **`.mcp.json`** — Chrome DevTools MCP を接続（ブラウザのコンソール/スクショ/DOMを取得）。
- **`.claude/hooks/session-start.sh` + `.claude/settings.json`** — SessionStart フック。
  セッション開始時に `npm install` を実行し、依存が揃った状態で作業を始められる
  （web/ローカル両対応・冪等）。デフォルトのブランチに取り込むと以降の全セッションで有効。

## 10. Git

- 開発ブランチ: `claude/cool-bell-iJeHH`（origin: `ninjamasa/ryokan-app`）
- 直近: プロトタイプ実装 → 無限ループ修正 → 本引き継ぎドキュメント追加
- PRは未作成（明示の指示があるまで作らない方針）。
