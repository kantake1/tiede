/**
 * 端末側の暗号化 (#43)。グループごとの鍵 (AES-GCM 256bit) で中身を暗号化し、運営者 (サーバー) からは読めないようにする。
 * 鍵は URL のフラグメント (`/t/{id}#…`) に base64url で載せ、サーバーには送らない。
 * 暗号文は IV (12バイト、毎回ランダム) + 本体 (認証タグ込み)。
 * aad (追加認証データ) にはドキュメントのパスを渡し、暗号文を別のドキュメントへ差し替えられても復号で検出する。
 */
const IV_BYTES = 12
const KEY_BYTES = 32
/** JSON の長さから中身を推測されにくくするため、この倍数まで空白で埋める (JSON.parse は末尾の空白を無視する) */
const PAD = 64

const enc = new TextEncoder()
const dec = new TextDecoder()

export function toBase64Url(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function fromBase64Url(s: string): Uint8Array<ArrayBuffer> {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(b, (c) => c.charCodeAt(0))
}

export const generateKey = () => crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])

export const exportKey = async (key: CryptoKey) => toBase64Url(new Uint8Array(await crypto.subtle.exportKey('raw', key)))

/** URL から取り出した鍵を読み込む。形式が違えば例外 */
export async function importKey(s: string): Promise<CryptoKey> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(s)) throw new Error('鍵の形式が正しくありません')
  const raw = fromBase64Url(s)
  if (raw.length !== KEY_BYTES) throw new Error('鍵の形式が正しくありません')
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', true, ['encrypt', 'decrypt'])
}

export async function encrypt(key: CryptoKey, data: Uint8Array<ArrayBuffer>, aad: string): Promise<Uint8Array<ArrayBuffer>> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const body = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: enc.encode(aad) }, key, data))
  const out = new Uint8Array(IV_BYTES + body.length)
  out.set(iv)
  out.set(body, IV_BYTES)
  return out
}

/** 鍵・aad が違うか、暗号文が改ざんされていれば例外 */
export async function decrypt(key: CryptoKey, sealed: Uint8Array<ArrayBuffer>, aad: string): Promise<Uint8Array<ArrayBuffer>> {
  const iv = sealed.subarray(0, IV_BYTES)
  const body = sealed.subarray(IV_BYTES)
  return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv, additionalData: enc.encode(aad) }, key, body))
}

export function encryptJson(key: CryptoKey, value: unknown, aad: string) {
  const json = JSON.stringify(value)
  const bytes = enc.encode(json)
  const padded = new Uint8Array(Math.ceil((bytes.length + 1) / PAD) * PAD).fill(0x20)
  padded.set(bytes)
  return encrypt(key, padded, aad)
}

export const decryptJson = async <T>(key: CryptoKey, sealed: Uint8Array<ArrayBuffer>, aad: string): Promise<T> =>
  JSON.parse(dec.decode(await decrypt(key, sealed, aad))) as T
