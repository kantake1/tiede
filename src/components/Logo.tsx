/**
 * おあいこのロゴ (ロゴ3: 顔のマーク + 文字)。画面内の見出しはすべてこれを使う
 * マークの高さ = 文字の実高さ (0.92em) × 1.6、文字との間隔 = マーク高 × 0.25
 * アイコンのみ (ロゴ1) はホーム画面用の PNG (public/icon-*.png)、タブは public/favicon.svg
 */
export function Logo() {
  return (
    <span className="brand">
      <img src="/logo-mark.svg?v=5" alt="" />
      おあいこ
    </span>
  )
}
