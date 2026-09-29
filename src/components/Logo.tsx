/** おあいこのロゴ (2つの輪 = お互いさま・貸し借りなし) と名前 */
export function Logo() {
  return (
    <span className="brand">
      <svg viewBox="0 0 64 64" width="22" height="22" aria-hidden="true">
        <rect width="64" height="64" rx="14" fill="var(--accent)" />
        <g fill="none" stroke="#fff" strokeWidth="5">
          <circle cx="25" cy="32" r="12" />
          <circle cx="39" cy="32" r="12" />
        </g>
      </svg>
      おあいこ
    </span>
  )
}
