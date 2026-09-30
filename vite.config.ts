import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'

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

// グループ画面 (/t/…) は Firestore の SDK が必ず要る。index.js の後に読み始めると直列になるため、HTML の時点で並行して読ませる。
// トップ画面では帯域を取り合って遅くなるので先読みしない
function preloadFirestore(): Plugin {
  return {
    name: 'preload-firestore',
    apply: 'build',
    transformIndexHtml(_, ctx) {
      const c = Object.values(ctx.bundle ?? {}).find((f) => f.type === 'chunk' && f.name === 'firestore')
      if (!c) return
      return [
        {
          tag: 'script',
          children: `if(location.pathname.startsWith('/t/')){const l=document.createElement('link');l.rel='modulepreload';l.href='/${c.fileName}';document.head.append(l)}`,
          // CSS より前に置く (CSS の後だと読み込み完了まで実行が待たされる)
          injectTo: 'head-prepend',
        },
      ]
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  // Firestore を使わないローカルモードのビルドでは先読みしない
  plugins: [react(), swCacheName(), ...(loadEnv(mode, process.cwd()).VITE_FIREBASE_PROJECT_ID ? [preloadFirestore()] : [])],
  resolve: { alias: { re2js: resolve(import.meta.dirname, 'src/lib/re2js-stub.ts') } },
  build: {
    // Firebase (Firestore) SDK だけで約 550kB。遅延読み込み済みで、以後は Service Worker が端末に保存する
    chunkSizeWarningLimit: 600,
  },
}))
