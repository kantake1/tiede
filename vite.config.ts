import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

// Service Worker のキャッシュ名 (public/sw.js の __BUILD__) にビルド内容のハッシュを埋め込む。
// 中身が変わるたびに sw.js も変わるので、端末は新しい SW を入れて古いキャッシュを消す
function swCacheName(): Plugin {
  let hash = ''
  let outDir = 'dist'
  return {
    name: 'sw-cache-name',
    apply: 'build',
    configResolved: (c) => void (outDir = resolve(c.root, c.build.outDir)),
    generateBundle(_, bundle) {
      const h = createHash('sha256')
      for (const name of Object.keys(bundle).sort()) {
        const f = bundle[name]
        h.update(name).update(f.type === 'chunk' ? f.code : f.source)
      }
      hash = h.digest('hex').slice(0, 10)
    },
    closeBundle() {
      const sw = resolve(outDir, 'sw.js')
      writeFileSync(sw, readFileSync(sw, 'utf8').replace('__BUILD__', hash))
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), swCacheName()],
  build: {
    // Firebase (Firestore) SDK だけで約 550kB。遅延読み込み済みで、以後は Service Worker が端末に保存する
    chunkSizeWarningLimit: 600,
  },
})
