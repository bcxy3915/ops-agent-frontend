<template>
  <div class="auth-form">
    <div v-if="error" class="auth-error">{{ error }}</div>

    <el-form ref="formRef" :model="form" :rules="rules" @keydown.enter.prevent="handleLogin">
      <el-form-item prop="username">
        <el-input v-model="form.username" placeholder="企业邮箱 / 用户名" size="large" :prefix-icon="Message" clearable />
      </el-form-item>

      <el-form-item prop="password">
        <el-input v-model="form.password" type="password" placeholder="密码" size="large" show-password
          :prefix-icon="Lock" />
      </el-form-item>

      <el-button type="primary" size="large" :loading="loading" class="login-btn" @click="handleLogin">
        {{ loading ? '登录中...' : '登 录' }}
      </el-button>
    </el-form>

    <div class="third-party">
      <button class="third-btn" type="button" title="后续接入微信登录" disabled>微信登录</button>
      <button class="third-btn" type="button" title="后续接入企业 OIDC" disabled>企业 OIDC</button>
      <button class="third-btn" type="button" title="后续接入 SSO" disabled>SSO</button>
    </div>

    <div class="tenant-hint">登录后自动进入所属企业空间；跨企业数据不可见</div>

    <div class="auth-hint">
      <el-icon><InfoFilled /></el-icon>
      演示账号：zhangwei@xinghai.com / ops123456
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import { Message, Lock, InfoFilled } from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'

const emit = defineEmits(['success'])

const authStore = useAuthStore()
const formRef = ref(null)
const loading = ref(false)
const error = ref('')

const form = reactive({
  username: 'zhangwei@xinghai.com',
  password: 'ops123456'
})

const rules = {
  username: [{ required: true, message: '请输入企业邮箱或用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
}

async function handleLogin() {
  if (!formRef.value) return

  try {
    await formRef.value.validate()
  } catch {
    return
  }

  error.value = ''
  loading.value = true
  try {
    await authStore.login(form.username.trim(), form.password)
    ElMessage.success('登录成功')
    emit('success')
  } catch (e) {
    error.value = e.message || '邮箱或密码错误，请重试'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.auth-error {
  display: none;
  margin-bottom: 14px;
  padding: 8px 12px;
  border-radius: 8px;
  background: var(--danger-bg);
  color: var(--danger);
  font-size: 12.5px;
}
.auth-error:not(:empty) {
  display: block;
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
.third-party {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px dashed var(--border);
}
.third-btn {
  flex: 1;
  padding: 7px 0;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: #fff;
  color: var(--text-muted);
  font-size: 12px;
  cursor: not-allowed;
  opacity: 0.65;
}
.tenant-hint {
  margin-top: 14px;
  text-align: center;
  font-size: 12px;
  color: var(--text-muted);
}
.auth-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 12px;
}
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
