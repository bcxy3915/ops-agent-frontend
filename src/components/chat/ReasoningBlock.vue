<template>
    <div class="reasoning">
        <div class="reasoning-label">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"
                stroke-linecap="round">
                <circle cx="12" cy="12" r="3" />
            </svg>
            Reasoning
        </div>
        {{ text }}
    </div>
</template>

<script setup>
defineProps({
    text: { type: String, default: '' }
})
</script>

<style scoped>
.reasoning {
    background: linear-gradient(135deg, #FAF8FF 0%, #F5F3FF 100%);
    border: 1px solid #EDE9FE;
    border-left: 3px solid #A78BFA;
    border-radius: 6px;
    padding: 10px 14px;
    margin-bottom: 10px;
    font-size: 13px;
    color: #6D5BA5;
    line-height: 1.65;
    box-shadow: 0 1px 3px rgba(139, 92, 246, 0.05);
}

.reasoning-label {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 11px;
    font-weight: 600;
    color: #7C3AED;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 6px;
}
</style>