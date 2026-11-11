import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    proxy: {
      '/api/ai': {
        target: 'https://text.pollinations.ai',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/ai/, '')
      }
    }
  }
})
