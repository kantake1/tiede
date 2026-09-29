# おあいこ (リポジトリ名: tiede)

旅行・飲み会・共同購入など、みんなで立て替えたお金を記録し、誰が誰にいくら払えば精算できるかを計算するウェブアプリ。文言は特定の用途に寄せず汎用的に書く。

## 確定済みの要件

- 構成: React + Vite + TypeScript、バックエンドは Firebase Firestore
- 共有: グループごとに推測困難なID付きURL (`/t/{tripId}`。旧形式 `#/t/{id}` は自動で読み替え) を発行。URLを知っていれば誰でも閲覧・編集可、ログイン不要
- 同期: Firestore の onSnapshot でリアルタイム共同編集
- 割り方: 支払いごとに対象者を選択し、均等 / 比率 / 金額指定 / 品目別
- 品目別: 品目ごとに対象者を選び、税・値引など品目合計と総額の差は各自の品目小計に比例配分
- レシート読み取り: Firebase AI Logic (Gemini Developer API, `gemini-3.5-flash-lite`。`gemini-3.8-flash` は無料枠が1日20回のため不採用) で品目と合計を抽出。画像は保存しない (`src/lib/receipt.ts`)
- イベント: 1つの共有URL (グループ) 内に「旅行」「鍋パ」等を作成。1支払い=1イベント。精算は選んだイベント (複数可) を合算
- メモ: 各支払いに自由記述 (1000字まで)
- イベントの削除: サイドバーのゴミ箱 (デスクトップは金額の右、タブレット・スマホは行を左へスワイプ) または設定から。確認後に削除し、中の支払いは消さず「未分類」になる
- 文章は自然な丁寧語 (です・ます調)。見出し・ボタン名は名詞・動詞句のまま
- アーカイブ: イベントを1つ選んだ精算欄の「精算済みにする」でサイドバー下部の「アーカイブ」へ移す (`archived` フラグ)。「すべて」の合計・精算から除外。個別に選べば閲覧でき、戻せる
- 端数: 1円未満は立て替えた人 (payer) が負担
- 日付: 各支払いに YYYY-MM-DD (端末のローカル日付)。一覧は日付ごと
- 削除: 確認なしで削除し、通知の「元に戻す」で同じ ID のまま復元
- 共有: 精算結果を LINE 等に貼れるテキストで共有
- オフライン: Firestore の端末キャッシュ + Service Worker (本番ビルドのみ) で圏外でも起動・入力。書き込みはサーバー受領を 2.5 秒まで待ち、以後の失敗は通知 (`src/store/firestore.ts` の `write`)
- 同時編集: 編集中に他の人が更新・削除したらフォーム上で知らせる
- 精算: 送金回数を最小化 (20人まで部分集合DPで厳密解、超えたら貪欲法)
- 通貨: 円のみ

## 構成

- `src/lib/split.ts` 1件の支払いの各自負担額 (整数円、合計は必ず支払額と一致)
- `src/lib/settle.ts` 残高計算と最小送金の算出。テストは `settle.test.ts`
- `src/store/` データ層。`VITE_FIREBASE_PROJECT_ID` があれば Firestore、無ければ localStorage のローカルモード
- `src/pages/`, `src/components/` UI。グループ画面は サイドバー(イベント, 格納可) | 支払いを追加 | 精算・一覧 の3列。1128px未満はサイドバーを引き出し式、744px未満は一覧のみで追加は＋ボタンから全画面 (`src/index.css` 末尾)
- `firestore.rules` アクセス制御 (trips の list 禁止、フィールド検証)

## デザイン

- `docs/design/DESIGN.md` に従う (Airbnb ベース、サイドバーは Airtable、列の区切りは Cal.com)。色は `src/index.css` 冒頭のトークンだけを使う。Rausch (`--accent`) は主要操作専用

## 作業体制 (Antigravity CLI への委任)

- 読む量の多い作業 (全体レビュー、画面確認、通しテスト、文書更新) は `agy -p "<指示>" --model gemini-3.8-flash-{high|medium} --output-format json --json-schema <schema>` に任せ、Claude は照合・修正・コミットを担う
- 指摘は必ずコードで確かめてから直す (誤った指摘が混ざる)。コマンド実行やファイル操作をさせるときは `--dangerously-skip-permissions`、作業前に git をきれいにしておく
- 通しテストは `.qa/scenario.mjs` (3人・2日間の旅行の10手順、git 管理外)。Playwright は作業用フォルダに入れたものを参照している

## コマンド

- `npm run dev` / `npm test` / `npm run build` (型チェック込み) / `npm run lint`

## 未完了・次の候補

- Firebase プロジェクト `tiede-8eae4` (Firestore: asia-northeast1, Standard)。ルールはデプロイ・検証済み。Hosting 公開済み (https://tiede-8eae4.web.app、`firebase deploy --only hosting`)
- App Check: reCAPTCHA v3 (Enterprise は課金アカウントが必要なため不採用)。実機ブラウザで検証済み (自動テストのヘッドレス Chromium はボット判定で通らない)。AI Logic は強制済み、Firestore は未強制 (コンソールで検証済みリクエストの割合を確認してから強制する)。開発時は `.env.local` の `VITE_APPCHECK_DEBUG_TOKEN` (コンソール登録済み) を使う
- 候補: 実機 iPhone で PWA (ホーム画面追加・圏外起動)・Safari の表示を確認する
- Service Worker のキャッシュ名は固定 (`oaiko-v6`)。古いビルドのファイルが溜まるため、大きな変更時は名前を上げる
