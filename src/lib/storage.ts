// 端末 (localStorage) への保存。プライベートモードや容量超過で失敗しても動作に影響させない

export function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw === null ? fallback : JSON.parse(raw)
  } catch {
    return fallback
  }
}

export function saveJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // 保存できなくても動作に影響しない
  }
}

/** '1' / '0' で保存するオン・オフ */
export function loadFlag(key: string) {
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

export function saveFlag(key: string, on: boolean) {
  try {
    localStorage.setItem(key, on ? '1' : '0')
  } catch {
    // 同上
  }
}
