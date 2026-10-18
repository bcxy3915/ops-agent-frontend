<template>
  <div class="page">
    <!-- ========== 页头 ========== -->
    <div class="page-header">
      <div class="page-header-left">
        <h2 class="page-title">告警中心</h2>
        <span class="page-subtitle">告警触发 → 快照 → AI 诊断 → 通知 → 处置沉淀，一条链路看完</span>
      </div>
      <div class="page-header-actions">
        <el-button :icon="SetUp" @click="$router.push('/admin/alert-rules')">告警规则</el-button>
        <el-button :icon="ChatDotRound" @click="$router.push('/admin/channels')">通知渠道</el-button>
      </div>
    </div>

    <div class="page-body">
      <!-- ========== 统计卡 ========== -->
      <div class="alert-summary">
        <div class="stat-card">
          <div class="k">待处理告警</div>
          <div class="v" style="color: var(--danger)">{{ stats.pending }}</div>
        </div>
        <div class="stat-card">
          <div class="k">今日已触发</div>
          <div class="v">{{ stats.today }}</div>
        </div>
        <div class="stat-card">
          <div class="k">已 AI 诊断</div>
          <div class="v" style="color: var(--teal)">{{ stats.diag }}<small>条</small></div>
        </div>
        <div class="stat-card">
          <div class="k">告警总数</div>
          <div class="v">{{ stats.total }}</div>
        </div>
      </div>

      <!-- ========== Tab ========== -->
      <div class="al-tabs">
        <div class="al-tab" :class="{ active: tab === 0 }" @click="tab = 0">
          告警事件 <span v-if="stats.pending > 0" class="al-tab-badge">{{ stats.pending }}</span>
        </div>
        <div class="al-tab" :class="{ active: tab === 1 }" @click="tab = 1">
          诊断记录 <span class="al-tab-badge dim">{{ diagnoses.length }}</span>
        </div>
      </div>

      <!-- ========== 告警事件 ========== -->
      <div v-show="tab === 0">
        <div class="al-filter-row">
          <el-input v-model="filters.keyword" placeholder="搜索服务 / 指标 / 规则" style="width: 220px" clearable
            @keyup.enter="loadEvents" @clear="loadEvents">
            <template #prefix><el-icon><Search /></el-icon></template>
          </el-input>
          <el-select v-model="filters.status" placeholder="全部状态" style="width: 140px" @change="loadEvents">
            <el-option label="全部状态" value="" />
            <el-option label="待处理" value="FIRING" />
            <el-option label="静默" value="SILENCED" />
            <el-option label="已确认" value="ACKNOWLEDGED" />
            <el-option label="已恢复" value="RESOLVED" />
          </el-select>
          <el-select v-model="filters.service" placeholder="全部服务" style="width: 150px" clearable @change="loadEvents">
            <el-option v-for="s in serviceOptions" :key="s" :label="s" :value="s" />
          </el-select>
          <el-button @click="handleReset">重置</el-button>
        </div>

        <div class="kb-card">
          <el-table v-loading="loadingEvents" :data="events" class="al-table" stripe>
            <el-table-column label="告警" min-width="360">
              <template #default="{ row }">
                <div class="al-row-main">
                  <span class="al-sev" :class="sevCls(row.status)"></span>
                  <div class="al-t">
                    {{ row.ruleName || row.metric }}
                    <el-tag size="small" :type="statusTagType(row.status)">{{ statusLabel(row.status) }}</el-tag>
                    <el-tag v-if="diagOf(row.id)" size="small" type="success" effect="light" class="al-diag-tag">已诊断</el-tag>
                  </div>
                  <div class="al-d">
                    <span class="al-metric">{{ row.service }} · {{ row.metric }} {{ row.operator }} {{ row.threshold }}</span>
                    <span v-if="row.currentValue != null" class="al-cur">当前 {{ row.currentValue }}</span>
                  </div>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="确认 / 恢复" width="130">
              <template #default="{ row }">
                <span class="al-time">{{ fmtTime(row.resolvedAt || row.firedAt) }}</span>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="130" align="right">
              <template #default="{ row }">
                <el-button link type="primary" @click="goDetail(row)">详情</el-button>
                <el-button v-if="canWrite && ['FIRING', 'SILENCED'].includes(row.status)" link type="warning"
                  @click="handleAck(row)">确认</el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-if="!loadingEvents && events.length === 0" description="暂无告警事件" :image-size="80" />
        </div>
      </div>

      <!-- ========== 诊断记录 ========== -->
      <div v-show="tab === 1">
        <div class="al-filter-row">
          <el-input v-model="diagKeyword" placeholder="搜索服务 / 根因关键词" style="width: 220px" clearable
            @keyup.enter="loadDiagnoses" @clear="loadDiagnoses">
            <template #prefix><el-icon><Search /></el-icon></template>
          </el-input>
          <el-button @click="loadDiagnoses">重置</el-button>
        </div>

        <div class="kb-card">
          <div v-loading="loadingDiags" class="al-diag-list">
            <div v-for="d in filteredDiags" :key="d.id" class="al-diag-row" @click="openDiag(d)">
              <div class="al-diag-main">
                <div class="al-diag-t">{{ d.service }} · {{ d.metric }}
                  <span class="al-conf-tag" :class="confCls(d.confidence)">置信度{{ d.confidence || 0 }}%</span>
                </div>
                <div class="al-diag-cause">{{ d.rootCause || d.summary || '暂无根因结论' }}</div>
              </div>
              <div class="al-conf">
                <span :style="{ color: confColor(d.confidence) }">{{ d.confidence || 0 }}%</span>
                <span class="al-conf-bar"><i :style="{ width: (d.confidence || 0) + '%', background: confColor(d.confidence) }"></i></span>
              </div>
              <div class="al-diag-time">{{ fmtDay(d.createdAt) }}</div>
            </div>
            <el-empty v-if="!loadingDiags && filteredDiags.length === 0" description="暂无诊断记录" :image-size="80" />
          </div>
        </div>
      </div>

      <!-- ========== 无告警关联的诊断详情 ========== -->
      <el-dialog v-model="diagVisible" title="诊断详情" width="640px" destroy-on-close>
        <div v-if="currentDiag" class="al-diag-detail">
          <div class="al-dd-head">
            <span class="al-dd-title">{{ currentDiag.service }} · {{ currentDiag.metric }}</span>
            <span class="al-conf-tag" :class="confCls(currentDiag.confidence)">置信度 {{ currentDiag.confidence || 0 }}%</span>
          </div>
          <div class="al-dd-block">
            <div class="al-dd-lab">推断根因</div>
            <div class="al-dd-text">{{ currentDiag.rootCause || '暂无' }}</div>
          </div>
          <div v-if="currentDiag.evidence && currentDiag.evidence.length" class="al-dd-block">
            <div class="al-dd-lab">证据</div>
            <ul class="al-dd-list">
              <li v-for="(e, i) in currentDiag.evidence" :key="i">{{ e }}</li>
            </ul>
          </div>
          <div v-if="currentDiag.suggestions && currentDiag.suggestions.length" class="al-dd-block">
            <div class="al-dd-lab">建议处置</div>
            <ol class="al-dd-list">
              <li v-for="(s, i) in currentDiag.suggestions" :key="i">{{ s }}</li>
            </ol>
          </div>
          <div v-if="currentDiag.errorMessage" class="al-dd-err">{{ currentDiag.errorMessage }}</div>
        </div>
      </el-dialog>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, SetUp, ChatDotRound } from '@element-plus/icons-vue'
import { listAlertEvents, acknowledgeAlertEvent } from '@/api/alerts'
import { listDiagnoses } from '@/api/diagnosis'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()
const canWrite = computed(() => auth.isOperator)

const tab = ref(0)

// ---- 告警事件 ----
const events = ref([])
const loadingEvents = ref(false)
const filters = reactive({ keyword: '', status: '', service: '' })
const serviceOptions = ref([])

// ---- 诊断记录 ----
const diagnoses = ref([])
const loadingDiags = ref(false)
const diagKeyword = ref('')
const diagVisible = ref(false)
const currentDiag = ref(null)

// ---- 统计 ----
const stats = computed(() => {
  const pending = events.value.filter((e) => e.status === 'FIRING' || e.status === 'SILENCED').length
  const today = events.value.filter((e) => isToday(e.firedAt)).length
  const diagSet = new Set(diagnoses.value.map((d) => d.alertEventId).filter(Boolean))
  return { pending, today, diag: diagSet.size, total: events.value.length }
})

function isToday(t) {
  if (!t) return false
  const d = new Date(t)
  const now = new Date()
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
}

// ---- 状态映射 ----
const STATUS_LABEL = { FIRING: '待处理', SILENCED: '静默', ACKNOWLEDGED: '已确认', RESOLVED: '已恢复' }
const STATUS_TAG = { FIRING: 'danger', SILENCED: 'warning', ACKNOWLEDGED: 'info', RESOLVED: 'success' }
const SEV_CLS = { FIRING: 'sev-danger', SILENCED: 'sev-warning', ACKNOWLEDGED: 'sev-warning', RESOLVED: 'sev-muted' }

function statusLabel(s) { return STATUS_LABEL[s] || s || '-' }
function statusTagType(s) { return STATUS_TAG[s] || 'info' }
function sevCls(s) { return SEV_CLS[s] || 'sev-muted' }

// ---- 置信度 ----
function confColor(c) {
  if (c == null) return '#94A3B8'
  if (c >= 80) return '#0D9488'
  if (c >= 60) return '#D97706'
  return '#64748B'
}
function confCls(c) {
  if (c == null) return 'conf-low'
  if (c >= 80) return 'conf-high'
  if (c >= 60) return 'conf-mid'
  return 'conf-low'
}

// ---- 加载 ----
async function loadEvents() {
  loadingEvents.value = true
  try {
    const params = {
      service: filters.service || undefined,
      status: filters.status || undefined,
      limit: 100,
    }
    const list = await listAlertEvents(params)
    events.value = list || []
    // 客户端关键词过滤（服务/指标/规则）
    if (filters.keyword) {
      const kw = filters.keyword.toLowerCase()
      events.value = events.value.filter(
        (e) => (e.service || '').toLowerCase().includes(kw) ||
          (e.metric || '').toLowerCase().includes(kw) ||
          (e.ruleName || '').toLowerCase().includes(kw)
      )
    }
    const set = new Set(serviceOptions.value)
    events.value.forEach((e) => e.service && set.add(e.service))
    serviceOptions.value = Array.from(set).sort()
  } catch (e) {
    ElMessage.error(e.message || '加载告警失败')
  } finally {
    loadingEvents.value = false
  }
}

async function loadDiagnoses() {
  loadingDiags.value = true
  try {
    diagnoses.value = (await listDiagnoses({ limit: 100 })) || []
  } catch (e) {
    ElMessage.error(e.message || '加载诊断记录失败')
  } finally {
    loadingDiags.value = false
  }
}

const filteredDiags = computed(() => {
  if (!diagKeyword.value) return diagnoses.value
  const kw = diagKeyword.value.toLowerCase()
  return diagnoses.value.filter(
    (d) => (d.service || '').toLowerCase().includes(kw) ||
      (d.rootCause || '').toLowerCase().includes(kw)
  )
})

function diagOf(alertEventId) {
  return diagnoses.value.find((d) => d.alertEventId === alertEventId && d.status !== 'FAILED')
}

function handleReset() {
  filters.keyword = ''
  filters.status = ''
  filters.service = ''
  loadEvents()
}

// ---- 操作 ----
function goDetail(row) {
  router.push(`/admin/alerts/${row.id}`)
}

async function handleAck(row) {
  try {
    await ElMessageBox.confirm(`确认告警"${row.ruleName || row.metric}"？确认后将记录处置人。`, '确认告警', {
      type: 'warning', confirmButtonText: '确认', cancelButtonText: '取消',
    })
    await acknowledgeAlertEvent(row.id)
    ElMessage.success('已确认')
    loadEvents()
  } catch (e) {
    if (e && e.message) ElMessage.error(e.message)
  }
}

function openDiag(d) {
  if (d.alertEventId) {
    router.push(`/admin/alerts/${d.alertEventId}`)
  } else {
    currentDiag.value = d
    diagVisible.value = true
  }
}

// ---- 时间格式 ----
function fmtTime(t) {
  if (!t) return '-'
  const d = new Date(t)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}
function fmtDay(t) {
  if (!t) return '-'
  const d = new Date(t)
  const p = (n) => String(n).padStart(2, '0')
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

onMounted(() => {
  loadEvents()
  loadDiagnoses()
})
</script>

<style scoped>
.page {
  padding: 20px 24px 32px;
  max-width: 1160px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18px;
}

.page-title {
  font-size: 20px;
  font-weight: 600;
  margin: 0;
  color: var(--text-primary);
}

.page-subtitle {
  font-size: 13px;
  color: var(--text-muted);
  margin-left: 10px;
}

/* ============ 统计卡 ============ */
.alert-summary {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
  margin-bottom: 18px;
}

.stat-card {
  background: rgba(255, 255, 255, 0.85);
  border: 1px solid rgba(226, 232, 240, 0.8);
  border-radius: 12px;
  padding: 16px 18px;
}

.stat-card .k {
  font-size: 12.5px;
  color: var(--text-muted);
  margin-bottom: 6px;
}

.stat-card .v {
  font-size: 26px;
  font-weight: 700;
  color: var(--text-primary);
}

.stat-card .v small {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-muted);
  margin-left: 2px;
}

/* ============ Tab ============ */
.al-tabs {
  display: flex;
  gap: 4px;
  border-bottom: 1px solid rgba(226, 232, 240, 0.8);
  margin-bottom: 14px;
}

.al-tab {
  padding: 10px 16px;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  transition: all 0.15s;
}

.al-tab.active {
  color: var(--primary);
  border-bottom-color: var(--primary);
}

.al-tab-badge {
  display: inline-block;
  min-width: 18px;
  padding: 1px 6px;
  border-radius: 999px;
  background: var(--danger);
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  text-align: center;
  margin-left: 6px;
}

.al-tab-badge.dim {
  background: #EEF1F6;
  color: var(--text-muted);
}

/* ============ 筛选 ============ */
.al-filter-row {
  display: flex;
  gap: 10px;
  margin-bottom: 14px;
  flex-wrap: wrap;
  align-items: center;
}

/* ============ 告警事件表 ============ */
.al-row-main {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 4px 0;
}

.al-sev {
  width: 4px;
  height: 34px;
  border-radius: 2px;
  flex-shrink: 0;
  margin-top: 3px;
}

.sev-danger { background: var(--danger); }
.sev-warning { background: var(--warning); }
.sev-muted { background: #CBD5E1; }

.al-t {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.al-diag-tag {
  background: rgba(13, 148, 136, 0.1);
  color: var(--teal);
}

.al-d {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 3px;
}

.al-metric {
  font-family: ui-monospace, monospace;
}

.al-cur {
  color: var(--danger);
  margin-left: 6px;
  font-weight: 500;
}

.al-time {
  font-size: 12px;
  color: var(--text-muted);
}

/* ============ 诊断记录 ============ */
.al-diag-list {
  min-height: 120px;
}

.al-diag-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  border-bottom: 1px solid rgba(226, 232, 240, 0.6);
  cursor: pointer;
  transition: background 0.15s;
}

.al-diag-row:last-child { border-bottom: none; }
.al-diag-row:hover { background: #FAFBFE; }

.al-diag-main {
  flex: 1;
  min-width: 0;
}

.al-diag-t {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.al-conf-tag {
  display: inline-block;
  padding: 1px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  margin-left: 8px;
  vertical-align: 1px;
}

.conf-high { background: rgba(13, 148, 136, 0.12); color: var(--teal); }
.conf-mid { background: rgba(217, 119, 6, 0.12); color: var(--warning); }
.conf-low { background: rgba(100, 116, 139, 0.1); color: var(--text-muted); }

.al-diag-cause {
  font-size: 12.5px;
  color: var(--text-muted);
  margin-top: 3px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.al-conf {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  flex-shrink: 0;
}

.al-conf-bar {
  width: 54px;
  height: 6px;
  border-radius: 3px;
  background: #EEF1F6;
  overflow: hidden;
  display: inline-block;
}

.al-conf-bar > i {
  display: block;
  height: 100%;
  border-radius: 3px;
}

.al-diag-time {
  font-size: 12px;
  color: var(--text-muted);
  width: 130px;
  text-align: right;
  flex-shrink: 0;
}

/* ============ 诊断详情 dialog ============ */
.al-dd-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.al-dd-title {
  font-size: 15px;
  font-weight: 600;
}

.al-dd-block { margin-bottom: 14px; }

.al-dd-lab {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  margin-bottom: 6px;
}

.al-dd-text {
  font-size: 13.5px;
  line-height: 1.7;
  color: var(--text-primary);
}

.al-dd-list {
  margin: 0;
  padding-left: 18px;
  font-size: 13px;
  line-height: 1.8;
  color: var(--text-secondary);
}

.al-dd-err {
  padding: 8px 12px;
  border-radius: 8px;
  background: rgba(239, 68, 68, 0.08);
  color: var(--danger);
  font-size: 12.5px;
}
</style>
