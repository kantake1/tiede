import { describe, expect, it } from 'vitest'
import { decrypt, decryptJson, encrypt, encryptJson, exportKey, fromBase64Url, generateKey, importKey, toBase64Url } from './crypto'

const PATH = 'trips/t1/expenses/e1'

describe('crypto', () => {
  it('鍵は base64url の43文字で、書き出し・読み込みで同じ鍵になる', async () => {
    const key = await generateKey()
    const s = await exportKey(key)
    expect(s).toMatch(/^[A-Za-z0-9_-]{43}$/)
    const sealed = await encryptJson(key, { a: 1 }, PATH)
    expect(await decryptJson(await importKey(s), sealed, PATH)).toEqual({ a: 1 })
    await expect(importKey('short')).rejects.toThrow()
    await expect(importKey('!'.repeat(43))).rejects.toThrow()
  })

  it('JSON (文字列を含む) とバイナリを往復できる', async () => {
    const key = await generateKey()
    const value = { title: '夕食', amount: 3000, items: [{ name: 'ビール', price: 500, memberIds: ['a'] }] }
    expect(await decryptJson(key, await encryptJson(key, value, PATH), PATH)).toEqual(value)
    expect(await decryptJson(key, await encryptJson(key, '鍋パ', PATH), PATH)).toBe('鍋パ')
    const photo = Uint8Array.from({ length: 300 * 1024 }, (_, i) => (i * 31) % 256)
    expect(await decrypt(key, await encrypt(key, photo, PATH), PATH)).toEqual(photo)
  })

  it('JSON は64バイト単位に埋め、長さから中身を推測されにくくする', async () => {
    const key = await generateKey()
    const a = await encryptJson(key, 'a', PATH)
    const b = await encryptJson(key, 'a'.repeat(50), PATH)
    expect(a.length).toBe(b.length)
  })

  it('同じ中身でも毎回 IV が違い、暗号文も違う', async () => {
    const key = await generateKey()
    const a = await encryptJson(key, 'x', PATH)
    const b = await encryptJson(key, 'x', PATH)
    expect(toBase64Url(a.subarray(0, 12))).not.toBe(toBase64Url(b.subarray(0, 12)))
    expect(toBase64Url(a)).not.toBe(toBase64Url(b))
  })

  it('改ざん・別の鍵・別のドキュメントへの差し替えは復号できない', async () => {
    const key = await generateKey()
    const sealed = await encryptJson(key, { amount: 3000 }, PATH)
    const tampered = sealed.slice()
    tampered[tampered.length - 1] ^= 1
    await expect(decrypt(key, tampered, PATH)).rejects.toThrow()
    await expect(decrypt(await generateKey(), sealed, PATH)).rejects.toThrow()
    await expect(decrypt(key, sealed, 'trips/t1/expenses/e2')).rejects.toThrow()
  })

  it('base64url の変換', () => {
    const bytes = Uint8Array.from([0, 251, 255, 62, 63])
    expect(toBase64Url(bytes)).not.toMatch(/[+/=]/)
    expect(fromBase64Url(toBase64Url(bytes))).toEqual(bytes)
  })
})
