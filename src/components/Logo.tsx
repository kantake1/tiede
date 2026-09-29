/**
 * おあいこのロゴ
 * - wordmark (ロゴ2): 文字のみ。メインページ (グループ画面) の見出し
 * - lockup (ロゴ3): 顔のマーク + 文字。グループ作成画面
 *   マークの高さ = 文字の実高さ (0.92em) × 1.6、文字との間隔 = マーク高 × 0.25
 * アイコンのみ (ロゴ1) はホーム画面用の PNG (public/icon-*.png)
 */
export function Logo({ variant = 'wordmark' }: { variant?: 'wordmark' | 'lockup' }) {
  return (
    <span className={`brand ${variant}`}>
      {variant === 'lockup' && <img src="/logo-mark.svg?v=5" alt="" />}
      おあいこ
    </span>
  )
}
