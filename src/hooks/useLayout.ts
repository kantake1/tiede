import { useEffect, useState } from 'react'
import { loadFlag, loadJson, saveFlag, saveJson } from '../lib/storage'

const COLLAPSED_KEY = 'tiede:sidebar-collapsed'
const WIDE_QUERY = '(min-width: 1440px)'

// 列幅 (px)。未設定なら CSS の既定値
export type Widths = { sb?: number; form?: number }
const WIDTHS_KEY = 'tiede:layout-widths'

/**
 * グループ画面の列の状態: デスクトップでの格納 (端末に保存) / タブレット・スマホでの引き出し (drawer) /
 * スマホでの入力画面 (sheet) / 列幅 (端末に保存)
 */
export function useLayout() {
  const [collapsedPref, setCollapsed] = useState(() => loadFlag(COLLAPSED_KEY))
  const [drawer, setDrawer] = useState(false)
  const [sheet, setSheet] = useState(false)
  // 十分な幅 (1440px 以上) では格納する必要がないため、常に展開する
  const [wide, setWide] = useState(() => matchMedia(WIDE_QUERY).matches)
  useEffect(() => {
    const mq = matchMedia(WIDE_QUERY)
    const on = () => setWide(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  const [widths, setWidths] = useState(() => loadJson<Widths>(WIDTHS_KEY, {}))
  useEffect(() => saveJson(WIDTHS_KEY, widths), [widths])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setDrawer(false)
      setSheet(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function toggleCollapsed() {
    const next = !collapsedPref
    setCollapsed(next)
    saveFlag(COLLAPSED_KEY, next)
  }

  const collapsed = collapsedPref && !wide
  return {
    /** 格納を選んでいる (幅の広い画面では無視される) */
    collapsedPref,
    collapsed,
    toggleCollapsed,
    drawer,
    setDrawer,
    sheet,
    setSheet,
    /** 列幅を変える。undefined で既定値に戻す */
    setWidth: (key: keyof Widths, px: number | undefined) => setWidths((w) => ({ ...w, [key]: px })),
    className: `layout ${collapsed ? 'collapsed' : ''} ${drawer ? 'drawer-open' : ''} ${sheet ? 'sheet-open' : ''}`,
    style: {
      ...(widths.sb ? { '--sb-w': `${widths.sb}px` } : {}),
      ...(widths.form ? { '--form-w': `${widths.form}px` } : {}),
    } as React.CSSProperties,
  }
}
