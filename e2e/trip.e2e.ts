// 通しテスト: 3人・2日間の旅行。作成 → 支払い (均等・比率・金額指定) → 精算 → 削除と復元 → アーカイブ → イベント削除
import { expect, test, type Page } from '@playwright/test'

const form = (page: Page) => page.locator('.expense-form')

async function addExpense(
  page: Page,
  e: { title: string; amount: number; payer: string; date: string; mode: string; shares?: Record<string, number> },
) {
  const f = form(page)
  await f.getByPlaceholder('例: 食事代').fill(e.title)
  await f.getByPlaceholder('12000').fill(String(e.amount))
  await f.getByLabel('立て替えた人').selectOption({ label: e.payer })
  await f.locator('input[type="date"]').fill(e.date)
  await f.getByLabel('イベント').selectOption({ label: '旅行' })
  await f.getByRole('radio', { name: e.mode, exact: true }).click()
  const unit = e.mode === '比率' ? '比率' : '金額'
  for (const [name, v] of Object.entries(e.shares ?? {})) await f.getByLabel(`${name} の${unit}`).fill(String(v))
  await f.getByRole('button', { name: '追加', exact: true }).click()
  await expect(page.locator('.expense', { hasText: e.title })).toBeVisible()
}

const allTotal = (page: Page) => page.locator('.sidebar .sb-cats label', { hasText: 'すべて' }).locator('.muted.small')

test('旅行の立て替えを記録して精算する', async ({ page, browser }) => {
  let promptValue = '旅行'
  page.on('dialog', (d) => (d.type() === 'prompt' ? d.accept(promptValue) : d.accept()))

  // グループ作成
  await page.goto('/')
  await page.getByPlaceholder('例: いつものメンバー').fill('テスト旅行')
  await page.locator('textarea').fill('Aさん\nBさん\nCさん')
  await page.locator('button[type="submit"]').click()
  await page.waitForURL(/\/t\/.+/)

  // イベント
  promptValue = '旅行'
  await page.getByRole('button', { name: 'イベントを追加' }).click()
  await expect(page.locator('.sidebar .sb-cats li', { hasText: '旅行' })).toBeVisible()

  // 支払い
  await addExpense(page, { title: 'ホテル', amount: 30000, payer: 'Aさん', date: '2026-09-01', mode: '均等' })
  await addExpense(page, {
    title: '夕食',
    amount: 9000,
    payer: 'Bさん',
    date: '2026-09-01',
    mode: '比率',
    shares: { Aさん: 2, Bさん: 1, Cさん: 1 },
  })
  await addExpense(page, {
    title: '買い物',
    amount: 4500,
    payer: 'Cさん',
    date: '2026-09-02',
    mode: '金額',
    shares: { Aさん: 1500, Bさん: 1500, Cさん: 1500 },
  })

  // 一覧は日付ごと
  await expect(page.locator('.date-head')).toHaveCount(2)

  // 精算: 差額 A +14,000 / B -4,750 / C -9,250 → 送金2回
  const transfers = page.locator('.transfers li')
  await expect(transfers).toHaveCount(2)
  await expect(transfers.filter({ hasText: 'Bさん' })).toContainText('4,750')
  await expect(transfers.filter({ hasText: 'Cさん' })).toContainText('9,250')
  await expect(allTotal(page)).toContainText('43,500')

  // 削除して「元に戻す」
  await page.locator('.expense', { hasText: '夕食' }).getByRole('button', { name: '削除' }).click()
  await expect(page.locator('.expense', { hasText: '夕食' })).toHaveCount(0)
  await page.locator('.toast-action', { hasText: '元に戻す' }).click()
  await expect(page.locator('.expense', { hasText: '夕食' })).toBeVisible()

  // 精算済みにすると「すべて」から外れる
  await page.locator('.sidebar .sb-cats label', { hasText: '旅行' }).locator('input').check()
  await page.getByRole('button', { name: '精算済みにする' }).click()
  const archive = page.locator('details.sb-archive')
  await archive.locator('summary').click()
  await expect(archive.locator('li', { hasText: '旅行' })).toBeVisible()
  await expect(allTotal(page)).toContainText('0')
  await expect(allTotal(page)).not.toContainText('43,500')

  // アーカイブから戻す
  await page.getByRole('button', { name: '旅行 をアーカイブから戻す' }).click()
  await expect(allTotal(page)).toContainText('43,500')

  // 別の端末 (スマホ幅) で同じ URL を開くと同じ内容が見える
  const other = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await other.goto(page.url())
  await expect(other.locator('.expense')).toHaveCount(3)
  await other.close()

  // イベントを削除しても支払いは「未分類」で残る
  await page.getByRole('button', { name: '旅行 を削除' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: '削除' }).click()
  await expect(page.locator('.sidebar .sb-cats li', { hasText: '旅行' })).toHaveCount(0)
  await expect(page.locator('.expense')).toHaveCount(3)
  await expect(allTotal(page)).toContainText('43,500')
})

test('品目別: 全員の品目は名前を1回押すとその人だけになる', async ({ page }) => {
  await page.goto('/')
  await page.getByPlaceholder('例: いつものメンバー').fill('買い出し')
  await page.locator('textarea').fill('Aさん\nBさん\nCさん')
  await page.locator('button[type="submit"]').click()
  await page.waitForURL(/\/t\/.+/)

  const f = form(page)
  await f.getByPlaceholder('例: 食事代').fill('スーパー')
  await f.getByPlaceholder('12000').fill('3000')
  await f.getByRole('radio', { name: '品目', exact: true }).click()
  for (const [i, [name, price]] of [['弁当', 600], ['お茶', 2400]].entries()) {
    await f.getByRole('button', { name: '品目を追加' }).click()
    await f.getByLabel(`${i + 1}行目の品名`).fill(String(name))
    await f.getByLabel(`${i + 1}行目の金額`).fill(String(price))
  }

  const bento = f.locator('.items > li').first()
  await expect(bento.getByRole('button', { name: '全員' })).toHaveAttribute('aria-pressed', 'true')
  await bento.getByRole('button', { name: 'Aさんだけ' }).click()
  await expect(bento.getByRole('button', { name: '全員' })).toHaveAttribute('aria-pressed', 'false')
  await expect(bento.getByRole('button', { name: 'Aさん', exact: true })).toHaveAttribute('aria-pressed', 'true')
  // A: 600 + 800、B・C: 800
  await expect(f.locator('.participants li', { hasText: 'Aさん' })).toContainText('1,400')
  await expect(f.locator('.participants li', { hasText: 'Bさん' })).toContainText('800')

  // 最後の1人を外すと全員に戻る
  await bento.getByRole('button', { name: 'Aさん', exact: true }).click()
  await expect(bento.getByRole('button', { name: '全員' })).toHaveAttribute('aria-pressed', 'true')
  await bento.getByRole('button', { name: 'Aさんだけ' }).click()

  await f.getByRole('button', { name: '追加', exact: true }).click()
  await expect(page.locator('.expense', { hasText: 'スーパー' })).toContainText('Aさん ¥1,400')
})

test('タブレット幅: 再度読み取るの確認をキャンセルできる', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 })
  // 読み取り (Gemini) は外部へ出さずに失敗させる。写真は保存されるので「再度読み取る」が出る
  await page.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/, (r) => r.abort())
  await page.goto('/')
  await page.getByPlaceholder('例: いつものメンバー').fill('レシート')
  await page.locator('textarea').fill('Aさん\nBさん')
  await page.locator('button[type="submit"]').click()
  await page.waitForURL(/\/t\/.+/)

  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  )
  await form(page).locator('.receipt input[type="file"]').setInputFiles({ name: 'r.png', mimeType: 'image/png', buffer: png })
  await form(page).getByRole('button', { name: '再度読み取る' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'キャンセル' }).click()
  await expect(page.getByRole('alertdialog')).toBeHidden()
})
