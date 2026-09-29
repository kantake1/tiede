# おあいこ

リポジトリ名は tiede。

旅行・飲み会・共同購入など、みんなで立て替えたお金を記録し、誰が誰にいくら送金すれば過不足なく精算できるかを計算するウェブアプリ。

推測困難な共有URL (`/t/{tripId}`) を発行し、URLを知っている参加者全員がログイン不要・リアルタイム (Firestore) で共同編集できます。

## 主な機能

- **4種類の割り方**:
  - **均等**: 選択した対象者で割り勘
  - **比率**: 重み付けで按分 (例: 大人2 : 子ども1)
  - **金額指定**: 各自の負担額を直接入力
  - **品目別**: レシートの品目ごとに対象者を指定。税や割引などの差額は各自の小計比で自動比例配分
  - ※ 1円未満の端数は立替人負担。20人までは部分集合DPによる厳密解、21人以上は貪欲法で送金回数を最小化
- **レシート読み取り**: Firebase AI Logic (`gemini-3.5-flash-lite`) でレシート画像から店名・品目・合計金額を自動抽出 (画像はサーバーへ保存しません)
- **イベントとアーカイブ**: グループ内に「宿泊」「食事」などのイベントを作成 (1支払い=1イベント)。イベントごとの絞り込みや合算精算が可能。精算完了したイベントはアーカイブして合算対象から除外可能 (復元も可)
- **日付**: 支払いごとに支払日 (YYYY-MM-DD) を記録し、一覧を日付順にグルーピング
- **メモ**: 各支払いに詳細な情報や備考を自由記述 (最大1000文字)
- **削除の取り消し**: 誤削除防止の確認ダイアログを挟まず即時削除し、画面下の通知から同一IDのまま即座に復元可能
- **精算結果のテキスト共有**: 送金指示や内訳をLINEやチャットツールへ貼り付けやすいプレーンテキスト形式でコピー・共有
- **オフライン・PWA**: Service Worker (本番) と PWA に対応。Firestore のローカルキャッシュ (IndexedDB) により圏外でも閲覧・入力可能 (書き込みは2.5秒サーバー待機後にバックグラウンド同期、失敗時は通知)
- **同時編集の通知**: 編集中の支払いが他者によって更新・削除された場合にフォーム上でリアルタイムに検知・警告

## 開発コマンド

```sh
npm install      # 依存関係のインストール
npm run dev      # 開発サーバー起動
npm test         # テスト実行 (vitest)
npm run lint     # 静的解析 (oxlint)
npm run build    # 型チェック (tsc) + プロダクションビルド (vite)
npm run preview  # ビルド成果物のプレビュー
```

※ `.env.local` がない場合はブラウザの `localStorage` を利用するローカルモード (共同編集不可) で動作します。

## Firebase のセットアップ

### 1. プロジェクトの作成と Firestore
1. [Firebase コンソール](https://console.firebase.google.com/) で新規プロジェクトを作成します。
2. **Firestore Database** を作成します。
   - ロケーション: `asia-northeast1` (東京)
   - データベース種別: `Standard` (本番モード)

### 2. Firebase AI Logic の有効化
レシート読み取り機能を使用するため、Firebase コンソールまたは Google Cloud コンソールで **AI Logic** (Gemini Developer API) を有効化します。

### 3. App Check (reCAPTCHA v3) の設定
Firebase AI Logic の呼び出し保護に App Check が必須です。
1. Firebase コンソール > **App Check** を開きます。
2. https://www.google.com/recaptcha/admin で **reCAPTCHA v3** の鍵を作成し (ドメインは公開先のみ)、App Check のアプリに reCAPTCHA プロバイダとしてシークレットを登録します。reCAPTCHA Enterprise は課金アカウントが必要なため使いません。
3. **開発環境用デバッグトークン**: App Check のアプリメニュー >「デバッグトークンの管理」を開き、生成したデバッグトークン (UUID) を登録します。

### 4. 環境変数の設定 (`.env.local`)
プロジェクトルートに `.env.local` を作成し、各変数を設定します (`.env.example` 参照)。

```env
# Firebase ウェブアプリ設定
VITE_FIREBASE_API_KEY=<Firebase APIキー>
VITE_FIREBASE_AUTH_DOMAIN=<プロジェクトID>.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=<Firebase プロジェクトID>
VITE_FIREBASE_APP_ID=<Firebase アプリID>

# App Check
VITE_RECAPTCHA_SITE_KEY=<reCAPTCHA v3 サイトキー>
VITE_APPCHECK_DEBUG_TOKEN=<コンソールに登録したデバッグUUID (開発環境のみ)>
```

### 5. セキュリティルールのデプロイ
Firebase CLI を使用して Firestore セキュリティルール (`firestore.rules`) をデプロイします。

```sh
npm install -g firebase-tools
firebase login
firebase use --add              # 対象プロジェクトを選択
firebase deploy --only firestore:rules
```

※ ホスティングを含めてデプロイする場合は `firebase deploy` を実行します。

## データ構造

Firestore 上では旅行ごとに独立したサブコレクション構造を持っています。

```
trips/{tripId}
  ├── members/{memberId}
  ├── categories/{categoryId}
  └── expenses/{expenseId}
```

### `trips/{tripId}`
- `name` (string): グループ・旅行名 (最大100文字)
- `createdAt` (timestamp / number): 作成日時

### `members/{memberId}`
- `name` (string): メンバー表示名 (最大50文字)
- `createdAt` (timestamp / number): 作成日時

### `categories/{categoryId}`
- `name` (string): イベント名 (最大50文字)
- `archived` (boolean, optional): アーカイブ済みフラグ
- `createdAt` (timestamp / number): 作成日時

### `expenses/{expenseId}`
- `title` (string): 支払いの件名 (最大100文字)
- `amount` (integer): 支払総額 (円、正の整数)
- `payerId` (string): 立替えたメンバーのID
- `mode` (string): 割り方 (`'equal'` | `'ratio'` | `'amount'` | `'items'`)
- `shares` (map): メンバーIDごとの負担指定
  - `equal`: 値は `1`
  - `ratio`: 比率の重み (整数)
  - `amount`: 個別負担額 (円)
- `items` (list, optional): 品目リスト (`[{ name: string, price: number, memberIds: string[] }]`)
- `categoryId` (string, optional): 所属するイベントのID
- `memo` (string, optional): メモ (最大1000文字)
- `date` (string, optional): 支払日 (`YYYY-MM-DD` 形式)
- `createdAt` (timestamp / number): 作成日時
