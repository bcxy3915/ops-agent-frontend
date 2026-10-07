import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "path";

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
  server: {
    port: 5173,
    open: true, // 启动时自动打开浏览器
    proxy: {
      // 后端代理
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
    },
  },
  test: {
    // jsdom 环境：模拟浏览器 API（localStorage、window 等）
    environment: "jsdom",
    // 全局注入 describe / it / expect，省去每个文件 import
    globals: true,
    // 测试文件匹配规则
    include: ["src/**/*.{test,spec}.{js,ts}"],
    // 覆盖率配置
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/utils/**", "src/stores/**"],
      exclude: ["**/*.test.js", "**/node_modules/**"],
    },
  },
});
