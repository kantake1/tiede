# 旅費精算 (tiede)

旅行中に各自が立て替えた支払いから、誰が誰にいくら送金すれば精算できるかを計算するウェブアプリ。

## 確定済みの要件

- 構成: React + Vite + TypeScript、バックエンドは Firebase Firestore
- 共有: 旅行ごとに推測困難なID付きURL (`#/t/{tripId}`) を発行。URLを知っていれば誰でも閲覧・編集可、ログイン不要
- 同期: Firestore の onSnapshot でリアルタイム共同編集
- 割り方: 支払いごとに対象者を選択し、均等 / 比率 / 金額指定
- 端数: 1円未満は立て替えた人 (payer) が負担
- 精算: 送金回数を最小化 (20人まで部分集合DPで厳密解、超えたら貪欲法)
- 通貨: 円のみ

## 構成

- `src/lib/split.ts` 1件の支払いの各自負担額 (整数円、合計は必ず支払額と一致)
- `src/lib/settle.ts` 残高計算と最小送金の算出。テストは `settle.test.ts`
- `src/store/` データ層。`VITE_FIREBASE_PROJECT_ID` があれば Firestore、無ければ localStorage のローカルモード
- `src/pages/`, `src/components/` UI
- `firestore.rules` アクセス制御 (trips の list 禁止、フィールド検証)

## コマンド

- `npm run dev` / `npm test` / `npm run build` (型チェック込み) / `npm run lint`

## 未完了・次の候補

- Firebase プロジェクト未作成。`.env.local` 未設定のため実 Firestore と `firestore.rules` は未検証
- 候補: 支払いの日付・カテゴリ、送金済みチェック、公開先の決定 (Firebase Hosting 想定で `firebase.json` 用意済み)
