import { yen } from './format'
import type { Transfer } from './settle'

/** LINE などに貼る精算結果のテキスト */
export function settlementText(opts: {
  groupName: string
  label: string
  transfers: Transfer[]
  total: number
  nameOf: (id: string) => string
  url?: string
}): string {
  const lines = [`【${opts.groupName}】${opts.label === 'すべて' ? '' : `${opts.label} の`}精算`]
  if (opts.transfers.length === 0) lines.push('精算不要 (全員の負担が釣り合っている)')
  for (const t of opts.transfers) lines.push(`${opts.nameOf(t.from)} → ${opts.nameOf(t.to)}  ${yen(t.amount)}`)
  lines.push(`総額 ${yen(opts.total)}`)
  if (opts.url) lines.push('', `詳細: ${opts.url}`)
  return lines.join('\n')
}
