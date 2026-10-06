<template>
    <div class="metric-card" :class="statusClass">
        <div class="card-head">
            <span class="card-label">{{ label }}</span>
            <span v-if="statusBadge" class="card-status" :class="statusClass">
                {{ statusBadge }}
            </span>
        </div>

        <div class="card-value">
            <span class="value">{{ displayValue }}</span>
            <span class="unit">{{ unit }}</span>
        </div>

        <div class="card-bar">
            <div class="bar-track">
                <div class="bar-fill" :style="{ width: fillPercent + '%' }"></div>
            </div>
            <div class="bar-hint">
                <span>正常</span>
                <span v-if="threshold">{{ threshold }}</span>
            </div>
        </div>
    </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
    label: { type: String, required: true },
    value: { type: [Number, String], required: true },
    unit: { type: String, default: '' },
    // 阈值判定
    warnThreshold: { type: Number, default: null },
    dangerThreshold: { type: Number, default: null },
    // 进度条满格对应值
    maxValue: { type: Number, default: 100 },
    // 显示格式化
    formatter: { type: Function, default: null }
})

const displayValue = computed(() => {
    if (props.formatter) return props.formatter(props.value)
    if (typeof props.value === 'number') {
        // 保留 2 位小数
        return Number(props.value).toFixed(2)
    }
    return props.value
})

const fillPercent = computed(() => {
    const v = Number(props.value) || 0
    return Math.min(100, (v / props.maxValue) * 100)
})

const statusClass = computed(() => {
    const v = Number(props.value)
    if (props.dangerThreshold !== null && v >= props.dangerThreshold) return 'danger'
    if (props.warnThreshold !== null && v >= props.warnThreshold) return 'warn'
    return 'normal'
})

const statusBadge = computed(() => {
    if (statusClass.value === 'danger') return '严重'
    if (statusClass.value === 'warn') return '警告'
    return ''
})

const threshold = computed(() => {
    if (props.dangerThreshold !== null) return `> ${props.dangerThreshold} 告警`
    return ''
})
</script>

<style scoped>
.metric-card {
    background: linear-gradient(180deg, #FFFFFF 0%, #FDFEFF 100%);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 16px 18px;
    box-shadow: var(--card-shadow);
    transition: all 0.2s;
}

.metric-card:hover {
    box-shadow: var(--card-shadow-hover);
    transform: translateY(-1px);
}

.card-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
}

.card-label {
    font-size: 12.5px;
    color: var(--text-secondary);
    font-weight: 500;
}

.card-status {
    font-size: 11px;
    font-weight: 600;
    padding: 1px 8px;
    border-radius: 10px;
}

.card-status.normal {
    background: var(--success-bg);
    color: var(--success);
}

.card-status.warn {
    background: var(--warning-bg);
    color: var(--warning);
}

.card-status.danger {
    background: var(--danger-bg);
    color: var(--danger);
}

.card-value {
    display: flex;
    align-items: baseline;
    gap: 6px;
    margin-bottom: 12px;
}

.value {
    font-size: 26px;
    font-weight: 600;
    color: var(--text-primary);
    font-family: ui-monospace, monospace;
    line-height: 1;
}

.unit {
    font-size: 12px;
    color: var(--text-muted);
    font-weight: 400;
}

/* 进度条 */
.card-bar {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.bar-track {
    height: 4px;
    background: var(--border-light);
    border-radius: 2px;
    overflow: hidden;
}

.bar-fill {
    height: 100%;
    border-radius: 2px;
    transition: width 0.6s ease;
}

.metric-card.normal .bar-fill {
    background: linear-gradient(90deg, #34D399, #10B981);
}

.metric-card.warn .bar-fill {
    background: linear-gradient(90deg, #FBBF24, #F59E0B);
}

.metric-card.danger .bar-fill {
    background: linear-gradient(90deg, #F87171, #DC2626);
}

.bar-hint {
    display: flex;
    justify-content: space-between;
    font-size: 10.5px;
    color: var(--text-muted);
}
</style>