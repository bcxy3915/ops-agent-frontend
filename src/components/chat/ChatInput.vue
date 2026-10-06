<template>
    <div class="input-area">
        <div class="input-inner">
            <div class="input-box">
                <textarea ref="textareaRef" v-model="text" class="input-textarea" placeholder="输入问题，例如：todo-service 健康吗"
                    rows="1" @input="autoResize" @keydown.enter.exact.prevent="handleSend"></textarea>

                <button v-if="!sending" class="send-btn" :disabled="!text.trim()" @click="handleSend">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
                        stroke-linecap="round" stroke-linejoin="round">
                        <line x1="12" y1="19" x2="12" y2="5" />
                        <polyline points="5 12 12 5 19 12" />
                    </svg>
                </button>

                <button v-else class="send-btn stop" @click="$emit('stop')">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <rect x="6" y="6" width="12" height="12" rx="2" />
                    </svg>
                </button>
            </div>
            <div class="input-hint">内容由 AI 生成，请仔细甄别 · 支持多轮对话与工具调用</div>
        </div>
    </div>
</template>

<script setup>
import { ref, nextTick } from 'vue'

const props = defineProps({
    sending: { type: Boolean, default: false }
})

const emit = defineEmits(['send', 'stop'])

const text = ref('')
const textareaRef = ref(null)

function autoResize() {
    const el = textareaRef.value
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 160) + 'px'
}

function handleSend() {
    const value = text.value.trim()
    if (!value || props.sending) return

    emit('send', value)
    // 不清空 text，让父组件决定清不清
}

// 暴露 clear 方法给父组件调用
defineExpose({
    clear() {
        text.value = ''
        nextTick(() => {
            if (textareaRef.value) {
                textareaRef.value.style.height = 'auto'
            }
        })
    }
})
</script>

<style scoped>
.input-area {
    background: rgba(255, 255, 255, 0.72);
    backdrop-filter: blur(24px) saturate(180%);
    -webkit-backdrop-filter: blur(24px) saturate(180%);
    border-top: 1px solid rgba(226, 232, 240, 0.6);
    padding: 16px 0 20px;
    flex-shrink: 0;
}

.input-inner {
    max-width: 820px;
    margin: 0 auto;
    padding: 0 24px;
}

.input-box {
    display: flex;
    align-items: flex-end;
    gap: 10px;
    background: linear-gradient(180deg, #FFFFFF 0%, #FAFCFF 100%);
    border: 1.5px solid var(--border);
    border-radius: 14px;
    padding: 10px 12px 10px 18px;
    transition: all 0.2s;
    box-shadow: 0 2px 8px rgba(30, 64, 175, 0.04);
}

.input-box:focus-within {
    border-color: #93B4F5;
    box-shadow: 0 0 0 4px rgba(30, 64, 175, 0.08), 0 4px 16px rgba(30, 64, 175, 0.08);
}

.input-textarea {
    flex: 1;
    border: none;
    outline: none;
    background: transparent;
    font-size: 14px;
    line-height: 1.5;
    resize: none;
    color: var(--text-primary);
    font-family: inherit;
    max-height: 160px;
    min-height: 24px;
    padding: 4px 0;
}

.input-textarea::placeholder {
    color: var(--text-muted);
}

.send-btn {
    width: 34px;
    height: 34px;
    border-radius: 50%;
    background: linear-gradient(135deg, #2563EB 0%, #1E40AF 100%);
    color: white;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: all 0.2s;
    box-shadow: 0 2px 8px rgba(30, 64, 175, 0.2);
}

.send-btn:hover:not(:disabled) {
    transform: scale(1.05);
    box-shadow: 0 4px 14px rgba(30, 64, 175, 0.35);
}

.send-btn:disabled {
    background: #CBD5E1;
    cursor: not-allowed;
    opacity: 0.6;
    box-shadow: none;
}

.send-btn.stop {
    background: #DC2626;
    box-shadow: 0 2px 8px rgba(220, 38, 38, 0.2);
}

.send-btn.stop:hover {
    background: #B91C1C;
}

.input-hint {
    text-align: center;
    font-size: 11.5px;
    color: var(--text-muted);
    margin-top: 8px;
}
</style>