<template>
  <div class="login-page">
    <!-- 左上角返回按钮 -->
    <div class="back-btn" @click="goBack">
      <el-icon>
        <ArrowLeft />
      </el-icon>
      返回
    </div>

    <div class="login-card">
      <div class="login-logo">
        <div class="logo-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
            stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
        </div>
        <h1>Ops Agent</h1>
        <p class="subtitle">通用运维智能体</p>
      </div>

      <!-- ★ 复用 LoginForm -->
      <LoginForm @success="handleSuccess" />

      <div class="login-hint">
        <el-icon>
          <InfoFilled />
        </el-icon>
        演示模式：任意账号密码均可登录
      </div>
    </div>
  </div>
</template>

<script setup>
import { useRouter, useRoute } from 'vue-router'
import { ArrowLeft, InfoFilled } from '@element-plus/icons-vue'
import LoginForm from '@/components/auth/LoginForm.vue'

const router = useRouter()
const route = useRoute()

function handleSuccess() {
  const redirect = route.query.redirect || '/chat'
  router.push(redirect)
}

function goBack() {
  if (window.history.length > 1) {
    router.back()
  } else {
    router.push('/chat')
  }
}
</script>

<style scoped>
.login-page {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  background:
    radial-gradient(ellipse 70% 55% at 15% 0%, rgba(219, 234, 254, 0.7) 0%, transparent 55%),
    radial-gradient(ellipse 60% 55% at 85% 100%, rgba(237, 233, 254, 0.6) 0%, transparent 55%),
    radial-gradient(ellipse 50% 50% at 50% 50%, rgba(255, 255, 255, 0.8) 0%, transparent 70%),
    linear-gradient(180deg, #F8FAFD 0%, #EFF3FA 100%);
}

.back-btn {
  position: absolute;
  top: 24px;
  left: 24px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  font-size: 13.5px;
  color: var(--text-secondary);
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(12px);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
  border: 1px solid rgba(226, 232, 240, 0.6);
}

.back-btn:hover {
  background: rgba(255, 255, 255, 0.95);
  color: var(--primary);
  box-shadow: 0 2px 8px rgba(30, 64, 175, 0.08);
}

.login-card {
  width: 400px;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  border: 1px solid rgba(226, 232, 240, 0.6);
  border-radius: 16px;
  padding: 40px 36px 28px;
  box-shadow: 0 20px 60px rgba(30, 64, 175, 0.1);
}

.login-logo {
  text-align: center;
  margin-bottom: 32px;
}

.logo-icon {
  width: 56px;
  height: 56px;
  margin: 0 auto 16px;
  background: linear-gradient(135deg, #3B82F6 0%, #1E40AF 100%);
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  box-shadow: 0 8px 24px rgba(30, 64, 175, 0.3);
}

.login-logo h1 {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: 0.5px;
}

.subtitle {
  font-size: 13px;
  color: var(--text-muted);
  margin-top: 6px;
}

.login-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 20px;
}
</style>