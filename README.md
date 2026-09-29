# tiede

旅行中に各自が立て替えた支払いを登録し、誰が誰にいくら送金すれば精算が終わるかを計算するウェブアプリ。

## 機能

- 旅行ごとに共有URLを発行。URLを知っている人は誰でも閲覧・編集できる (ログイン不要)
- Firestore によるリアルタイム共同編集
- 支払いごとの割り方
  - 均等: 選択した対象者で均等割り
  - 比率: 対象者ごとの比率で按分 (例: 大人2 : 子ども1)
  - 金額指定: 各自の負担額を直接入力
- 1円未満の端数は立て替えた人が負担
- 送金回数が最小になる精算方法を算出 (20人まで厳密解、それ以上は貪欲法)

## 開発

```sh
npm install
npm run dev      # 開発サーバー
npm test         # 精算ロジックのテスト
npm run build    # 型チェック + ビルド
```

`.env.local` が無い場合はローカルモード (localStorage 保存・共有不可) で動作する。

## Firebase のセットアップ

1. [Firebase コンソール](https://console.firebase.google.com/) でプロジェクトを作成
2. Firestore Database を作成 (本番モード)
3. プロジェクトの設定 > マイアプリ でウェブアプリを追加し、表示された値を `.env.local` に設定 (`.env.example` 参照)
4. デプロイ

```sh
npm install -g firebase-tools
firebase login
firebase use --add            # 作成したプロジェクトを選択
firebase deploy               # Firestore ルールと Hosting をデプロイ
```

## データ構造

```
trips/{tripId}                     name, createdAt
trips/{tripId}/members/{memberId}  name, createdAt
trips/{tripId}/expenses/{id}       title, amount, payerId, mode, shares, createdAt
```

`shares` はメンバーIDをキーとし、`mode` が equal なら 1、ratio なら重み、amount なら負担額(円)を持つ。
