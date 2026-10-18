<template>
  <div class="kb-retrieval">
    <!-- 检索输入 -->
    <div class="kb-ret-bar">
      <el-input
        v-model="query"
        placeholder="输入问题，例如：todo-service 响应慢，怀疑频繁 Full GC"
        size="large"
        clearable
        @keyup.enter="run"
      >
        <template #prefix><el-icon><Search /></el-icon></template>
      </el-input>
      <el-button type="primary" size="large" :icon="VideoPlay" :loading="loading" @click="run">运行检索</el-button>
    </div>

    <!-- 空态 -->
    <div v-if="!hasResult" class="kb-empty" style="padding: 80px 0">
      <el-icon style="font-size: 40px; color: var(--text-muted)"><Search /></el-icon>
      <div style="margin-top: 12px">输入问题点击「运行检索」，查看分层召回、相关度与模拟回答引用</div>
    </div>

    <!-- 结果 -->
    <div v-else class="kb-ret-cols">
      <!-- 召回结果 -->
      <div class="kb-card">
        <div class="kb-card-hd">
          <div class="kb-card-title">召回结果（混合检索 + Rerank）</div>
          <span class="kb-tag kb-tag-info">Top {{ result.hits?.length || 0 }}</span>
        </div>
        <div class="kb-card-bd" style="padding-top: 12px">
          <div v-if="result.hits && result.hits.length">
            <div v-for="(hit, i) in result.hits" :key="hit.chunkId || i" class="kb-hit">
              <div class="kb-hit-t">
                <span class="kb-tag" :class="layerCls(hit.layer)">{{ layerLabel(hit.layer) }}</span>
                {{ hit.title }}
                <span v-if="hit.trustStatus" class="kb-tag" :class="statusCls(hit.trustStatus)">{{ statusLabel(hit.trustStatus) }}</span>
              </div>
              <!-- 后端 snippet 已带 <mark> 高亮，仅信任后端内容渲染 -->
              <div class="kb-hit-snippet" v-html="hit.snippet || ''"></div>
              <div class="kb-hit-meta">
                <span>
                  <template v-if="hit.version">v{{ hit.version }}</template><template v-if="hit.section"> · {{ hit.section }}</template>
                  <template v-if="hit.source"> · {{ hit.source }}</template>
                </span>
                <span>相关度 {{ hit.score != null ? hit.score.toFixed(2) : '-' }}</span>
              </div>
            </div>
          </div>
          <div v-else class="kb-empty" style="padding: 30px 0">未召回相关知识，建议补充知识库后重试</div>
        </div>
      </div>

      <!-- 模拟诊断回答 -->
      <div class="kb-card">
        <div class="kb-card-hd">
          <div class="kb-card-title">模拟诊断回答</div>
          <span class="kb-tag kb-tag-success">全部可溯源</span>
        </div>
        <div class="kb-card-bd">
          <div v-if="result.hits && result.hits.length" class="kb-ans-box">
            <div>
              已基于本次召回的 {{ result.hits.length }} 条知识生成回答骨架，每条结论均可溯源到对应知识条目
              <span class="kb-ref-mark">[{{ refIndexText(result.hits) }}]</span>。
            </div>
            <div style="margin-top: 12px; padding-top: 10px; border-top: 1px dashed var(--border); font-size: 12px; color: var(--text-muted)">
              <div v-for="(hit, i) in result.hits" :key="i">
                引用：[{{ i + 1 }}] {{ hit.title }}<template v-if="hit.layer">（{{ layerLabel(hit.layer) }}）</template><template v-if="hit.score"> · 相关度 {{ hit.score.toFixed(2) }}</template>
              </div>
            </div>
            <div style="margin-top: 10px; font-size: 12px; color: var(--text-muted)">
              说明：完整诊断回答由 LLM 在对话诊断中生成；此处展示检索召回与引用结构，用于验证知识命中效果。
            </div>
          </div>
          <div v-else class="kb-empty" style="padding: 30px 0">未召回知识，无法生成回答</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Search, VideoPlay } from '@element-plus/icons-vue'
import { testKnowledgeRetrieval } from '@/api/knowledge'
import { LAYER_MAP, STATUS_MAP } from './kb-utils'

const query = ref('')
const loading = ref(false)
const hasResult = ref(false)
const result = ref(null)

async function run() {
  const q = query.value.trim()
  if (!q) {
    ElMessage.warning('请输入检索问题')
    return
  }
  loading.value = true
  try {
    const res = await testKnowledgeRetrieval({ query: q, topK: 5 })
    result.value = res
    hasResult.value = true
  } catch (e) {
    ElMessage.error(e.message || '检索失败')
  } finally {
    loading.value = false
  }
}

function layerLabel(v) { return LAYER_MAP[v]?.label || v || '知识' }
function layerCls(v) { return LAYER_MAP[v]?.cls || 'kb-tag-info' }
function statusLabel(v) { return STATUS_MAP[v]?.label || v || '-' }
function statusCls(v) { return STATUS_MAP[v]?.cls || 'kb-tag-info' }
function refIndexText(hits) {
  return hits.map((_, i) => `[${i + 1}]`).join('')
}
</script>
