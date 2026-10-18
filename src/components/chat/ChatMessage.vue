<template>
    <!-- 用户消息 -->
    <div v-if="message.role === 'user'" class="msg-user">
        <div class="msg-user-bubble">{{ message.content }}</div>
    </div>

    <!-- 助手消息 -->
    <div v-else class="msg-assistant">
        <div class="msg-head">
            <div class="msg-avatar">AI</div>
            <span class="msg-role">Ops Agent</span>
            <span class="msg-time">{{ formatTime(message.id) }}</span>
        </div>

        <!-- 思考块 -->
        <ReasoningBlock v-if="message.reasoning" :text="message.reasoning" />

        <!-- 工具调用卡片 -->
        <ToolCallCard v-for="(tool, idx) in message.tools" :key="idx" :tool="tool" />

        <!-- 答案块 -->
        <div v-if="message.answer" class="answer" :class="{ 'answer-error': isError }" v-html="renderedAnswer" />
        <div v-else-if="message.streaming" class="answer streaming-placeholder">
            <span class="dot-loading">
                <span></span><span></span><span></span>
            </span>
        </div>

        <!-- 知识来源引用卡片（citations） -->
        <div v-if="citations.length" class="citations">
            <div class="citations-hd">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                知识来源（{{ citations.length }}）
            </div>
            <div class="citation" v-for="(c, i) in citations" :key="i">
                <span class="cit-idx">[{{ i + 1 }}]</span>
                <div class="cit-main">
                    <div class="cit-title">
                        <span class="cit-title-text">{{ c.title }}</span>
                        <span class="cit-tag" :class="layerTagClass(c.layer)">{{ layerLabel(c.layer) }}</span>
                        <span class="cit-tag" :class="statusTagClass(c.trustStatus)">{{ statusLabel(c.trustStatus) }}</span>
                    </div>
                    <div class="cit-snippet" v-html="c.snippet || ''" />
                    <div class="cit-meta">
                        <template v-if="c.version">v{{ c.version }} · </template>
                        <template v-if="c.score != null">相关度 {{ scoreText(c.score) }} · </template>
                        <span>{{ c.source || '知识库' }}</span>
                        <template v-if="c.section"> · {{ c.section }}</template>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { computed } from 'vue'
import MarkdownIt from 'markdown-it'
import ReasoningBlock from './ReasoningBlock.vue'
import ToolCallCard from './ToolCallCard.vue'
import { LAYER_MAP, STATUS_MAP } from '@/views/knowledge/kb-utils'

const props = defineProps({
    message: { type: Object, required: true }
})

const isError = computed(() => {
    return props.message.answer && props.message.answer.includes('⚠️')
})

// 知识引用（后端首个 SSE 事件推送，消息对象可能为空数组）
const citations = computed(() => props.message.citations || [])

// 层级/状态文案与样式映射（复用知识库枚举）
function layerLabel(key) {
    return LAYER_MAP[key]?.label || '知识'
}
function layerTagClass(key) {
    return LAYER_MAP[key] ? `cit-tag-${LAYER_MAP[key].cls.replace('kb-tag-', '')}` : 'cit-tag-info'
}
function statusLabel(key) {
    return STATUS_MAP[key]?.label || '—'
}
function statusTagClass(key) {
    return STATUS_MAP[key] ? `cit-tag-${STATUS_MAP[key].cls.replace('kb-tag-', '')}` : 'cit-tag-info'
}

function scoreText(score) {
    const n = Number(score)
    if (Number.isNaN(n)) return '-'
    return n.toFixed(2)
}

// Markdown 渲染器
const md = new MarkdownIt({
    html: false,
    linkify: true,
    breaks: true
})

const renderedAnswer = computed(() => {
    if (!props.message.answer) return ''
    try {
        // ★ 尝试渲染 Markdown
        return md.render(props.message.answer)
    } catch (e) {
        // ★ 如果渲染不完整导致报错，降级为纯文本换行，防止白屏
        console.error("Markdown render error:", e)
        return props.message.answer.replace(/\n/g, '<br/>')
    }
})

function formatTime(id) {
    if (!id) return '';
    // 兼容历史消息 id (m-xxxx) 和实时消息 id (u-xxxx)
    const parts = id.split('-');
    if (parts.length < 2) return '';

    const ts = parseInt(parts[1]);
    // ★ 关键：如果 ts 不是数字（NaN），直接返回空，防止 new Date(NaN) 导致渲染崩溃
    if (isNaN(ts) || ts < 1000000000000) return '';

    const d = new Date(ts);
    return d.toTimeString().slice(0, 8);
}
</script>

<style scoped>
/* 用户消息 */
.msg-user {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 24px;
}

.msg-user-bubble {
    background: linear-gradient(135deg, #2563EB 0%, #1E40AF 100%);
    color: white;
    padding: 10px 16px;
    border-radius: 16px 16px 4px 16px;
    max-width: 70%;
    font-size: 14px;
    line-height: 1.5;
    box-shadow: 0 4px 16px rgba(30, 64, 175, 0.2);
    word-break: break-word;
}

/* 助手消息 */
.msg-assistant {
    margin-bottom: 28px;
}

.msg-head {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
}

.msg-avatar {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background: linear-gradient(135deg, #3B82F6 0%, #1E40AF 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 12px;
    flex-shrink: 0;
    box-shadow: 0 2px 6px rgba(30, 64, 175, 0.2);
}

.msg-role {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
}

.msg-time {
    font-size: 11px;
    color: var(--text-muted);
    margin-left: auto;
    font-family: ui-monospace, monospace;
}

/* 答案块 */
.answer {
    background: linear-gradient(180deg, #FFFFFF 0%, #FDFEFF 100%);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 16px 18px;
    font-size: 14px;
    line-height: 1.75;
    color: var(--text-primary);
    box-shadow: var(--card-shadow);
}

.streaming-placeholder {
    min-height: 40px;
    display: flex;
    align-items: center;
}

/* Markdown 内容样式 */
.answer :deep(p) {
    margin-bottom: 10px;
}

.answer :deep(p:last-child) {
    margin-bottom: 0;
}

.answer :deep(h1),
.answer :deep(h2),
.answer :deep(h3),
.answer :deep(h4) {
    font-size: 14.5px;
    margin: 14px 0 8px;
    color: var(--text-primary);
}

.answer :deep(ul),
.answer :deep(ol) {
    padding-left: 22px;
    margin: 6px 0;
}

.answer :deep(li) {
    margin-bottom: 3px;
}

.answer :deep(code) {
    background: rgba(219, 234, 254, 0.5);
    padding: 1px 6px;
    border-radius: 4px;
    font-family: ui-monospace, monospace;
    font-size: 12.5px;
    color: var(--primary);
}

.answer :deep(pre) {
    background: #F8FAFC;
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 12px;
    margin: 10px 0;
    overflow-x: auto;
}

.answer :deep(pre code) {
    background: none;
    padding: 0;
    color: var(--text-primary);
    font-size: 12.5px;
}

.answer :deep(table) {
    width: 100%;
    border-collapse: collapse;
    margin: 10px 0;
    font-size: 13px;
}

.answer :deep(th),
.answer :deep(td) {
    padding: 8px 12px;
    border: 1px solid var(--border);
    text-align: left;
}

.answer :deep(th) {
    background: #F8FAFC;
    font-weight: 600;
}

.answer :deep(blockquote) {
    border-left: 3px solid #A78BFA;
    background: rgba(245, 243, 255, 0.5);
    padding: 8px 14px;
    margin: 10px 0;
    color: #6D5BA5;
    border-radius: 4px;
    font-size: 13px;
}

.answer :deep(strong) {
    font-weight: 600;
    color: var(--text-primary);
}

/* 打字机光标 */
.answer :deep(.typing-cursor)::after {
    content: '▊';
    color: var(--primary);
    animation: blink 1s infinite;
}

/* ★ 错误样式 */
.answer-error {
    border-color: #FECACA;
    background: linear-gradient(180deg, #FFF5F5 0%, #FFFFFF 100%);
}

.answer-error :deep(blockquote) {
    border-left-color: #F87171;
    background: rgba(254, 226, 226, 0.6);
    color: #B91C1C;
}

/* ============================================================
   知识来源引用卡片（citations）
   ============================================================ */
.citations {
    margin-top: 12px;
    background: linear-gradient(180deg, #F8FAFC 0%, #FDFEFF 100%);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 12px 14px;
}

.citations-hd {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12.5px;
    font-weight: 600;
    color: var(--text-secondary);
    margin-bottom: 4px;
}

.citations-hd svg {
    color: var(--primary);
}

.citation {
    display: flex;
    gap: 10px;
    padding: 10px 2px;
    border-top: 1px dashed var(--border-light);
}

.citation:first-of-type {
    border-top: none;
    padding-top: 4px;
}

.cit-idx {
    font-size: 12px;
    font-weight: 700;
    color: var(--primary);
    font-family: ui-monospace, monospace;
    flex-shrink: 0;
    padding-top: 1px;
}

.cit-main {
    flex: 1;
    min-width: 0;
}

.cit-title {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
}

.cit-title-text {
    word-break: break-word;
}

/* 层级/状态小标签（视觉对齐知识库 kb-tag） */
.cit-tag {
    display: inline-flex;
    align-items: center;
    height: 20px;
    padding: 0 8px;
    border-radius: 6px;
    font-size: 11.5px;
    font-weight: 500;
    flex-shrink: 0;
}

.cit-tag-primary {
    background: #EFF6FF;
    color: var(--primary);
}

.cit-tag-teal {
    background: #F0FDFA;
    color: #0D9488;
}

.cit-tag-warning {
    background: #FFFBEB;
    color: var(--warning);
}

.cit-tag-success {
    background: #ECFDF5;
    color: var(--success);
}

.cit-tag-info {
    background: #F1F5F9;
    color: var(--text-secondary);
}

.cit-tag-danger {
    background: #FEF2F2;
    color: var(--danger);
}

.cit-snippet {
    font-size: 12.5px;
    color: var(--text-secondary);
    margin-top: 4px;
    line-height: 1.6;
    word-break: break-word;
}

/* snippet 中的命中词高亮（后端已用 <mark> 标记） */
.cit-snippet :deep(mark) {
    background: #FEF3C7;
    color: inherit;
    border-radius: 2px;
    padding: 0 2px;
}

.cit-meta {
    font-size: 11.5px;
    color: var(--text-muted);
    margin-top: 4px;
}

@keyframes blink {

    0%,
    50% {
        opacity: 1;
    }

    51%,
    100% {
        opacity: 0;
    }
}

/* 等待点 */
.dot-loading {
    display: inline-flex;
    gap: 4px;
}

.dot-loading span {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--primary);
    animation: dotPulse 1.4s infinite ease-in-out both;
}

.dot-loading span:nth-child(1) {
    animation-delay: -0.32s;
}

.dot-loading span:nth-child(2) {
    animation-delay: -0.16s;
}

@keyframes dotPulse {

    0%,
    80%,
    100% {
        transform: scale(0.6);
        opacity: 0.5;
    }

    40% {
        transform: scale(1);
        opacity: 1;
    }
}
</style>
