<template>
    <span class="status-badge" :class="`status-${status?.toLowerCase()}`">
        <span class="dot"></span>
        {{ status || 'UNKNOWN' }}
    </span>
</template>

<script setup>
defineProps({
    status: { type: String, default: 'UNKNOWN' }
})
</script>

<style scoped>
.status-badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 10px;
    border-radius: 12px;
    font-size: 11.5px;
    font-weight: 600;
    font-family: ui-monospace, monospace;
}

.dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: currentColor;
}

.status-up {
    background: var(--success-bg);
    color: var(--success);
}

.status-up .dot {
    box-shadow: 0 0 0 3px rgba(5, 150, 105, 0.15);
    animation: pulse 2s infinite;
}

.status-down {
    background: var(--danger-bg);
    color: var(--danger);
}

.status-unknown {
    background: var(--warning-bg);
    color: var(--warning);
}

@keyframes pulse {

    0%,
    100% {
        opacity: 1;
    }

    50% {
        opacity: 0.5;
    }
}
</style>