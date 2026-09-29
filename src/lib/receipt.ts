import { getAI, getGenerativeModel, GoogleAIBackend, Schema } from 'firebase/ai'
import { app } from '../store/firestore'

export type ReceiptResult = {
  storeName: string
  total: number
  items: { name: string; price: number }[]
}

const model = getGenerativeModel(getAI(app, { backend: new GoogleAIBackend() }), {
  model: 'gemini-3.5-flash-lite',
  generationConfig: {
    responseMimeType: 'application/json',
    responseSchema: Schema.object({
      properties: {
        storeName: Schema.string({ description: '店名。不明なら空文字' }),
        total: Schema.integer({ description: '実際に支払った合計金額(税込, 円)' }),
        items: Schema.array({
          items: Schema.object({
            properties: {
              name: Schema.string(),
              price: Schema.integer({ description: 'その行の金額(数量×単価, 円)。値引きは負数' }),
            },
          }),
        }),
      },
    }),
  },
})

const PROMPT = `このレシート画像から品目を抽出する。
- items には購入した品目と値引き・割引の行だけを入れる。小計・合計・消費税・お預り・お釣りの行は入れない
- price はその行の金額 (数量×単価)。値引きは負の数
- total は税込の支払合計
- 読み取れない文字は推測で補わず、分かる範囲で品目名を書く`

/** 送信サイズを抑えるため長辺 1600px の JPEG に縮小する */
async function toJpegBase64(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.85).split(',')[1]
}

export async function readReceipt(file: File): Promise<ReceiptResult> {
  const data = await toJpegBase64(file)
  const res = await model.generateContent([PROMPT, { inlineData: { mimeType: 'image/jpeg', data } }])
  const r = JSON.parse(res.response.text()) as ReceiptResult
  return {
    storeName: r.storeName ?? '',
    total: Math.round(r.total ?? 0),
    items: (r.items ?? []).filter((it) => it.name && Number.isFinite(it.price)).map((it) => ({ name: it.name, price: Math.round(it.price) })),
  }
}
