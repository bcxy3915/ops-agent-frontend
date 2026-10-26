<template>
  <div class="kb-cases">
    <!-- 二级 Tab：待确认 / 已沉淀 -->
    <div class="kb-tabs" style="margin-bottom: 16px">
      <button class="kb-tab" :class="{ active: mode === 'pending' }" @click="switchMode('pending')">
        待确认 <span class="kb-tag kb-tag-warning">{{ pendingTotal }}</span>
      </button>
      <button class="kb-tab" :class="{ active: mode === 'confirmed' }" @click="switchMode('confirmed')">
        已沉淀 <span class="kb-tag kb-tag-success">{{ confirmedTotal }}</span>
      </button>
    </div>

    <div v-loading="loading">
      <!-- 空态 -->
      <div v-if="!loading && cards.length === 0" class="kb-card" style="padding: 40px 20px">
        <el-empty :description="mode === 'pending' ? '暂无待确认候选案例' : '暂无已沉淀案例'" :image-size="80" />
        <div v-if="mode === 'pending' && canWrite" style="text-align: center; margin-top: 8px">
          <el-button type="primary" :icon="MagicStick" :loading="generating" @click="doGenerate">自动生成案例候选</el-button>
          <div class="kb-muted" style="font-size: 12px; margin-top: 6px">从最近闭环诊断记录生成候选案例，确认根因后沉淀</div>
        </div>
      </div>

      <!-- 卡片列表 -->
      <div v-for="card in cards" :key="card.id" class="kb-card" style="margin-bottom: 16px">
        <div class="kb-card-hd">
          <div class="kb-card-title">
            {{ card.title }}
            <span v-if="mode === 'pending'" class="kb-tag kb-tag-teal">系统生成候选</span>
            <span
              v-else
              class="kb-tag"
              :class="Number(card.confidence) >= 70 ? 'kb-tag-success' : 'kb-tag-warning'"
            >{{ Number(card.confidence) >= 70 ? '置信度高 ' + card.confidence + '%' : '置信度中 ' + card.confidence + '%，建议复核' }}</span>
            <span v-if="mode === 'confirmed'" class="kb-tag kb-tag-info">已沉淀</span>
          </div>
          <span class="kb-doc-meta">{{ formatDay(card.closedLoopAt) }} 闭环<template v-if="card.durationMin"> · 耗时 {{ card.durationMin }} 分钟</template></span>
        </div>
        <div class="kb-card-bd">
          <!-- 五步闭环链路 -->
          <div v-if="card.flow && card.flow.length" class="kb-case-flow">
            <template v-for="(s, i) in flowDisplay(card.flow)" :key="s.step">
              <div class="kb-cf-node">
                <span class="kb-cf-dot" :class="{ 'kb-cf-pending': !s.time }">{{ s.time ? '✓' : '·' }}</span>{{ s.title }}
              </div>
              <span v-if="i < flowDisplay(card.flow).length - 1" class="kb-cf-line" :class="{ 'kb-cf-pending': !flowDisplay(card.flow)[i + 1].time }"></span>
            </template>
          </div>

          <!-- 内容 -->
          <div class="kb-case-content">
            <p><b>现象：</b>{{ card.symptom || '-' }}</p>
            <p v-if="mode === 'pending'">
              <b>AI 推断根因：</b>{{ card.rootCause || '-' }}
              <span v-if="Number(card.confidence) < 70" class="kb-muted">—— 请确认或修正真实根因</span>
            </p>
            <p v-else><b>根因：</b>{{ card.realRootCause || card.rootCause || '-' }}</p>
            <p v-if="card.evidence && card.evidence.length">
              <b>证据：</b>
              <code v-for="(ev, idx) in card.evidence" :key="idx" style="margin-right: 6px">{{ ev }}</code>
            </p>
            <p><b>有效处置：</b>{{ card.effectiveAction || '-' }}</p>
            <p v-if="mode === 'confirmed' && card.citedCount != null"><b>被引用：</b>{{ fmtNumber(card.citedCount) }} 次</p>
            <p v-if="card.maskedStatus"><b>脱敏预览：</b>{{ maskedLabel(card.maskedStatus) }}</p>
          </div>

          <!-- 沉淀说明（待确认） -->
          <div v-if="mode === 'pending'" class="kb-alert kb-alert-info" style="margin: 6px 0 14px">
            <el-icon class="kb-alert-icon"><InfoFilled /></el-icon>
            <span>沉淀后该案例将作为检索语料，在相似故障诊断中被引用并优先推荐已验证处置；同时作为反馈帮助模型修正此类根因判断。</span>
          </div>

          <!-- 按钮 -->
          <div style="display: flex; gap: 10px; justify-content: flex-end">
            <template v-if="mode === 'pending'">
              <template v-if="canWrite">
                <el-button @click="openRevise(card)">编辑 / 修正根因</el-button>
                <el-button type="danger" plain @click="doDiscard(card)">丢弃</el-button>
                <el-button type="primary" @click="doConfirm(card)">确认并沉淀</el-button>
              </template>
              <el-button v-else @click="viewDetail(card)">查看详情</el-button>
            </template>
            <template v-else>
              <el-button @click="viewDetail(card)">查看详情 / 引用统计</el-button>
            </template>
          </div>
        </div>
      </div>
    </div>

    <!-- 案例详情 -->
    <el-dialog v-model="detailVisible" title="案例详情" width="760px" destroy-on-close>
      <template v-if="detail">
        <div class="kb-detail-block">
          <div class="kb-detail-label">基本信息</div>
          <div style="font-size: 13px; display: flex; flex-wrap: wrap; gap: 6px 20px">
            <span><span class="kb-muted">标题：</span><b>{{ detail.title }}</b></span>
            <span><span class="kb-muted">服务：</span>{{ detail.service || '-' }}</span>
            <span><span class="kb-muted">状态：</span><span class="kb-tag" :class="detail.status === 'CONFIRMED' ? 'kb-tag-success' : 'kb-tag-warning'">{{ detail.status === 'CONFIRMED' ? '已沉淀' : '待确认' }}</span></span>
            <span><span class="kb-muted">置信度：</span>{{ detail.confidence }}%</span>
            <span><span class="kb-muted">确认人：</span>{{ detail.confirmedBy || '-' }}</span>
            <span><span class="kb-muted">引用：</span>{{ fmtNumber(detail.citedCount) }} 次</span>
            <span><span class="kb-muted">闭环：</span>{{ formatDay(detail.closedLoopAt) }}</span>
            <span v-if="detail.durationMin"><span class="kb-muted">耗时：</span>{{ detail.durationMin }} 分钟</span>
          </div>
        </div>
        <div v-if="detail.flow && detail.flow.length" class="kb-detail-block">
          <div class="kb-detail-label">五步闭环链路</div>
          <div v-for="s in detail.flow" :key="s.step" style="font-size: 13px; margin-bottom: 6px">
            <b>{{ s.title }}</b><span class="kb-muted" v-if="s.time"> · {{ formatDay(s.time) }}</span>
            <div v-if="s.content" class="kb-sec" style="font-size: 12.5px">{{ s.content }}</div>
          </div>
        </div>
        <div class="kb-detail-block">
          <div class="kb-detail-label">现象</div>
          <div class="kb-detail-content">{{ detail.symptom || '-' }}</div>
        </div>
        <div class="kb-detail-block">
          <div class="kb-detail-label">{{ detail.realRootCause ? '真实根因（人工确认）' : 'AI 推断根因' }}</div>
          <div class="kb-detail-content">{{ detail.realRootCause || detail.rootCause || '-' }}</div>
        </div>
        <div v-if="detail.evidence && detail.evidence.length" class="kb-detail-block">
          <div class="kb-detail-label">证据</div>
          <div class="kb-detail-content">{{ detail.evidence.join('\n') }}</div>
        </div>
        <div class="kb-detail-block">
          <div class="kb-detail-label">有效处置</div>
          <div class="kb-detail-content">{{ detail.effectiveAction || '-' }}</div>
        </div>
        <div v-if="refStats" class="kb-detail-block">
          <div class="kb-detail-label">引用统计（累计 {{ fmtNumber(refStats.totalHits) }} 次）</div>
          <el-table :data="refStats.recentHits || []" size="small" max-height="240">
            <el-table-column prop="query" label="触发问题" min-width="220" show-overflow-tooltip />
            <el-table-column label="时间" width="160">
              <template #default="{ row }">{{ formatDay(row.createdAt) }}</template>
            </el-table-column>
            <template #empty><el-empty description="暂无最近引用" :image-size="60" /></template>
          </el-table>
        </div>
      </template>
    </el-dialog>

    <!-- 修正根因 -->
    <el-dialog v-model="reviseVisible" title="编辑 / 修正根因" width="640px" destroy-on-close>
      <el-form :model="reviseForm" label-width="110px">
        <el-form-item label="标题（只读）">
          <el-input :model-value="reviseForm.title" disabled />
        </el-form-item>
        <el-form-item label="现象（只读）">
          <el-input :model-value="reviseForm.symptom" type="textarea" :rows="2" disabled />
        </el-form-item>
        <el-form-item label="真实根因">
          <el-input v-model="reviseForm.realRootCause" type="textarea" :rows="3" maxlength="2000" placeholder="不填写则沿用 AI 推断根因" />
        </el-form-item>
        <el-form-item label="有效处置">
          <el-input v-model="reviseForm.effectiveAction" type="textarea" :rows="3" maxlength="2000" />
        </el-form-item>
        <el-form-item label="脱敏状态">
          <el-select v-model="reviseForm.maskedStatus" style="width: 200px">
            <el-option label="未脱敏" value="NONE" />
            <el-option label="部分脱敏" value="PARTIAL" />
            <el-option label="完全脱敏" value="FULL" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="reviseVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveRevise">修正并沉淀</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { MagicStick, InfoFilled } from '@element-plus/icons-vue'
import {
  listKnowledgeCases, getKnowledgeCase, getCaseReferences,
  confirmKnowledgeCase, reviseKnowledgeCase, discardKnowledgeCase, generateKnowledgeCases
} from '@/api/knowledge'
import { useAuthStore } from '@/stores/auth'
import { FLOW_STEPS, MASKED_MAP, formatDay, fmtNumber } from './kb-utils'

const props = defineProps({
  tick: { type: Number, default: 0 }
})

const auth = useAuthStore()
const canWrite = computed(() => auth.hasPermission('knowledge:write'))

const mode = ref('pending')
const cards = ref([])
const loading = ref(false)
const generating = ref(false)
const pendingTotal = ref(0)
const confirmedTotal = ref(0)

async function load() {
  loading.value = true
  try {
    const [p, c] = await Promise.all([
      listKnowledgeCases({ status: 'PENDING', page: 1, size: 50 }),
      listKnowledgeCases({ status: 'CONFIRMED', page: 1, size: 50 })
    ])
    pendingTotal.value = Number(p.total || 0)
    confirmedTotal.value = Number(c.total || 0)
    const list = mode.value === 'pending' ? (p.records || []) : (c.records || [])
    // 列表项补充详情（现象/根因/处置/闭环链路）
    const withDetail = await Promise.all(
      list.map(async (s) => {
        try {
          const d = await getKnowledgeCase(s.id)
          return { ...s, ...d }
        } catch (_) {
          return s
        }
      })
    )
    cards.value = withDetail
  } catch (e) {
    ElMessage.error(e.message || '加载案例失败')
  } finally {
    loading.value = false
  }
}

function switchMode(m) {
  mode.value = m
  load()
}

function flowDisplay(flow) {
  // 按标准五步顺序展示；未出现的步骤补空
  return FLOW_STEPS.map((f) => {
    const found = (flow || []).find((s) => s.step === f.key)
    return found || { step: f.key, title: f.label, time: null }
  })
}

function maskedLabel(v) {
  return MASKED_MAP[v] || v || '-'
}

// ---- 确认 / 丢弃 / 生成 ----
async function doConfirm(card) {
  try {
    await ElMessageBox.confirm(
      `确认沉淀案例「${card.title}」？沉淀后将作为检索语料参与诊断。`,
      '确认沉淀',
      { type: 'warning', confirmButtonText: '确认沉淀' }
    )
  } catch (_) {
    return
  }
  try {
    await confirmKnowledgeCase(card.id)
    ElMessage.success('已沉淀')
    load()
  } catch (e) {
    ElMessage.error(e.message || '操作失败')
  }
}
async function doDiscard(card) {
  try {
    await ElMessageBox.confirm(
      `丢弃候选案例「${card.title}」？该操作不可恢复。`,
      '丢弃确认',
      { type: 'warning', confirmButtonText: '丢弃', confirmButtonClass: 'el-button--danger' }
    )
  } catch (_) {
    return
  }
  try {
    await discardKnowledgeCase(card.id)
    ElMessage.success('已丢弃')
    load()
  } catch (e) {
    ElMessage.error(e.message || '操作失败')
  }
}
async function doGenerate() {
  generating.value = true
  try {
    const res = await generateKnowledgeCases(20)
    const n = res && typeof res === 'object' ? Object.values(res)[0] : 0
    ElMessage.success(`已生成 ${n} 个候选案例`)
    load()
  } catch (e) {
    ElMessage.error(e.message || '生成失败')
  } finally {
    generating.value = false
  }
}

// ---- 详情 ----
const detail = ref(null)
const detailVisible = ref(false)
const refStats = ref(null)
async function viewDetail(card) {
  try {
    const d = await getKnowledgeCase(card.id)
    detail.value = d
    detailVisible.value = true
    // 已沉淀案例附加引用统计
    refStats.value = null
    if (d.status === 'CONFIRMED') {
      try {
        refStats.value = await getCaseReferences(card.id)
      } catch (_) {
        /* 引用统计不可用则跳过 */
      }
    }
  } catch (e) {
    ElMessage.error(e.message || '加载详情失败')
  }
}

// ---- 修正 ----
const reviseVisible = ref(false)
const saving = ref(false)
const reviseForm = reactive({ id: null, title: '', symptom: '', realRootCause: '', effectiveAction: '', maskedStatus: 'NONE' })
function openRevise(card) {
  reviseForm.id = card.id
  reviseForm.title = card.title || ''
  reviseForm.symptom = card.symptom || ''
  reviseForm.realRootCause = card.realRootCause || card.rootCause || ''
  reviseForm.effectiveAction = card.effectiveAction || ''
  reviseForm.maskedStatus = card.maskedStatus || 'NONE'
  reviseVisible.value = true
}
async function saveRevise() {
  saving.value = true
  try {
    await reviseKnowledgeCase(reviseForm.id, {
      realRootCause: reviseForm.realRootCause || undefined,
      effectiveAction: reviseForm.effectiveAction || undefined,
      maskedStatus: reviseForm.maskedStatus
    })
    ElMessage.success('已修正并沉淀')
    reviseVisible.value = false
    load()
  } catch (e) {
    ElMessage.error(e.message || '操作失败')
  } finally {
    saving.value = false
  }
}

onMounted(load)
watch(() => props.tick, () => load())
</script>
