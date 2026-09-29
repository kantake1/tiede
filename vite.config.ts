import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Firebase (Firestore) SDK だけで約 550kB。遅延読み込み済みで、以後は Service Worker が端末に保存する
    chunkSizeWarningLimit: 600,
  },
})
