/**
 * レシート写真を Firestore に保存できる大きさへ縮小・圧縮する (JPEG の base64)。
 * Firestore の1件の上限 (1MiB) と無料枠 (保存 1GiB) に収めるため、1枚あたり約300KB以下にする。
 * ブラウザで縮小できない形式 (Chrome での HEIC など) は null を返し、保存しない。
 */
export const MAX_RECEIPT_BYTES = 300 * 1024

export async function compressReceipt(file: File): Promise<string | null> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    return null
  }
  // 品名と金額が読める程度を保ちつつ、長辺と画質を段階的に下げる
  for (const [side, quality] of [
    [1400, 0.7],
    [1200, 0.6],
    [1000, 0.55],
    [900, 0.5],
  ] as const) {
    const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const data = canvas.toDataURL('image/jpeg', quality).split(',')[1]
    if (base64Bytes(data) <= MAX_RECEIPT_BYTES) return data
  }
  return null
}

/** base64 文字列が表すバイト数 */
export const base64Bytes = (b64: string) => Math.floor((b64.length * 3) / 4) - (b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0)

/** グループあたりの保存枚数の上限 (無料枠 1GiB に対し 300KB × 300枚 ≒ 90MB/グループ) */
export const MAX_RECEIPTS_PER_GROUP = 300
