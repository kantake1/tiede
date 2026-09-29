import { ArchiveRestore, ChevronRight, Link2, PanelLeftClose, PanelLeftOpen, Plus, Settings, X } from 'lucide-react'
import { yen } from '../lib/format'
import { Logo } from './Logo'

export type CategoryRow = { key: string; name: string; total: number }

type Props = {
  tripName: string
  rows: CategoryRow[]
  archived: CategoryRow[]
  /** アーカイブを除いた合計 */
  total: number
  /** 選択中のカテゴリ。空なら全部 (アーカイブ除く) */
  filter: string[]
  onFilter: (f: string[]) => void
  onAddCategory: () => void
  onRestore: (key: string) => void
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
  const row = (r: CategoryRow) => (
    <label className={p.filter.includes(r.key) ? 'on' : ''}>
      <input type="checkbox" checked={p.filter.includes(r.key)} onChange={() => toggle(r.key)} />
      <span className="grow">{r.name}</span>
      <span className="muted small">{yen(r.total)}</span>
    </label>
  )

  return (
    <aside className="sidebar" aria-label="サイドバー">
      {/* デスクトップ: 格納ボタンはサイドバー上端の右 (格納時はボタンのみ) */}
      <div className="sb-top">
        <button
          className="ghost icon sb-collapse"
          onClick={p.onToggleCollapse}
          aria-label={p.collapsed ? 'サイドバーを開く' : 'サイドバーを格納'}
          aria-expanded={!p.collapsed}
          title={p.collapsed ? '開く' : '格納'}
        >
          {p.collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>
      </div>
      {/* タブレット・スマホの引き出し用 */}
      <div className="sb-head">
        <a href="/" className="logo sb-label">
          <Logo />
        </a>
        <button className="ghost icon sb-close" onClick={p.onClose} aria-label="閉じる">
          <X size={20} />
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
            <li key={r.key}>{row(r)}</li>
          ))}
        </ul>
        <button className="ghost small with-icon" onClick={p.onAddCategory}>
          <Plus size={16} /> カテゴリを追加
        </button>

        {p.archived.length > 0 && (
          <details className="sb-archive">
            <summary className="sb-section">
              <ChevronRight size={14} className="chevron" /> アーカイブ ({p.archived.length})
            </summary>
            <ul className="sb-cats">
              {p.archived.map((r) => (
                <li key={r.key} className="row">
                  <div className="grow">{row(r)}</div>
                  <button className="ghost icon" onClick={() => p.onRestore(r.key)} aria-label={`${r.name} をアーカイブから戻す`} title="戻す">
                    <ArchiveRestore size={16} />
                  </button>
                </li>
              ))}
            </ul>
          </details>
        )}
      </nav>

      <div className="sb-foot">
        <button className="ghost sb-item" onClick={p.onShare} aria-label="URLを共有" title="URLを共有">
          <Link2 size={18} className="sb-icon" />
          <span className="sb-label">{p.copied ? 'コピーした' : 'URLを共有'}</span>
        </button>
        <button className="ghost sb-item" onClick={p.onSettings} aria-label="メンバー・カテゴリ設定" title="メンバー・カテゴリ設定">
          <Settings size={18} className="sb-icon" />
          <span className="sb-label">メンバー・カテゴリ</span>
        </button>
      </div>
    </aside>
  )
}
