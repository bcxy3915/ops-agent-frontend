import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  },
  server: {
    port: 5173,
    open: true,       // 启动时自动打开浏览器
    proxy: {
      // 后端代理（后面联调时用）
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true
      }
    }
  }
})