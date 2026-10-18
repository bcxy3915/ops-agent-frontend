<template>
  <div class="kb-overview">
    <!-- 统计卡 -->
    <div class="kb-stat-row">
      <div class="kb-card kb-stat">
        <div class="kb-stat-k"><el-icon><Collection /></el-icon>知识总量</div>
        <div class="kb-stat-v">{{ fmtNumber(stats.totalDocs) }}<span class="kb-u">篇</span></div>
        <div class="kb-stat-d">已沉淀案例 {{ fmtNumber(stats.confirmedCases) }} · 待确认 {{ fmtNumber(stats.pendingCases) }}</div>
      </div>
      <div class="kb-card kb-stat">
        <div class="kb-stat-k"><el-icon><Warning /></el-icon>待处理事项</div>
        <div class="kb-stat-v" :style="todoTotal > 0 ? { color: 'var(--warning)' } : {}">{{ fmtNumber(todoTotal) }}</div>
        <div class="kb-stat-d">待审核 {{ fmtNumber(stats.pendingDocs) }} · 待沉淀 {{ fmtNumber(stats.pendingCases) }} · 冲突 {{ fmtNumber(stats.pendingConflicts) }}</div>
      </div>
      <div class="kb-card kb-stat">
        <div class="kb-stat-k"><el-icon><DataAnalysis /></el-icon>本月命中 / 诊断引用</div>
        <div class="kb-stat-v">{{ fmtNumber(stats.monthHits) }}</div>
        <div class="kb-stat-d">诊断与检索累计引用次数</div>
      </div>
      <div class="kb-card kb-stat">
        <div class="kb-stat-k"><el-icon><CircleCheck /></el-icon>知识健康度</div>
        <div class="kb-stat-v" :style="healthy ? { color: 'var(--success)' } : { color: 'var(--warning)' }">{{ healthy ? '良好' : '需关注' }}</div>
        <div class="kb-stat-d">超期 {{ fmtNumber(health.expired.length) }} · 零命中 {{ fmtNumber(health.zeroHit.length) }} · 孤儿 {{ fmtNumber(health.orphan.length) }}</div>
      </div>
    </div>

    <div class="kb-two-col">
      <!-- 三层知识体系 -->
      <div class="kb-card">
        <div class="kb-card-hd">
          <div class="kb-card-title">三层知识体系</div>
          <button v-if="canWrite" class="kb-btn kb-btn-sm" @click="$emit('open-upload')">＋ 上传知识</button>
        </div>
        <div class="kb-card-bd">
          <div class="kb-layer">
            <div class="kb-layer-ico kb-ic-blue"><el-icon><Box /></el-icon></div>
            <div class="kb-layer-main">
              <div class="kb-layer-t">① 官方知识包（底座）<span class="kb-tag kb-tag-primary">系统</span></div>
              <div class="kb-layer-d">随产品版本交付的通用运维 SOP、中间件手册、指标字典模板，开箱即用，官方负责更新。</div>
              <div class="kb-layer-bar">
                <span><b>{{ fmtNumber(layerCounts.BUILTIN) }}</b> 篇</span>
                <span>官方维护</span>
                <span class="kb-tag kb-tag-success">已启用</span>
              </div>
            </div>
          </div>
          <div class="kb-layer">
            <div class="kb-layer-ico kb-ic-teal"><el-icon><Document /></el-icon></div>
            <div class="kb-layer-main">
              <div class="kb-layer-t">② 企业私有知识 <span class="kb-tag kb-tag-teal">私有</span></div>
              <div class="kb-layer-d">你上传的自有系统手册、应急预案、服务/指标字典、变更记录。可在线编写、审核、版本回滚。</div>
              <div class="kb-layer-bar">
                <span><b>{{ fmtNumber(layerCounts.PRIVATE) }}</b> 篇</span>
                <span>待审核 <b>{{ fmtNumber(stats.pendingDocs) }}</b></span>
                <span>覆盖 <b>{{ fmtNumber(coverage.coveredServices) }}</b> 个服务</span>
              </div>
            </div>
          </div>
          <div class="kb-layer">
            <div class="kb-layer-ico kb-ic-amber"><el-icon><TrendCharts /></el-icon></div>
            <div class="kb-layer-main">
              <div class="kb-layer-t">③ 故障案例（自动生长）<span class="kb-tag kb-tag-warning">案例</span></div>
              <div class="kb-layer-d">每次诊断闭环自动生成候选案例，确认根因与有效处置、脱敏后沉淀，越用越准。</div>
              <div class="kb-layer-bar">
                <span>已沉淀 <b>{{ fmtNumber(stats.confirmedCases) }}</b></span>
                <span>待确认 <b>{{ fmtNumber(stats.pendingCases) }}</b></span>
                <span>累计 <b>{{ fmtNumber(layerCounts.CASE) }}</b> 篇案例文档</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 待处理 -->
      <div>
        <div class="kb-card" style="margin-bottom: 16px">
          <div class="kb-card-hd"><div class="kb-card-title">待处理</div></div>
          <div class="kb-card-bd" style="padding-top: 6px">
            <div v-if="!hasTodos" class="kb-empty" style="padding: 24px 0">暂无待处理事项 🎉</div>
            <template v-else>
              <!-- 待审核 -->
              <div v-if="stats.pendingDocs > 0" class="kb-todo-item">
                <span class="kb-tag kb-tag-warning">待审核</span>
                <div class="kb-todo-main">
                  <b>{{ fmtNumber(stats.pendingDocs) }} 篇</b>私有知识等待发布审核
                  <div class="kb-todo-sub">{{ firstPendingDocSub }}</div>
                </div>
                <button class="kb-btn kb-btn-sm" @click="$emit('switch-tab', 'documents')">去处理</button>
              </div>
              <!-- 冲突 -->
              <div v-if="stats.pendingConflicts > 0" class="kb-todo-item">
                <span class="kb-tag kb-tag-danger">冲突</span>
                <div class="kb-todo-main">
                  <b>{{ fmtNumber(stats.pendingConflicts) }} 处</b>新上传文档与现有知识冲突
                  <div class="kb-todo-sub">{{ firstConflictTitle }}</div>
                </div>
                <button class="kb-btn kb-btn-sm" @click="openConflictDialog">裁定</button>
              </div>
              <!-- 待沉淀 -->
              <div v-if="stats.pendingCases > 0" class="kb-todo-item">
                <span class="kb-tag kb-tag-teal">待沉淀</span>
                <div class="kb-todo-main">
                  <b>{{ fmtNumber(stats.pendingCases) }} 个</b>闭环故障待确认成案例
                  <div class="kb-todo-sub">建议复核根因后沉淀</div>
                </div>
                <button class="kb-btn kb-btn-sm" @click="$emit('switch-tab', 'cases')">去确认</button>
              </div>
              <!-- 超期 -->
              <div v-if="health.expired.length > 0" class="kb-todo-item">
                <span class="kb-tag kb-tag-info">超期</span>
                <div class="kb-todo-main">
                  <b>{{ fmtNumber(health.expired.length) }} 篇</b>超过 180 天未复核
                  <div class="kb-todo-sub">可能已失效，影响诊断准确性</div>
                </div>
                <button class="kb-btn kb-btn-sm" @click="$emit('switch-tab', 'documents')">查看</button>
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>

    <!-- 知识覆盖度 -->
    <div class="kb-card">
      <div class="kb-card-hd">
        <div class="kb-card-title">知识覆盖度（按服务）</div>
        <span class="kb-muted" style="font-size: 12px">覆盖越全，诊断越准；低覆盖服务优先补充</span>
      </div>
      <div class="kb-card-bd">
        <div v-if="coverage.details && coverage.details.length" class="kb-cov-row" v-for="item in coverage.details" :key="item.service">
          <span class="kb-cov-name">{{ item.service }}</span>
          <div class="kb-cov-bar">
            <div class="kb-progress" :class="covClass(item)">
              <i :style="{ width: covPercent(item) + '%' }"></i>
            </div>
          </div>
          <span class="kb-cov-val" :style="covPercent(item) < 50 ? { color: 'var(--danger)' } : {}">{{ covPercent(item) }}%</span>
        </div>
        <div v-else class="kb-empty">暂无服务覆盖数据，上传知识并关联服务后自动统计</div>
      </div>
    </div>

    <!-- 冲突裁定对话框 -->
    <el-dialog v-model="conflictVisible" title="知识冲突裁定" width="520px" destroy-on-close>
      <div v-if="conflicts.length" style="margin-bottom: 16px">
        <div
          v-for="c in conflicts" :key="c.id"
          class="kb-file-row" style="cursor: pointer; margin-top: 0; margin-bottom: 8px"
          :style="{ borderColor: selectedConflict?.id === c.id ? 'var(--primary)' : '', background: selectedConflict?.id === c.id ? '#EFF6FF' : '#fff' }"
          @click="selectedConflict = c"
        >
          <div class="kb-f-main">
            <div class="kb-f-name">{{ c.title }}</div>
            <div class="kb-todo-sub">{{ c.service ? '服务：' + c.service : '' }}</div>
          </div>
          <span class="kb-tag kb-tag-danger">待裁定</span>
        </div>
      </div>
      <div v-else class="kb-empty" style="padding: 16px 0">暂无可裁定冲突</div>

      <div v-if="selectedConflict" style="margin-top: 4px">
        <div class="kb-form-row">
          <label>裁定结果</label>
          <div class="kb-seg">
            <button :class="{ on: conflictDecision === 'KEEP_NEW' }" @click="conflictDecision = 'KEEP_NEW'">以新文档为准</button>
            <button :class="{ on: conflictDecision === 'KEEP_OLD' }" @click="conflictDecision = 'KEEP_OLD'">保留原值</button>
            <button :class="{ on: conflictDecision === 'MANUAL' }" @click="conflictDecision = 'MANUAL'">标记人工裁定</button>
          </div>
        </div>
        <div class="kb-form-row" style="margin-bottom: 0">
          <label>备注（可选）</label>
          <el-input v-model="conflictRemark" placeholder="补充裁定说明" maxlength="200" />
        </div>
      </div>
      <template #footer>
        <el-button @click="conflictVisible = false">取消</el-button>
        <el-button type="primary" :loading="resolving" :disabled="!selectedConflict" @click="doResolve">提交裁定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { ElMessage } from 'element-plus'
import {
  getKnowledgeStats, getKnowledgeCoverage, getKnowledgeTodos, getKnowledgeHealth,
  listKnowledgeDocuments, resolveKnowledgeConflict
} from '@/api/knowledge'
import { useAuthStore } from '@/stores/auth'
import { fmtNumber, formatDay } from './kb-utils'

const props = defineProps({
  tick: { type: Number, default: 0 }
})
const emit = defineEmits(['switch-tab', 'open-upload'])

const auth = useAuthStore()
const canWrite = computed(() => auth.isOperator)

const stats = reactive({
  totalDocs: 0, pendingDocs: 0, expiredDocs: 0, zeroHitDocs: 0, orphanDocs: 0,
  totalCases: 0, pendingCases: 0, confirmedCases: 0, pendingConflicts: 0, monthHits: 0
})
const coverage = reactive({ totalServices: 0, coveredServices: 0, coverageRate: 0, details: [] })
const todos = reactive({ pendingDocs: [], pendingCases: [], conflicts: [], expiredDocs: [] })
const health = reactive({ expired: [], zeroHit: [], orphan: [] })
const layerCounts = reactive({ BUILTIN: 0, PRIVATE: 0, CASE: 0 })

const todoTotal = computed(() => stats.pendingDocs + stats.pendingCases + stats.pendingConflicts)
const healthy = computed(() => health.expired.length + health.zeroHit.length + health.orphan.length === 0)
const hasTodos = computed(() => todoTotal.value > 0 || health.expired.length > 0)

const firstPendingDocSub = computed(() => {
  const first = todos.pendingDocs[0]
  if (!first || !first.createdAt) return '等待发布审核'
  const days = Math.max(1, Math.round((Date.now() - new Date(first.createdAt).getTime()) / 86400000))
  return `最早提交于 ${days} 天前`
})
const firstConflictTitle = computed(() => todos.conflicts[0]?.title || '')

// ---- 冲突裁定 ----
const conflictVisible = ref(false)
const selectedConflict = ref(null)
const conflictDecision = ref('KEEP_NEW')
const conflictRemark = ref('')
const resolving = ref(false)
const conflicts = computed(() => todos.conflicts || [])

function openConflictDialog() {
  selectedConflict.value = conflicts.value[0] || null
  conflictDecision.value = 'KEEP_NEW'
  conflictRemark.value = ''
  conflictVisible.value = true
}

async function doResolve() {
  if (!selectedConflict.value) return
  resolving.value = true
  try {
    await resolveKnowledgeConflict(selectedConflict.value.id, {
      decision: conflictDecision.value,
      remark: conflictRemark.value
    })
    ElMessage.success('冲突已裁定')
    conflictVisible.value = false
    await loadData()
  } catch (e) {
    ElMessage.error(e.message || '裁定失败')
  } finally {
    resolving.value = false
  }
}

// ---- 覆盖度 ----
function covPercent(item) {
  const docs = Number(item.docCount || 0)
  if (docs <= 0) return 0
  return Math.min(100, Math.round((Number(item.verifiedCount || 0) / docs) * 100))
}
function covClass(item) {
  const p = covPercent(item)
  if (p >= 80) return 'ok'
  if (p >= 50) return 'warn'
  return 'bad'
}

// ---- 加载 ----
async function loadLayerCounts() {
  const layers = ['BUILTIN', 'PRIVATE', 'CASE']
  const results = await Promise.allSettled(
    layers.map((layer) => listKnowledgeDocuments({ layer, page: 1, size: 1 }))
  )
  results.forEach((r, i) => {
    if (r.status === 'fulfilled' && r.value) {
      layerCounts[layers[i]] = Number(r.value.total || 0)
    }
  })
}

async function loadData() {
  const [s, c, t, h] = await Promise.allSettled([
    getKnowledgeStats(), getKnowledgeCoverage(), getKnowledgeTodos(), getKnowledgeHealth()
  ])
  if (s.status === 'fulfilled' && s.value) Object.assign(stats, s.value)
  if (c.status === 'fulfilled' && c.value) Object.assign(coverage, c.value)
  if (t.status === 'fulfilled' && t.value) Object.assign(todos, t.value)
  if (h.status === 'fulfilled' && h.value) Object.assign(health, h.value)
}

onMounted(() => {
  loadData()
  loadLayerCounts()
})
watch(() => props.tick, () => {
  loadData()
  loadLayerCounts()
})
</script>
