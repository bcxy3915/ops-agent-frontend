<template>
    <el-dialog v-model="visible" width="420px" :close-on-click-modal="true" :show-close="true" align-center
        class="login-dialog">
        <template #header>
            <div class="dialog-header">
                <div class="logo-icon">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
                        stroke-linecap="round" stroke-linejoin="round">
                        <path d="M12 2L2 7l10 5 10-5-10-5z" />
                        <path d="M2 17l10 5 10-5" />
                        <path d="M2 12l10 5 10-5" />
                    </svg>
                </div>
                <div class="header-text">
                    <h3>登录 Ops Agent</h3>
                    <p>登录后可继续对话并保存历史</p>
                </div>
            </div>
        </template>

        <div class="dialog-hint">
            <el-icon>
                <ChatDotRound />
            </el-icon>
            <span>登录成功后会自动发送你刚才输入的内容</span>
        </div>

        <LoginForm @success="handleSuccess" />
    </el-dialog>
</template>

<script setup>
import { computed } from 'vue'
import { ChatDotRound } from '@element-plus/icons-vue'
import LoginForm from './LoginForm.vue'

const props = defineProps({
    modelValue: { type: Boolean, default: false }
})

const emit = defineEmits(['update:modelValue', 'success'])

const visible = computed({
    get: () => props.modelValue,
    set: (val) => emit('update:modelValue', val)
})

function handleSuccess() {
    visible.value = false
    emit('success')
}
</script>

<style scoped>
.dialog-header {
    display: flex;
    align-items: center;
    gap: 12px;
}

.logo-icon {
    width: 40px;
    height: 40px;
    background: linear-gradient(135deg, #3B82F6 0%, #1E40AF 100%);
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    box-shadow: 0 4px 12px rgba(30, 64, 175, 0.25);
    flex-shrink: 0;
}

.header-text h3 {
    font-size: 15px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
}

.header-text p {
    font-size: 12px;
    color: var(--text-muted);
    margin: 2px 0 0;
}

.dialog-hint {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    background: rgba(219, 234, 254, 0.5);
    border-radius: 8px;
    font-size: 12.5px;
    color: var(--primary);
    margin-bottom: 18px;
}

:deep(.el-dialog__header) {
    padding: 20px 24px 12px;
    margin-right: 0;
}

:deep(.el-dialog__body) {
    padding: 0 24px 24px;
}
</style>