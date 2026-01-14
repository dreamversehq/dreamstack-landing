import { resolve } from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    open: true
  },
  preview: {
    open: true
  },
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        dreamstack: resolve(__dirname, 'dreamstack/index.html'),
        review: resolve(__dirname, 'dreamstack/copilot-review.html'),
      },
    },
  },
})
