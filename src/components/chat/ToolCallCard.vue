<template>
    <div class="tool-call" :class="{ collapsed }">
        <div class="tool-head" @click="collapsed = !collapsed">
            <div class="tool-icon" :class="tool.type">
                <span v-if="tool.type === 'health'">♥</span>
                <span v-else-if="tool.type === 'metric'">📊</span>
                <span v-else>🔧</span>
            </div>
            <span class="tool-name">{{ tool.name }}</span>
            <span class="tool-status">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"
                    stroke-linecap="round">
                    <polyline points="20 6 9 17 4 12" />
                </svg>
                完成
            </span>
            <span class="tool-duration">{{ (tool.duration / 1000).toFixed(2) }}s</span>
            <span class="tool-arrow">▼</span>
        </div>
        <div class="tool-body">
            <div v-for="(val, key) in tool.params" :key="key" class="tool-param">
                <span class="tool-param-key">{{ key }}:</span>
                <span class="tool-param-val">"{{ val }}"</span>
            </div>
            <div class="tool-result">
                <span v-if="tool.type === 'health'" class="status-badge up">UP</span>
                {{ tool.result }}
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref } from 'vue'

defineProps({
    tool: { type: Object, required: true }
})

const collapsed = ref(false)
</script>

<style scoped>
.tool-call {
    background: linear-gradient(180deg, #FFFFFF 0%, #FDFEFF 100%);
    border: 1px solid var(--border);
    border-radius: 8px;
    margin-bottom: 8px;
    overflow: hidden;
    transition: all 0.2s;
    box-shadow: var(--card-shadow);
}

.tool-call:hover {
    box-shadow: var(--card-shadow-hover);
    border-color: #D8DFE9;
}

.tool-head {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    cursor: pointer;
    user-select: none;
}

.tool-icon {
    width: 24px;
    height: 24px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    flex-shrink: 0;
}

.tool-icon.health {
    background: linear-gradient(135deg, #D1FAE5, #A7F3D0);
    color: #047857;
}

.tool-icon.metric {
    background: linear-gradient(135deg, #DBEAFE, #BFDBFE);
    color: #1E40AF;
}

.tool-icon.list {
    background: linear-gradient(135deg, #FEF3C7, #FDE68A);
    color: #B45309;
}

.tool-name {
    font-family: ui-monospace, monospace;
    font-size: 12.5px;
    font-weight: 600;
    color: var(--text-primary);
}

.tool-status {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    color: var(--success);
    margin-left: auto;
    font-weight: 500;
}

.tool-duration {
    font-size: 11px;
    color: var(--text-muted);
    font-family: ui-monospace, monospace;
    margin-left: 8px;
}

.tool-arrow {
    color: var(--text-muted);
    font-size: 10px;
    transition: transform 0.2s;
    margin-left: 6px;
}

.tool-call.collapsed .tool-arrow {
    transform: rotate(-90deg);
}

.tool-body {
    padding: 0 14px 12px;
    border-top: 1px solid var(--border-light);
    font-size: 12.5px;
    color: var(--text-secondary);
}

.tool-call.collapsed .tool-body {
    display: none;
}

.tool-param {
    display: flex;
    gap: 8px;
    padding: 8px 0 4px;
    font-size: 12px;
}

.tool-param-key {
    color: var(--text-muted);
    font-family: ui-monospace, monospace;
    flex-shrink: 0;
}

.tool-param-val {
    color: var(--text-primary);
    font-family: ui-monospace, monospace;
    word-break: break-all;
}

.tool-result {
    margin-top: 6px;
    padding: 8px 10px;
    background: rgba(241, 245, 249, 0.7);
    border-radius: 6px;
    font-family: ui-monospace, monospace;
    font-size: 12px;
    color: var(--text-primary);
    line-height: 1.5;
    word-break: break-all;
}

.status-badge {
    display: inline-flex;
    align-items: center;
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 11px;
    font-weight: 600;
    font-family: ui-monospace, monospace;
    margin-right: 6px;
}

.status-badge.up {
    background: var(--success-bg);
    color: var(--success);
}
</style>