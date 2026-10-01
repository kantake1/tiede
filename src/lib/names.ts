/** 名前の入力を検証する。空・長すぎ・重複なら理由を返す */
export function nameProblem(name: string, max: number, existing: string[] = []): string | null {
  if (!name) return '名前を入力してください'
  if (name.length > max) return `${max}文字以内にしてください`
  if (existing.includes(name)) return `「${name}」は既にあります`
  return null
}

/** prompt で名前を尋ねる。キャンセル・変更なし・不正なら null (不正は理由を alert) */
export function askName(message: string, max: number, opts: { current?: string; existing?: string[] } = {}): string | null {
  const name = prompt(message, opts.current ?? '')?.trim()
  if (name === undefined || name === '' || name === opts.current) return null
  const problem = nameProblem(name, max, (opts.existing ?? []).filter((n) => n !== opts.current))
  if (problem) {
    alert(problem)
    return null
  }
  return name
}

/** 入力欄の文字をメンバー名に分ける。カンマ・改行区切りの貼り付けはまとめて扱う */
export const splitNames = (text: string) => [...new Set(text.split(/[\n,、，]/).map((s) => s.trim()).filter(Boolean))]
