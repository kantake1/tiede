export const yen = (n: number) => `${n < 0 ? '-' : ''}¥${Math.abs(n).toLocaleString('ja-JP')}`

/** 全角数字・カンマ・¥記号を許容して数値に変換する。不正なら NaN。 */
export function parseNumber(s: string): number {
  const t = s
    .replace(/[０-９．]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[,，¥￥\s円]/g, '')
  if (t === '' || !/^\d+(\.\d+)?$/.test(t)) return NaN
  return Number(t)
}
