/** サーバー受領前に待つのをやめた書き込みが後から失敗したときのイベント (detail にエラー) */
export const WRITE_ERROR_EVENT = 'tiede:write-error'

/** Firebase / Gemini のエラーを利用者向けの文に変える */
export function friendlyError(e: unknown): string {
  const code = (e as { code?: string })?.code ?? ''
  const msg = (e as Error)?.message ?? String(e)
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'オフラインのため実行できない。電波の良い場所で再度試す'
  if (code.includes('permission-denied')) return '保存が拒否された。入力内容が長すぎないか、URLが正しいか確認する'
  // 「Error fetching from …: [401]」のように通信の文言を含むため、状態コードの判定を先に行う
  if (/\b429\b|quota|resource-exhausted/i.test(code + msg)) return '本日のレシート読み取り回数の上限に達した。手入力するか、明日以降に試す'
  if (/App ?Check|\b401\b|\b403\b/i.test(msg)) return 'アプリの認証に失敗した。ページを再読み込みして試す'
  if (code.includes('unavailable') || /network|fetch/i.test(msg)) return '通信できなかった。電波の良い場所で再度試す'
  return msg
}
