<template>
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

        <div class="quick-accounts">
            <span class="quick-label">快捷登录：</span>
            <span class="quick-account" @click="fillAccount('admin')">admin</span>
            <span class="quick-account" @click="fillAccount('operator')">operator</span>
            <span class="quick-account" @click="fillAccount('viewer')">viewer</span>
        </div>
    </el-form>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import { User, Lock } from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'

const emit = defineEmits(['success'])

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

function fillAccount(username) {
    form.username = username
    form.password = username + '123'
}

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
        emit('success')
    } catch (error) {
        ElMessage.error(error.message || '登录失败')
    } finally {
        loading.value = false
    }
}
</script>

<style scoped>
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