<template>
  <el-dialog :model-value="modelValue" class="document-detail-dialog" width="min(1440px, 96vw)" top="var(--document-detail-gap)"
    destroy-on-close :show-close="true" @update:model-value="emit('update:modelValue', $event)">
    <template #header>
      <div class="detail-heading">
        <div class="detail-eyebrow">知识库 / 知识文档 / 文档详情</div>
        <h2>{{ document?.title || '文档详情' }}</h2>
        <div class="detail-subtitle">{{ DOCTYPE_MAP[document?.docType] || document?.docType || '文本' }} · v{{ document?.version ?? '-' }} · 更新于 {{ formatDate(document?.updatedAt || document?.createdAt) }}</div>
      </div>
    </template>
    <template v-if="document">
      <div v-if="document.publishStatus === 'FAILED'" class="detail-error">
        <el-alert type="error" :closable="false" show-icon :title="`入库失败：${document.publishError || '未知原因'}`" />
        <el-button v-if="canRetry && document.layer !== 'BUILTIN'" size="small" type="primary" plain @click="emit('retry', document)">重试入库</el-button>
      </div>
      <div class="detail-columns" :class="{ 'without-chunks': !showChunks }">
        <aside class="detail-info" aria-label="基本信息">
          <h3>基本信息</h3>
          <dl>
            <dt>知识层级</dt><dd><span class="kb-tag" :class="LAYER_MAP[document.layer]?.cls">{{ LAYER_MAP[document.layer]?.label || document.layer || '-' }}</span></dd>
            <dt>可信状态</dt><dd><span class="kb-tag" :class="STATUS_MAP[document.trustStatus]?.cls">{{ STATUS_MAP[document.trustStatus]?.label || document.trustStatus || '-' }}</span></dd>
            <dt>索引状态</dt><dd><span class="kb-tag" :class="publishCls(document.publishStatus)">{{ publishLabel(document.publishStatus) }}</span></dd>
            <dt>文档负责人</dt><dd>{{ document.owner || '官方' }}</dd>
            <dt>适用服务</dt><dd>{{ document.serviceIds?.join(' / ') || '通用' }}</dd>
            <dt>标签</dt><dd class="detail-tags"><span v-for="tag in document.tags" :key="tag">{{ tag }}</span><span v-if="!document.tags?.length">暂无标签</span></dd>
          </dl>
          <div class="detail-stats"><div><b>{{ fmtNumber(document.hitCount) }}</b><small>检索命中</small></div><div><b>{{ fmtNumber(document.chunkCount ?? chunks.length) }}</b><small>文档分块</small></div></div>
          <dl><dt>创建时间</dt><dd>{{ formatDate(document.createdAt) }}</dd><dt>更新时间</dt><dd>{{ formatDate(document.updatedAt) }}</dd><dt>入库时间</dt><dd>{{ formatDate(document.publishedAt) }}</dd></dl>
        </aside>
        <main class="detail-original">
          <div class="detail-toolbar">
            <strong>文档原文</strong>
            <div class="detail-actions">
              <div v-if="isMarkdown" class="detail-mode" role="group" aria-label="正文显示方式">
                <button :class="{ active: mode === 'preview' }" :aria-pressed="mode === 'preview'" @click="mode = 'preview'">预览</button>
                <button :class="{ active: mode === 'source' }" :aria-pressed="mode === 'source'" @click="mode = 'source'">源码</button>
              </div>
              <button class="detail-toggle" :aria-expanded="showChunks" @click="showChunks = !showChunks">{{ showChunks ? '隐藏分块' : '显示分块' }}</button>
            </div>
          </div>
          <div ref="reader" class="detail-reader">
            <div v-if="!document.rawContent" class="detail-empty">暂无正文内容</div>
            <article v-else-if="isMarkdown && mode === 'preview'" ref="preview" class="detail-markdown" v-html="renderedContent"></article>
            <pre v-else class="detail-source"><template v-if="activeRange">{{ sourceParts.before }}<mark ref="sourceMark" class="detail-source-highlight">{{ sourceParts.match }}</mark>{{ sourceParts.after }}</template><template v-else>{{ document.rawContent }}</template></pre>
          </div>
          <div class="detail-caption" role="status">{{ locationMessage || (isMarkdown ? (mode === 'source' ? 'Markdown 源码 · 点击预览查看排版' : 'Markdown 预览 · 正文与分块独立滚动') : '已保存正文 · 正文与分块独立滚动') }}</div>
        </main>
        <aside v-if="showChunks" class="detail-chunks" aria-label="文档分块">
          <div class="detail-toolbar"><strong>文档分块</strong><span class="detail-count">{{ chunks.length }} 个</span></div>
          <div class="detail-chunk-list">
            <p class="detail-chunk-hint">按文档顺序展示，展开查看完整分块</p>
            <div v-if="!chunks.length" class="detail-empty">暂无分块</div>
            <details v-for="(chunk, index) in chunks" :key="chunk.id ?? index" :open="index === 0" class="detail-chunk">
              <summary>
                <span class="chunk-order">{{ String(chunk.ordinal ?? index + 1).padStart(2, '0') }}</span>
                <span class="chunk-heading"><span class="chunk-title" :title="chunk.section || '正文分块'">{{ chunk.section || '正文分块' }}</span><small>{{ (chunk.content || '').length }} 字符</small></span>
              </summary>
              <pre>{{ chunk.content || '暂无内容' }}</pre>
              <button class="detail-locate" @click="locateChunk(chunk)">定位原文</button>
            </details>
          </div>
        </aside>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import MarkdownIt from 'markdown-it'
import { findChunkRanges, installSourceMapping } from './document-source'
import { DOCTYPE_MAP, LAYER_MAP, STATUS_MAP, formatDate, fmtNumber, publishCls, publishLabel } from './kb-utils'

const props = defineProps({ modelValue: Boolean, document: { type: Object, default: null }, canRetry: Boolean })
const emit = defineEmits(['update:modelValue', 'retry'])
const markdown = new MarkdownIt({ html: false, linkify: true, breaks: false })
installSourceMapping(markdown)
const mode = ref('preview')
const showChunks = ref(true)
const locationMessage = ref('')
const preview = ref(null)
const reader = ref(null)
const sourceMark = ref(null)
const activeChunkIndex = ref(-1)
const isMarkdown = computed(() => props.document?.docType === 'MARKDOWN')
const renderedContent = computed(() => {
  const source = props.document?.rawContent || ''
  return markdown.render(source, { detailSource: source })
})
const chunks = computed(() => [...(props.document?.chunks || [])].sort((a, b) => (a.ordinal ?? 0) - (b.ordinal ?? 0)))

const chunkRanges = computed(() => findChunkRanges(props.document?.rawContent || '', chunks.value))
const activeRange = computed(() => chunkRanges.value[activeChunkIndex.value] || null)
const sourceParts = computed(() => {
  const source = props.document?.rawContent || ''
  const range = activeRange.value
  return range ? { before: source.slice(0, range.start), match: source.slice(range.start, range.end), after: source.slice(range.end) } : {}
})

watch([() => props.document?.id, () => props.modelValue], () => {
  mode.value = 'preview'
  showChunks.value = true
  locationMessage.value = ''
  activeChunkIndex.value = -1
})

watch(mode, async () => {
  await nextTick()
  highlightLocation()
})

/**
 * 高亮已匹配范围，并只滚动中间原文区域；不移动分块栏或整个弹窗。
 * @returns {void} 无入参，无返回数据。
 */
function highlightLocation() {
  preview.value?.querySelectorAll('.detail-highlight').forEach(node => node.classList.remove('detail-highlight'))
  const range = activeRange.value
  if (!range) return
  let target = sourceMark.value
  if (isMarkdown.value && mode.value === 'preview') {
    const blocks = Array.from(preview.value?.querySelectorAll('[data-source-start][data-source-end]') || [])
    const matched = blocks.filter(node => Number(node.dataset.sourceStart) < range.end && Number(node.dataset.sourceEnd) > range.start)
    matched.forEach(node => node.classList.add('detail-highlight'))
    target = matched[0]
  }
  const container = reader.value
  if (target && container) {
    const top = container.scrollTop + target.getBoundingClientRect().top - container.getBoundingClientRect().top - 20
    container.scrollTo?.({ top: Math.max(0, top), behavior: 'smooth' })
  }
}

/**
 * 匹配完整分块的源码范围，并在当前预览或源码模式定位。
 * @param {Object} chunk 待定位的文档分块。
 * @returns {Promise<void>} 完成滚动高亮并更新匹配结果，无返回数据。
 */
async function locateChunk(chunk) {
  activeChunkIndex.value = chunks.value.indexOf(chunk)
  await nextTick()
  highlightLocation()
  locationMessage.value = activeRange.value
    ? `已定位原文 · 分块 ${chunk.ordinal ?? ''}`
    : '未找到可准确定位的原文：分块内容与已保存正文不一致，请检查文档版本和分块数据'
}
</script>

<style scoped>
:global(.document-detail-dialog.el-dialog) {
  --document-detail-viewport: 100vh;
  --document-detail-gap: clamp(12px, 6vh, 96px);
  display: flex;
  flex-direction: column;
  height: calc(var(--document-detail-viewport) - 2 * var(--document-detail-gap));
  margin-bottom: var(--document-detail-gap);
  overflow: hidden;
}
:global(.document-detail-dialog > .el-dialog__header) {
  flex: 0 0 auto;
  max-height: 32%;
  overflow: auto;
}
:global(.document-detail-dialog > .el-dialog__body) {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
@supports (height: 100dvh) {
  :global(.document-detail-dialog.el-dialog) {
    --document-detail-viewport: 100dvh;
    --document-detail-gap: clamp(12px, 6dvh, 96px);
  }
}
.detail-heading { padding-right: 24px; }
.detail-toolbar, .detail-caption { flex-shrink: 0; }
.detail-source-highlight { background: var(--primary-light); color: inherit; border-radius: 3px; }
.detail-chunk summary { align-items: flex-start; }
.detail-chunk summary::before { flex: 0 0 8px; }
.detail-chunk .chunk-order { flex: 0 0 auto; min-width: 2.5ch; white-space: nowrap; overflow-wrap: normal; font-variant-numeric: tabular-nums; }
.chunk-heading { flex: 1; min-width: 0; }
.chunk-title { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; overflow-wrap: anywhere; }
.detail-heading h2 { margin: 5px 0; font-size: 21px; color: var(--text-primary); overflow-wrap: anywhere; }
.detail-eyebrow, .detail-subtitle { color: var(--text-secondary); font-size: 12px; }
.detail-error { padding-bottom: 12px; display: flex; align-items: center; gap: 12px; flex-shrink: 0; max-height: 35%; overflow: auto; }
.detail-columns { display: grid; grid-template-columns: 190px minmax(0, 1fr) 285px; flex: 1; min-height: 0; border: 1px solid var(--border); border-radius: var(--radius-lg); overflow: hidden; background: var(--card-bg); }
.detail-columns.without-chunks { grid-template-columns: 190px minmax(0, 1fr); }
.detail-info { padding: 20px 18px; overflow: auto; background: #f8fafd; border-right: 1px solid var(--border); }
h3, strong { font-size: 14px; color: var(--text-primary); }
dl { margin: 18px 0 0; } dt { color: var(--text-muted); font-size: 12px; margin-top: 14px; } dd { margin: 5px 0 0; font-size: 13px; overflow-wrap: anywhere; color: var(--text-primary); }
.detail-tags { display: flex; flex-wrap: wrap; gap: 5px; }.detail-tags span { background: var(--border-light); padding: 2px 6px; border-radius: 4px; font-size: 12px; }
.detail-stats { display: flex; gap: 20px; border-block: 1px solid var(--border); margin-top: 20px; padding: 16px 0; }.detail-stats b { display: block; font-size: 21px; color: var(--primary); }.detail-stats small { color: var(--text-secondary); font-size: 11px; }
.detail-original, .detail-chunks { display: flex; flex-direction: column; min-width: 0; min-height: 0; }.detail-chunks { border-left: 1px solid var(--border); background: #fafbfd; }
.detail-toolbar { min-height: 55px; padding: 10px 18px; display: flex; justify-content: space-between; align-items: center; gap: 8px; border-bottom: 1px solid var(--border-light); flex-wrap: wrap; }
.detail-actions { display: flex; gap: 8px; align-items: center; }button { font: inherit; cursor: pointer; }button:focus-visible, summary:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }.detail-mode { display: flex; padding: 3px; background: var(--border-light); border-radius: 6px; }.detail-mode button, .detail-toggle { border: 0; background: transparent; color: var(--text-secondary); border-radius: 4px; padding: 4px 9px; font-size: 12px; }.detail-mode button.active { background: white; color: var(--primary); box-shadow: var(--card-shadow); }.detail-toggle { color: var(--primary); }
.detail-reader { overflow: auto; padding: 26px 30px; flex: 1; min-height: 0; }.detail-source { white-space: pre-wrap; overflow-wrap: anywhere; font: 13px/1.9 ui-monospace, Consolas, monospace; margin: 0; color: var(--text-primary); }.detail-caption { padding: 9px 18px; border-top: 1px solid var(--border-light); color: var(--text-secondary); font-size: 11px; }
.detail-count { background: var(--primary-light); color: var(--primary); padding: 2px 8px; border-radius: 5px; font-size: 12px; }.detail-chunk-list { overflow: auto; padding: 14px; flex: 1; }.detail-chunk-hint { color: var(--text-muted); font-size: 11px; margin: 0 0 12px; }.detail-chunk { margin-bottom: 12px; border: 1px solid var(--border); border-radius: 8px; background: white; overflow: hidden; }.detail-chunk summary { display: flex; gap: 10px; padding: 13px; cursor: pointer; font-size: 12px; color: var(--text-primary); overflow-wrap: anywhere; }.detail-chunk summary::before { content: '›'; color: var(--text-muted); }.detail-chunk[open] summary::before { content: '⌄'; }.chunk-order { color: var(--primary); font-weight: 600; }.detail-chunk small { display: block; color: var(--text-muted); font-size: 11px; margin-top: 3px; }.detail-chunk pre { padding: 0 14px; margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; font-family: inherit; font-size: 12px; line-height: 1.9; color: var(--text-secondary); }.detail-locate { border: 0; background: var(--bg-hover); color: var(--primary); font-size: 12px; margin: 12px; padding: 5px 10px; border-radius: 4px; }.detail-empty { color: var(--text-muted); text-align: center; padding: 30px 10px; font-size: 13px; }
.detail-markdown { color: var(--text-primary); font-size: 14px; line-height: 1.9; overflow-wrap: anywhere; }.detail-markdown :deep(h1) { font-size: 25px; }.detail-markdown :deep(h2) { font-size: 19px; border-bottom: 1px solid var(--border-light); padding-bottom: 8px; }.detail-markdown :deep(h3) { font-size: 16px; }.detail-markdown :deep(h1), .detail-markdown :deep(h2), .detail-markdown :deep(h3), .detail-markdown :deep(h4) { margin: 24px 0 14px; }.detail-markdown :deep(> :first-child) { margin-top: 0; }.detail-markdown :deep(p), .detail-markdown :deep(ul), .detail-markdown :deep(ol) { margin: 12px 0; }.detail-markdown :deep(ul), .detail-markdown :deep(ol) { padding-left: 24px; }.detail-markdown :deep(blockquote) { margin: 16px 0; border-left: 3px solid var(--primary); background: #f5f8ff; padding: 5px 16px; color: var(--text-secondary); }.detail-markdown :deep(pre) { padding: 16px; background: #f6f8fc; border: 1px solid var(--border-light); border-radius: 8px; overflow-x: auto; white-space: pre; }.detail-markdown :deep(code) { font: 12px/1.8 ui-monospace, Consolas, monospace; background: #f1f5f9; padding: 2px 4px; border-radius: 3px; }.detail-markdown :deep(pre code) { padding: 0; background: transparent; }.detail-markdown :deep(table) { display: block; overflow-x: auto; border-collapse: collapse; margin: 16px 0; }.detail-markdown :deep(th), .detail-markdown :deep(td) { border: 1px solid var(--border); padding: 8px 12px; }.detail-markdown :deep(th) { background: #f8fafd; }.detail-markdown :deep(a) { color: var(--primary); }.detail-markdown :deep(img) { max-width: 100%; }.detail-markdown :deep(.detail-highlight) { background: var(--primary-light); outline: 2px solid var(--primary-light); border-radius: 4px; }
@media (max-width: 1100px) { .detail-columns { grid-template-columns: 165px minmax(0, 1fr) 235px; }.detail-reader { padding: 20px; } }
@media (max-width: 800px) { .detail-columns, .detail-columns.without-chunks { grid-template-columns: minmax(0, 1fr); overflow: auto; }.detail-info { min-height: 190px; max-height: 190px; border-right: 0; border-bottom: 1px solid var(--border); }.detail-info dl { display: flex; flex-wrap: wrap; gap: 6px 10px; align-items: center; }.detail-info dt { margin: 0; }.detail-info dd { margin: 0; }.detail-stats { margin-top: 12px; padding: 8px 0; }.detail-original { min-height: 450px; }.detail-chunks { min-height: 300px; border-left: 0; border-top: 1px solid var(--border); } }
</style>
