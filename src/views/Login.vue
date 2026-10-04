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
      <!-- Logo -->
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

      <!-- 表单 -->
      <el-form ref="formRef" :model="form" :rules="rules" @keydown.enter.prevent="handleLogin">
        <el-form-item prop="username">
          <el-input v-model="form.username" placeholder="用户名" size="large" :prefix-icon="User" clearable />
        </el-form-item>

        <el-form-item prop="password">
          <el-input v-model="form.password" type="password" placeholder="密码" size="large" show-password
            :prefix-icon="Lock" />
        </el-form-item>

        <el-button type="primary" size="large" :loading="loading" class="login-btn" @click="handleLogin">
          {{ loading ? '登录中...' : '登 录' }}
        </el-button>
      </el-form>

      <!-- 演示提示 -->
      <div class="login-hint">
        <el-icon>
          <InfoFilled />
        </el-icon>
        演示模式：任意账号密码均可登录
      </div>

      <!-- 快捷账号（演示用） -->
      <div class="quick-accounts">
        <span class="quick-label">快捷登录：</span>
        <span class="quick-account" @click="fillAccount('admin')">admin</span>
        <span class="quick-account" @click="fillAccount('operator')">operator</span>
        <span class="quick-account" @click="fillAccount('viewer')">viewer</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { User, Lock, ArrowLeft, InfoFilled } from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const formRef = ref(null)
const loading = ref(false)

const form = reactive({
  username: 'admin',
  password: 'admin123'
})

const rules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
}

/**
 * 快捷填充账号
 */
function fillAccount(username) {
  form.username = username
  form.password = username + '123'
}

/**
 * 返回上一页
 */
function goBack() {
  if (window.history.length > 1) {
    router.back()
  } else {
    router.push('/chat')
  }
}

/**
 * 登录
 */
async function handleLogin() {
  if (!formRef.value) return

  try {
    await formRef.value.validate()
  } catch {
    return
  }

  loading.value = true
  try {
    await authStore.login(form.username, form.password)
    ElMessage.success('登录成功')

    // 跳转：优先用路由里带的 redirect，否则去 /chat
    const redirect = route.query.redirect || '/chat'
    router.push(redirect)
  } catch (error) {
    ElMessage.error(error.message || '登录失败')
  } finally {
    loading.value = false
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

/* 返回按钮 */
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

/* 登录卡片 */
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

.login-btn {
  width: 100%;
  background: linear-gradient(135deg, #2563EB 0%, #1E40AF 100%);
  border: none;
  font-weight: 500;
  letter-spacing: 2px;
  height: 44px;
  margin-top: 4px;
  transition: all 0.2s;
}

.login-btn:hover:not(.is-loading) {
  transform: translateY(-1px);
  box-shadow: 0 8px 20px rgba(30, 64, 175, 0.3);
}

/* 演示提示 */
.login-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 20px;
}

/* 快捷账号 */
.quick-accounts {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px dashed var(--border);
  font-size: 12px;
}

.quick-label {
  color: var(--text-muted);
}

.quick-account {
  padding: 2px 10px;
  background: rgba(219, 234, 254, 0.5);
  color: var(--primary);
  border-radius: 12px;
  cursor: pointer;
  font-family: ui-monospace, monospace;
  transition: all 0.15s;
}

.quick-account:hover {
  background: rgba(219, 234, 254, 0.9);
  transform: translateY(-1px);
}

/* Element Plus 输入框样式微调 */
:deep(.el-input__wrapper) {
  border-radius: 8px;
  box-shadow: 0 0 0 1px var(--border) inset;
  transition: all 0.15s;
}

:deep(.el-input__wrapper:hover) {
  box-shadow: 0 0 0 1px #93B4F5 inset;
}

:deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1px var(--primary) inset;
}
</style>