import { afterEach, describe, expect, it, vi } from 'vitest'
import { dateOf, formatDate, groupByDate, toDateKey } from './date'
import { friendlyError } from './errors'
import { parseNumber, yen } from './format'
import { settlementText } from './shareText'
import { loadFlag, loadJson, saveFlag, saveJson } from './storage'

describe('date', () => {
  it('ローカル日付のキーを作る', () => {
    expect(toDateKey(new Date(2026, 0, 5))).toBe('2026-01-05')
  })

  it('日付の無い支払いは作成日時の日付', () => {
    expect(dateOf({ createdAt: new Date(2026, 8, 28, 23, 59).getTime() })).toBe('2026-09-28')
    expect(dateOf({ date: '2026-09-01', createdAt: 0 })).toBe('2026-09-01')
  })

  it('曜日付きで表示し、今年以外は年も付ける', () => {
    const now = new Date(2026, 8, 29)
    expect(formatDate('2026-09-28', now)).toBe('9月28日(月)')
    expect(formatDate('2025-12-31', now)).toBe('2025年12月31日(水)')
  })

  it('新しい日付順、同日は登録の新しい順にまとめる', () => {
    const g = groupByDate([
      { date: '2026-09-27', createdAt: 1 },
      { date: '2026-09-28', createdAt: 2 },
      { date: '2026-09-28', createdAt: 3 },
    ])
    expect(g.map(([k, v]) => [k, v.map((e) => e.createdAt)])).toEqual([
      ['2026-09-28', [3, 2]],
      ['2026-09-27', [1]],
    ])
  })
})

describe('format', () => {
  it('負の金額', () => expect(yen(-1234)).toBe('-¥1,234'))
  it('全角・カンマ・円記号を許容し、不正は NaN', () => {
    expect(parseNumber('１２,０００円')).toBe(12000)
    expect(parseNumber('¥ 3,000')).toBe(3000)
    expect(parseNumber('1.5')).toBe(1.5)
    expect(parseNumber('abc')).toBeNaN()
    expect(parseNumber('')).toBeNaN()
    expect(parseNumber('-100')).toBeNaN()
  })
})

describe('settlementText', () => {
  const nameOf = (id: string) => ({ a: 'たろう', b: 'はなこ' })[id] ?? id
  it('送金と総額を並べる', () => {
    expect(settlementText({ groupName: '大学', label: '旅行', transfers: [{ from: 'b', to: 'a', amount: 1200 }], total: 5000, nameOf, url: 'https://x' })).toBe(
      '【大学】旅行 の精算\nはなこ → たろう  ¥1,200\n総額 ¥5,000\n\n詳細: https://x',
    )
  })
  it('精算不要', () => {
    expect(settlementText({ groupName: 'G', label: 'すべて', transfers: [], total: 0, nameOf })).toBe('【G】精算\n精算は不要です (全員の負担が釣り合っています)\n総額 ¥0')
  })
})

describe('friendlyError', () => {
  it('コード・メッセージから文を選ぶ', () => {
    expect(friendlyError({ code: 'permission-denied', message: '' })).toMatch('拒否')
    expect(friendlyError(new Error('[429 ] You exceeded your current quota'))).toMatch('上限')
    expect(friendlyError(new Error('Firebase App Check token is invalid.'))).toMatch('認証')
    expect(friendlyError(new Error('AI: Error fetching from https://x: [401 ] Firebase App Check token is invalid.'))).toMatch('認証')
    expect(friendlyError(new Error('その他'))).toBe('その他')
  })
})

describe('storage', () => {
  afterEach(() => vi.unstubAllGlobals())
  const memory = () => {
    const m = new Map<string, string>()
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }
  }

  it('保存した値を読み、無い・壊れている場合は既定値', () => {
    const ls = memory()
    vi.stubGlobal('localStorage', ls)
    expect(loadJson('k', { a: 0 })).toEqual({ a: 0 })
    saveJson('k', { a: 1 })
    expect(loadJson('k', {})).toEqual({ a: 1 })
    ls.setItem('k', '{broken')
    expect(loadJson('k', [])).toEqual([])
    saveFlag('f', true)
    expect(ls.getItem('f')).toBe('1')
    expect(loadFlag('f')).toBe(true)
    saveFlag('f', false)
    expect(loadFlag('f')).toBe(false)
  })

  it('使えない端末でも例外を出さない', () => {
    const fail = () => {
      throw new Error('SecurityError')
    }
    vi.stubGlobal('localStorage', { getItem: fail, setItem: fail })
    expect(loadJson('k', 1)).toBe(1)
    expect(loadFlag('f')).toBe(false)
    expect(() => saveJson('k', 1)).not.toThrow()
    expect(() => saveFlag('f', true)).not.toThrow()
  })
})
