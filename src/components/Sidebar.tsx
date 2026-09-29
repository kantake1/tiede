import { yen } from '../lib/format'

export type CategoryRow = { key: string; name: string; total: number }

type Props = {
  tripName: string
  rows: CategoryRow[]
  total: number
  /** 選択中のカテゴリ。空なら全部 */
  filter: string[]
  onFilter: (f: string[]) => void
  onAddCategory: () => void
  onRename: () => void
  onSettings: () => void
  onShare: () => void
  copied: boolean
  collapsed: boolean
  onToggleCollapse: () => void
  onClose: () => void
}

export function Sidebar(p: Props) {
  const toggle = (key: string) => p.onFilter(p.filter.includes(key) ? p.filter.filter((k) => k !== key) : [...p.filter, key])

  return (
    <aside className="sidebar" aria-label="サイドバー">
      <div className="sb-head">
        <a href="#/" className="logo sb-label">
          旅費精算
        </a>
        <button className="ghost icon sb-close" onClick={p.onClose} aria-label="閉じる">
          ×
        </button>
      </div>
      <h1 className="sb-label sb-title" onClick={p.onRename} title="クリックして名前を変更">
        {p.tripName}
      </h1>

      <nav className="sb-label" aria-label="精算するカテゴリ">
        <div className="sb-section">カテゴリ</div>
        <ul className="sb-cats">
          <li>
            <label className={p.filter.length === 0 ? 'on' : ''}>
              <input type="checkbox" checked={p.filter.length === 0} onChange={() => p.onFilter([])} />
              <span className="grow">すべて</span>
              <span className="muted small">{yen(p.total)}</span>
            </label>
          </li>
          {p.rows.map((r) => (
            <li key={r.key}>
              <label className={p.filter.includes(r.key) ? 'on' : ''}>
                <input type="checkbox" checked={p.filter.includes(r.key)} onChange={() => toggle(r.key)} />
                <span className="grow">{r.name}</span>
                <span className="muted small">{yen(r.total)}</span>
              </label>
            </li>
          ))}
        </ul>
        <button className="ghost small" onClick={p.onAddCategory}>
          ＋ カテゴリを追加
        </button>
      </nav>

      <div className="sb-foot">
        <button className="ghost sb-item" onClick={p.onSettings} aria-label="メンバー・カテゴリ設定" title="メンバー・カテゴリ設定">
          <span className="sb-icon">⚙</span>
          <span className="sb-label">メンバー・カテゴリ</span>
        </button>
        <button className="ghost sb-item" onClick={p.onShare} aria-label="URLを共有" title="URLを共有">
          <span className="sb-icon">🔗</span>
          <span className="sb-label">{p.copied ? 'コピーした' : 'URLを共有'}</span>
        </button>
        <button
          className="ghost sb-item sb-collapse"
          onClick={p.onToggleCollapse}
          aria-label={p.collapsed ? 'サイドバーを開く' : 'サイドバーを格納'}
          aria-expanded={!p.collapsed}
          title={p.collapsed ? '開く' : '格納'}
        >
          <span className="sb-icon">{p.collapsed ? '»' : '«'}</span>
          <span className="sb-label">格納</span>
        </button>
      </div>
    </aside>
  )
}
