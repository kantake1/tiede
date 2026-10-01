// スマホ幅の通しテスト (iPhone = WebKit, Android = Chrome)。プレビュー URL の代わりにモバイル表示を確かめる (#48)
import { expect, test, type Page } from '@playwright/test'

// ページ全体に横スクロールが出ていない
async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(0)
}

test('スマホ: ＋から全画面で追加し、引き出しのイベントをスワイプで削除する', async ({ page }) => {
  page.on('dialog', (d) => (d.type() === 'prompt' ? d.accept('旅行') : d.accept()))

  await page.goto('/')
  await page.getByPlaceholder('例: いつものメンバー').fill('スマホ旅行')
  await page.getByLabel('追加するメンバーの名前').fill('Aさん, Bさん')
  await page.locator('button[type="submit"]').click()
  await page.waitForURL(/\/t\/.+/)
  await expectNoHorizontalScroll(page)

  // 引き出しを開いてイベントを追加
  await page.getByRole('button', { name: 'サイドバーを開く' }).click()
  await page.getByRole('button', { name: 'イベントを追加' }).click()
  const row = page.locator('.sidebar .sb-row', { hasText: '旅行' })
  await expect(row).toBeVisible()
  await page.locator('.sidebar').getByRole('button', { name: '閉じる' }).click()

  // ＋ から全画面の入力 (均等・品目) を開き、横スクロールが出ないことを確かめる
  await page.getByRole('button', { name: '支払いを追加' }).click()
  const f = page.locator('.expense-form')
  await expect(f).toBeVisible()
  await f.getByPlaceholder('例: 食事代').fill('夕食')
  await f.getByPlaceholder('12000').fill('3000')
  await f.getByLabel('立て替えた人').selectOption({ label: 'Aさん' })
  await f.getByRole('radio', { name: '品目', exact: true }).click()
  await expectNoHorizontalScroll(page)
  await f.getByRole('radio', { name: '均等', exact: true }).click()
  await expectNoHorizontalScroll(page)
  await f.getByRole('button', { name: '追加', exact: true }).click()

  // 追加すると全画面が閉じ、一覧と精算が見える (A が 3000 立て替え、2人で均等 → B が A に 1,500)
  await expect(f).toBeHidden()
  await expect(page.locator('.expense', { hasText: '夕食' })).toBeVisible()
  await expect(page.locator('.transfers li')).toContainText('1,500')
  await expectNoHorizontalScroll(page)

  // 行を左へスワイプ (スクロールスナップ) すると削除ボタンが出る
  await page.getByRole('button', { name: 'サイドバーを開く' }).click()
  await row.evaluate((el) => el.scrollTo({ left: el.scrollWidth }))
  const trash = row.getByRole('button', { name: '旅行 を削除' })
  await expect(trash).toBeInViewport()
  await trash.click()
  await page.getByRole('alertdialog').getByRole('button', { name: '削除' }).click()
  await expect(page.locator('.sidebar .sb-row', { hasText: '旅行' })).toHaveCount(0)
})
