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

// 猶予 (7日) が過ぎた状態を作る: エミュレータの REST (ルールを通らない) で、削除済みの支払いの trashedAt を古くする
async function ageTrash(page: Page, days: number) {
  const tripId = new URL(page.url()).pathname.split('/t/')[1]
  const base = `http://127.0.0.1:8080/v1/projects/demo-tiede/databases/(default)/documents/trips/${tripId}/expenses`
  const headers = { Authorization: 'Bearer owner' }
  const list = (await (await fetch(base, { headers })).json()) as { documents: { name: string; fields: Record<string, unknown> }[] }
  const at = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  for (const d of list.documents.filter((x) => 'trashedAt' in x.fields)) {
    const url = `http://127.0.0.1:8080/v1/${d.name}?updateMask.fieldPaths=trashedAt`
    await fetch(url, { method: 'PATCH', headers, body: JSON.stringify({ fields: { trashedAt: { timestampValue: at } } }) })
  }
}

const allTotal = (page: Page) => page.locator('.sidebar .sb-cats label', { hasText: 'すべて' }).locator('.muted.small')

test('旅行の立て替えを記録して精算する', async ({ page, browser }) => {
  let promptValue = '旅行'
  page.on('dialog', (d) => (d.type() === 'prompt' ? d.accept(promptValue) : d.accept()))

  // グループ作成
  await page.goto('/')
  await page.getByPlaceholder('例: いつものメンバー').fill('テスト旅行')
  await page.getByLabel('追加するメンバーの名前').fill('Aさん, Bさん, Cさん')
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
  const member = page.getByLabel('追加するメンバーの名前')
  for (const n of ['Aさん', 'Bさん', 'Aさん']) await member.fill(n).then(() => member.press('Enter'))
  await expect(page.getByText('Aさん はすでに追加しています')).toBeVisible()
  await member.fill('Cさん')
  await page.getByRole('button', { name: '追加', exact: true }).click()
  await expect(page.locator('.member-list li')).toHaveText(['1Aさん', '2Bさん', '3Cさん'])
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

test('プライバシーポリシー: 作成画面の注意書きとフッターから開ける', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('URL を知っている人は誰でも閲覧・編集・削除できる')).toBeVisible()
  await page.getByRole('link', { name: 'プライバシーポリシー' }).click()
  await page.waitForURL('/privacy')
  await expect(page.getByRole('heading', { name: 'プライバシーポリシー' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'tiede@tuta.com' })).toHaveAttribute('href', 'mailto:tiede@tuta.com')
})

test('タブレット幅: レシートは初回だけ確認してから読み取り、再度読み取るの確認をキャンセルできる', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 })
  // 読み取り (Gemini) は外部へ出さずに失敗させる。写真は保存されるので「再度読み取る」が出る
  await page.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/, (r) => r.abort())
  await page.goto('/')
  await page.getByPlaceholder('例: いつものメンバー').fill('レシート')
  await page.getByLabel('追加するメンバーの名前').fill('Aさん, Bさん')
  await page.locator('button[type="submit"]').click()
  await page.waitForURL(/\/t\/.+/)

  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  )
  // 初回は Gemini に送ることを確認する。確認の「読み取る」が写真選択になっている
  await form(page).getByRole('button', { name: 'レシートを読み取る' }).click()
  const consent = page.getByRole('alertdialog', { name: 'レシートの読み取りについて' })
  await expect(consent).toContainText('AI の学習に使われることはありません')
  await expect(consent.getByRole('link', { name: 'プライバシーポリシー' })).toHaveAttribute('href', '/privacy')
  await consent.locator('input[type="file"]').setInputFiles({ name: 'r.png', mimeType: 'image/png', buffer: png })
  await expect(consent).toBeHidden()
  expect(await page.evaluate(() => localStorage.getItem('tiede:receipt-ai-consent'))).toBe('1')

  // 確認済みなので、再度読み取るの確認に Gemini の説明は出ない
  await form(page).getByRole('button', { name: '再度読み取る' }).click()
  await expect(page.getByRole('alertdialog')).not.toContainText('Gemini')
  await page.getByRole('alertdialog').getByRole('button', { name: 'キャンセル' }).click()
  await expect(page.getByRole('alertdialog')).toBeHidden()
})

test('広い画面: 格納を選んでいてもサイドバー幅の取っ手が出る', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('tiede:sidebar-collapsed', '1'))
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.getByPlaceholder('例: いつものメンバー').fill('取っ手')
  await page.getByLabel('追加するメンバーの名前').fill('Aさん, Bさん')
  await page.locator('button[type="submit"]').click()
  await page.waitForURL(/\/t\/.+/)
  await expect(page.getByRole('separator', { name: /サイドバーの幅/ })).toBeAttached()
})

test('最近開いたグループ: 履歴から消しても元に戻せる', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.getByPlaceholder('例: いつものメンバー').fill('履歴')
  await page.getByLabel('追加するメンバーの名前').fill('Aさん, Bさん')
  await page.locator('button[type="submit"]').click()
  await page.waitForURL(/\/t\/.+/)
  await expect(page.locator('.sidebar h1')).toHaveText('履歴') // 読み込み後に履歴へ記録される
  await page.goto('/')
  await page.getByRole('button', { name: '履歴 を履歴から削除' }).click()
  await expect(page.getByRole('link', { name: '履歴', exact: true })).toBeHidden()
  await page.getByRole('button', { name: '元に戻す' }).click()
  await expect(page.getByRole('link', { name: '履歴', exact: true })).toBeVisible()
})


test('受取済みの人はその支払いの精算から外れる', async ({ page }) => {
  await page.goto('/')
  await page.getByPlaceholder('例: いつものメンバー').fill('受取')
  await page.getByLabel('追加するメンバーの名前').fill('Aさん, Bさん, Cさん')
  await page.locator('button[type="submit"]').click()
  await page.waitForURL(/\/t\/.+/)

  const f = form(page)
  await f.getByPlaceholder('例: 食事代').fill('焼肉')
  await f.getByPlaceholder('12000').fill('3000')
  await expect(f.getByRole('button', { name: 'Aさん から受取済み' })).toHaveCount(0) // 立て替えた本人には付けられない
  await f.getByRole('button', { name: 'Bさん から受取済み' }).click()
  await f.getByRole('button', { name: '追加', exact: true }).click()

  await expect(page.locator('.expense', { hasText: '焼肉' })).toContainText('受取済み 1人')
  await expect(page.locator('.transfers li')).toHaveText([/Cさん.*Aさん.*1,000/])
})

test('一覧のコンパクト表示: 1件1行で、押すとその1件だけ開く', async ({ page }) => {
  await page.goto('/')
  await page.getByPlaceholder('例: いつものメンバー').fill('表示')
  await page.getByLabel('追加するメンバーの名前').fill('Aさん, Bさん')
  await page.locator('button[type="submit"]').click()
  await page.waitForURL(/\/t\/.+/)

  const f = form(page)
  for (const title of ['昼食', '夕食']) {
    await f.getByPlaceholder('例: 食事代').fill(title)
    await f.getByPlaceholder('12000').fill('2000')
    await f.getByRole('button', { name: '追加', exact: true }).click()
    await expect(page.locator('.expense', { hasText: title })).toBeVisible()
  }
  const edit = page.locator('.expense').getByRole('button', { name: '編集' })
  await expect(edit).toHaveCount(2) // 初めはフル

  await page.getByRole('radio', { name: 'コンパクト' }).click()
  await expect(edit).toHaveCount(0)
  await expect(page.locator('.expense', { hasText: '昼食' })).not.toContainText('Bさん ¥1,000')
  const lunch = page.getByRole('button', { name: /昼食/ })
  await lunch.click()
  await expect(lunch).toHaveAttribute('aria-expanded', 'true')
  await expect(edit).toHaveCount(1)
  await page.getByRole('button', { name: /夕食/ }).click() // 開くのは1件だけ
  await expect(lunch).toHaveAttribute('aria-expanded', 'false')
  await expect(edit).toHaveCount(1)

  await page.reload() // 選んだ表示は端末に記憶する
  await expect(page.getByRole('radio', { name: 'コンパクト' })).toHaveAttribute('aria-checked', 'true')
  await expect(edit).toHaveCount(0)
})

test('大人数: 均等の負担額は1行にまとめ、品目の対象者は要約から開く', async ({ page }) => {
  const names = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map((n) => `${n}さん`)
  await page.goto('/')
  await page.getByPlaceholder('例: いつものメンバー').fill('大人数')
  await page.getByLabel('追加するメンバーの名前').fill(names.join(', '))
  await page.locator('button[type="submit"]').click()
  await page.waitForURL(/\/t\/.+/)

  // 均等: 8010円を8人 → 1,001円ずつ、端数の2円は立て替えた A さん
  const f = form(page)
  await f.getByPlaceholder('例: 食事代').fill('宴会')
  await f.getByPlaceholder('12000').fill('8010')
  await expect(f.locator('.eq-sum')).toHaveText('7人 各¥1,001 / Aさん ¥1,003')
  await f.getByRole('button', { name: 'Hさん', exact: true }).click() // 対象から外す
  await expect(f.locator('.eq-sum')).toHaveText('6人 各¥1,144 / Aさん ¥1,146')
  await expect(f.getByRole('button', { name: 'Aさん から受取済み' })).toHaveCount(0)
  await f.getByRole('button', { name: 'Bさん から受取済み' }).click()
  await f.getByRole('button', { name: '追加', exact: true }).click()
  await expect(page.locator('.expense', { hasText: '宴会' })).toContainText('6人 各¥1,144 / Aさん ¥1,146 · 受取済み: Bさん')

  // 品目別: 7人以上なら対象者は要約。押すと名前ボタンが開く (同時に1品目)
  await f.getByPlaceholder('例: 食事代').fill('買い出し')
  await f.getByRole('radio', { name: '品目', exact: true }).click()
  for (let n = 0; n < 2; n++) await f.getByRole('button', { name: '品目を追加' }).click()
  const first = f.getByRole('button', { name: /^1行目の対象者/ })
  const second = f.getByRole('button', { name: /^2行目の対象者/ })
  await expect(first).toHaveText('全員 (8人)')
  await expect(f.getByRole('button', { name: 'Cさんだけ' })).toHaveCount(0)
  await first.click()
  await f.getByRole('button', { name: 'Cさんだけ' }).click()
  await f.getByRole('button', { name: 'Dさん', exact: true }).click()
  await f.getByRole('button', { name: 'Eさん', exact: true }).click()
  await expect(first).toHaveText('Cさん・Dさん ほか1人')
  await second.click()
  await expect(first).toHaveAttribute('aria-expanded', 'false')
})


test('削除した支払いは「削除済み」から元に戻せ、7日たつと完全に削除できる', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.getByPlaceholder('例: いつものメンバー').fill('削除済み')
  await page.getByLabel('追加するメンバーの名前').fill('Aさん, Bさん')
  await page.locator('button[type="submit"]').click()
  await page.waitForURL(/\/t\/.+/)

  const f = form(page)
  for (const title of ['昼食', '夕食']) {
    await f.getByPlaceholder('例: 食事代').fill(title)
    await f.getByPlaceholder('12000').fill('2000')
    await f.getByRole('button', { name: '追加', exact: true }).click()
    await expect(page.locator('.expense', { hasText: title })).toBeVisible()
  }
  for (const title of ['昼食', '夕食']) await page.locator('.expense', { hasText: title }).getByRole('button', { name: '削除' }).click()
  await expect(allTotal(page)).toContainText('0')

  // 削除済みから元に戻すと合計に戻る
  await page.getByRole('button', { name: '削除済み (2件)' }).click()
  await page.locator('.expense.deleted', { hasText: '昼食' }).getByRole('button', { name: '元に戻す' }).click()
  await expect(allTotal(page)).toContainText('2,000')

  // 猶予中は「完全に削除」を出さず、いつから消せるかを書く (ルールでも拒否される)
  const dinner = page.locator('.expense.deleted', { hasText: '夕食' })
  await expect(dinner).toContainText('から完全に削除できます')
  await expect(dinner.getByRole('button', { name: '完全に削除' })).toHaveCount(0)

  // 7日たつと完全に削除でき、削除済みが0件になって通常の一覧に戻る
  await ageTrash(page, 8)
  await dinner.getByRole('button', { name: '完全に削除' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: '完全に削除' }).click()
  await expect(page.getByRole('button', { name: /削除済み/ })).toHaveCount(0)
  await expect(page.locator('.expense')).toHaveText([/昼食/])
})

test('グループの削除を予約すると全員に知らせ、誰でも取り消せる', async ({ page, browser }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.getByPlaceholder('例: いつものメンバー').fill('消すグループ')
  await page.getByLabel('追加するメンバーの名前').fill('Aさん, Bさん')
  await page.locator('button[type="submit"]').click()
  await page.waitForURL(/\/t\/.+/)

  // 設定のいちばん下から。グループ名を入力するまで確定できない
  await page.getByRole('button', { name: '設定' }).click()
  await page.getByRole('button', { name: 'グループを削除…' }).click()
  const dialog = page.getByRole('alertdialog')
  await expect(dialog).toContainText('メンバー2人')
  const ok = dialog.getByRole('button', { name: '削除を予約' })
  await expect(ok).toBeDisabled()
  await dialog.getByLabel('確認のため、グループ名を入力してください').fill('消すグループ')
  await ok.click()

  // 別の端末で開いても、削除予定の帯が出る。そこから取り消すと消える
  const other = await browser.newPage()
  await other.goto(page.url())
  const bar = other.locator('.pending-delete')
  await expect(bar).toContainText('以降に削除されます')
  await bar.getByRole('button', { name: '削除を取り消す' }).click()
  await expect(bar).toHaveCount(0)
  await expect(page.locator('.pending-delete')).toHaveCount(0)
  await other.close()
})
