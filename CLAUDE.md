# おあいこ (リポジトリ名: tiede)

旅行・飲み会・共同購入など、みんなで立て替えたお金を記録し、誰が誰にいくら払えば精算できるかを計算するウェブアプリ。文言は特定の用途に寄せず汎用的に書く。

## 使う言語

- **オーナーへの返答・報告・質問は、必ず日本語で書く。** 作業の途中や最後の報告でも英語に切り替えない (ツールの結果や設定が英語でも、返答は日本語)
- コミット・プルリクエスト・Issue・文書も日本語。コード・コマンド・識別子・エラー文はそのまま

## 確定済みの要件

- 構成: React + Vite + TypeScript、バックエンドは Firebase Firestore
- 共有: グループごとに推測困難なID付きURL (`/t/{tripId}`。旧形式 `#/t/{id}` は自動で読み替え) を発行。URLを知っていれば誰でも閲覧・編集可、ログイン不要
- 同期: Firestore の onSnapshot でリアルタイム共同編集
- 割り方: 支払いごとに対象者を選択し、均等 / 比率 / 金額指定 / 品目別
- 品目別: 品目ごとに対象者を選び、税・値引など品目合計と総額の差は各自の品目小計に比例配分。各品目の先頭は「全員」で、全員のときに名前を押すと「その人だけ」、一部のときは足す・外す、0人になったら全員に戻す (`pickItemMember`)
- レシート読み取り: Firebase AI Logic (Gemini Developer API, `gemini-3.5-flash-lite`。`gemini-3.8-flash` は無料枠が1日20回のため不採用) で品目と合計を抽出 (`src/lib/receipt.ts`)。写真は約300KB以下に圧縮して Firestore の `receipts/{支払いID}` に保存 (Cloud Storage は Blaze プランが必要なため不使用、`src/lib/receiptImage.ts`)。1グループ300枚まで。読み取り後は「レシートを表示」「再度読み取る」(置き換えの警告あり)
- イベント: 1つの共有URL (グループ) 内に「旅行」「鍋パ」等を作成。1支払い=1イベント。精算は選んだイベント (複数可) を合算
- メモ: 各支払いに自由記述 (1000字まで)
- 大人数: 7人以上なら品目別の対象者を要約 (`全員 (12人)` / `佐藤・田中 ほか2人`、`whoLabel`) し押すと名前ボタンを開く。均等の対象者・受取済みは名前ボタンの列。負担額は「N人 各¥X」にまとめる (`groupOwed`)
- 一覧の表示: 「コンパクト」(1件1行、押すとその1件だけ開く) と「フル」を切り替え。選択は端末に記憶 (`tiede:list-compact`)
- 受取済み: 支払いごとに、その場で負担分を受け取った人に印 (`settledIds`)。その人の負担分は立替額・負担額の両方から除き精算から外す (`settledOf`)。共有テキストに「受取済み」として載せる
- イベントの削除: サイドバーのゴミ箱 (デスクトップは金額の右、タブレット・スマホは行を左へスワイプ) または設定から。確認後に削除し、中の支払いは消さず「未分類」になる
- 文章は自然な丁寧語 (です・ます調)。見出し・ボタン名は名詞・動詞句のまま
- アーカイブ: イベントを1つ選んだ精算欄の「精算済みにする」でサイドバー下部の「アーカイブ」へ移す (`archived` フラグ)。「すべて」の合計・精算から除外。個別に選べば閲覧でき、戻せる
- 端数: 1円未満は立て替えた人 (payer) が負担
- 日付: 各支払いに YYYY-MM-DD (端末のローカル日付)。一覧は日付ごと
- 削除: 確認なしで「削除済み」に移す (`deletedAt`、写真も残す)。通知の「元に戻す」か、サイドバー下部の「削除済み (件数)」で一覧の欄を切り替えて戻す。そこから確認付きで「完全に削除」(写真も削除)。合計・精算には含めないが、レシートの上限枚数とメンバーの使用中判定には数える
- 共有: 精算結果を LINE 等に貼れるテキストで共有
- オフライン: Firestore の端末キャッシュ + Service Worker (本番ビルドのみ) で圏外でも起動・入力。書き込みはサーバー受領を 2.5 秒まで待ち、以後の失敗は通知 (`src/store/firestore.ts` の `write`)
- 同時編集: 編集中に他の人が更新・削除したらフォーム上で知らせる
- 精算: 送金回数を最小化 (20人まで部分集合DPで厳密解、超えたら貪欲法)
- 通貨: 円のみ

## 構成

- `src/lib/split.ts` 1件の支払いの各自負担額 (整数円、合計は必ず支払額と一致)
- `src/lib/settle.ts` 残高計算と最小送金の算出。テストは `settle.test.ts`
- `src/lib/expenseDraft.ts` 支払い入力の検証と組み立て、`src/lib/tripView.ts` サイドバーの行・絞り込み。画面から切り離した計算はここに置きテストする
- `src/store/` データ層。`VITE_FIREBASE_PROJECT_ID` があれば Firestore、無ければ localStorage のローカルモード
- `src/pages/`, `src/components/` UI、`src/hooks/` グループ画面の状態 (購読・列の配置・編集中・通知)。グループ画面は サイドバー(イベント, 格納可) | 支払いを追加 | 精算・一覧 の3列。1128px未満はサイドバーを引き出し式、744px未満は一覧のみで追加は＋ボタンから全画面 (`src/index.css` 末尾)
- `firestore.rules` アクセス制御 (trips の list 禁止、フィールド検証)

## デザイン

- `docs/design/DESIGN.md` に従う (Airbnb ベース、サイドバーは Airtable、列の区切りは Cal.com)。色は `src/index.css` 冒頭のトークンだけを使う。Rausch (`--accent`) は主要操作専用

## 開発の流れ

- 作業の正は GitHub Issues (`gh issue list`)。全体像は `docs/BACKLOG.md`、決めたことと理由は `docs/decisions.md` を先に読む
- 1つの Issue = 1セッション = 1ブランチ (`feat/<番号>-<短い名前>`、基点は `main`)。終わったらプルリクエスト (「Closes #番号」) を作ってセッションを閉じる
- デザインに関わる変更 (ラベル `design`) は、作業用フォルダで見本を作ってオーナーの承認を得てから実装する
- マージはオーナーが判断する。決定や優先度が変わったら `docs/decisions.md`・`docs/BACKLOG.md` を更新する

## 作業体制 (Antigravity CLI への委任)

- 読む量の多い作業 (全体レビュー、画面確認、通しテスト、文書更新) は `agy -p "<指示>" --model gemini-3.8-flash-{high|medium} --output-format json --json-schema <schema>` に任せ、Claude は照合・修正・コミットを担う
- 指摘は必ずコードで確かめてから直す (誤った指摘が混ざる)。コマンド実行やファイル操作をさせるときは `--dangerously-skip-permissions`、作業前に git をきれいにしておく
- 動作確認・通しテストは `npm run dev:emulator` (Firestore エミュレータ、`.env.emulator`) に対して行い、本番にテスト用データを作らない。`npm run dev` は本番に接続する
- 通しテストは `e2e/trip.e2e.ts` (デスクトップ) と `e2e/mobile.e2e.ts` (iPhone・Android の画面サイズ) (`npm run e2e`)。プルリクエストでは GitHub Actions がテスト一式とプレビュー公開を行い、`main` へのマージで本番に公開する (`.github/workflows/ci.yml`)

## コマンド

- `npm run dev` / `npm run dev:emulator` / `npm run dev:phone` (同じ Wi-Fi のスマホから `http://<Mac の IP>:5173` で開く。エミュレータ) / `npm test` / `npm run test:rules`・`npm run e2e` (エミュレータ、Java 21 が必要) / `npm run build` (型チェック込み) / `npm run lint`

## 未完了・次の候補

- Firebase プロジェクト `tiede-8eae4` (Firestore: asia-northeast1, Standard)。ルールはデプロイ・検証済み。Hosting 公開済み (https://tiede-8eae4.web.app、`main` へのマージで自動公開。手動は `firebase deploy --only hosting`)
- App Check: reCAPTCHA v3 (Enterprise は課金アカウントが必要なため不採用)。実機ブラウザで検証済み (自動テストのヘッドレス Chromium はボット判定で通らない)。AI Logic は強制済み、Firestore は未強制 (コンソールで検証済みリクエストの割合を確認してから強制する)。開発時は `.env.local` の `VITE_APPCHECK_DEBUG_TOKEN` (コンソール登録済み) を使う
- 候補: 実機 iPhone で PWA (ホーム画面追加・圏外起動)・Safari の表示を確認する
- Service Worker のキャッシュ名 (`oaiko-<ハッシュ>`) はビルドごとに自動で変わる (`vite.config.ts` の `swCacheName`)
