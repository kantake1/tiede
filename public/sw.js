// tiede の Service Worker。画面 (HTML/JS/CSS/画像) を端末に保存し、圏外でも起動できるようにする。
// データ (Firestore) は Firebase SDK が IndexedDB に保持するので、ここでは扱わない。
const CACHE = 'oaiko-v6'

// 初回訪問ではページの読み込みが SW の起動より先に終わり、JS/CSS が保存されない。
// ページから読み込み済みファイルの一覧を受け取って保存し、次回から圏外でも起動できるようにする
self.addEventListener('message', (event) => {
  if (event.data?.type !== 'cache-urls') return
  const urls = event.data.urls.filter((u) => new URL(u).origin === self.location.origin)
  event.waitUntil(caches.open(CACHE).then((c) => Promise.all(urls.map((u) => c.match(u).then((hit) => hit || c.add(u).catch(() => {}))))))
})

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './manifest.webmanifest', './favicon.svg?v=5'])))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  const url = new URL(req.url)
  // 他サイト (Firebase, Google など) と GET 以外は触らない
  if (req.method !== 'GET' || url.origin !== self.location.origin) return

  // ページ本体: 最新を優先し、圏外なら保存済みを返す
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          // エラー応答や別ページへの転送 (公衆 Wi-Fi のログイン画面など) では保存済みを上書きしない
          if (res.ok && !res.redirected) {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put('./', copy))
          }
          return res
        })
        .catch(() => caches.match('./').then((hit) => hit || Response.error())),
    )
    return
  }

  // ビルド成果物はファイル名にハッシュが付き中身が変わらないので、保存済みを優先
  if (url.pathname.includes('/assets/')) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone()
              caches.open(CACHE).then((c) => c.put(req, copy))
            }
            return res
          }),
      ).catch(() => Response.error()),
    )
    return
  }

  // その他 (アイコンなど): 最新を優先し (ブラウザのキャッシュも通さず確認)、圏外なら保存済みを返す
  event.respondWith(
    fetch(req, { cache: 'no-cache' })
      .then((res) => {
        if (res.ok) {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(req, copy))
        }
        return res
      })
      .catch(() => caches.match(req).then((hit) => hit || Response.error())),
  )
})
