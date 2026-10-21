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
      <!-- ========== 统计卡（P1：接 /alerts/events/summary，单卡失败显示 "—" 可重试） ========== -->
      <div class="alert-summary">
        <div class="stat-card">
          <div class="stat-card-head">
            <div class="k">待处理告警</div>
            <el-button v-if="summaryErr" link size="small" title="重试" @click="loadSummary"><el-icon><Refresh /></el-icon></el-button>
          </div>
          <div class="v" style="color: var(--danger)">{{ summaryVal(summary?.openCount) }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-head">
            <div class="k">今日已触发</div>
            <el-button v-if="summaryErr" link size="small" title="重试" @click="loadSummary"><el-icon><Refresh /></el-icon></el-button>
          </div>
          <div class="v">{{ summaryVal(summary?.todayCount) }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-head">
            <div class="k">已 AI 诊断</div>
            <el-button v-if="summaryErr" link size="small" title="重试" @click="loadSummary"><el-icon><Refresh /></el-icon></el-button>
          </div>
          <div class="v" style="color: var(--teal)">{{ summaryVal(summary?.diagnosedCount) }}<small v-if="summary">条</small></div>
        </div>
        <div class="stat-card">
          <div class="stat-card-head">
            <div class="k">平均诊断耗时</div>
            <el-button v-if="summaryErr" link size="small" title="重试" @click="loadSummary"><el-icon><Refresh /></el-icon></el-button>
          </div>
          <div class="v">{{ summaryVal(summary?.avgDiagnoseMs != null ? fmtMs(summary.avgDiagnoseMs) : null) }}</div>
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
          <el-input v-model="filters.keyword" placeholder="搜索服务 / 指标 / 规则" style="width: 200px" clearable
            @keyup.enter="loadEvents" @clear="loadEvents">
            <template #prefix><el-icon><Search /></el-icon></template>
          </el-input>
          <el-select v-model="filters.status" placeholder="全部状态" style="width: 130px" @change="loadEvents">
            <el-option label="全部状态" value="" />
            <el-option label="待处理" value="FIRING" />
            <el-option label="静默" value="SILENCED" />
            <el-option label="已确认" value="ACKNOWLEDGED" />
            <el-option label="已恢复" value="RESOLVED" />
          </el-select>
          <el-select v-model="filters.service" placeholder="全部服务" style="width: 140px" clearable @change="loadEvents">
            <el-option v-for="s in serviceOptions" :key="s" :label="s" :value="s" />
          </el-select>

          <!-- ★ 规格 1.5：全部 / 未读 / 已读 筛选 -->
          <div class="al-read-seg">
            <button class="al-seg" :class="{ active: readFilter === 'all' }" @click="readFilter = 'all'">全部</button>
            <button class="al-seg" :class="{ active: readFilter === 'unread' }" @click="readFilter = 'unread'">未读</button>
            <button class="al-seg" :class="{ active: readFilter === 'read' }" @click="readFilter = 'read'">已读</button>
          </div>

          <el-button @click="handleReset">重置</el-button>
        </div>

        <!-- ★ 规格 2.7：批量操作悬浮栏（勾选后出现，RESOLVED 自动过滤） -->
        <div v-if="selectedIds.length > 0" class="batch-bar">
          <span>已选 <b>{{ selectedIds.length }}</b> 条</span>
          <el-button v-if="canWrite" size="small" type="primary" :loading="batchLoading" @click="handleBatchAck">
            批量确认（{{ batchAckCount }}）
          </el-button>
          <el-button v-if="canWrite" size="small" type="warning" :loading="batchLoading" @click="openBatchSilence">
            批量静默（{{ batchSilenceCount }}）
          </el-button>
          <el-button size="small" @click="handleBatchRead">标记已读</el-button>
          <el-button size="small" text @click="selectedRows = []">取消选择</el-button>
        </div>

        <div class="kb-card">
          <el-table v-loading="loadingEvents" :data="visibleEvents" class="al-table" stripe
            :row-class-name="rowCls"
            @selection-change="onSelectionChange">
            <el-table-column type="selection" width="42" />
            <el-table-column label="告警" min-width="400">
              <template #default="{ row }">
                <div class="al-row-main">
                  <span class="al-sev" :class="sevCls(row.status)"></span>
                  <!-- ★ 规格 1.5：未读行首蓝色竖条（替代红点） -->
                  <span v-if="row.read === false && isPending(row.status)" class="al-unread-bar" title="未读"></span>
                  <div class="al-t">
                    {{ row.ruleName || row.metric }}
                    <el-tag size="small" :type="statusTagType(row.status)">{{ statusLabel(row.status) }}</el-tag>
                    <!-- ★ 规格 4.3：已升级橙色徽标 -->
                    <el-tooltip v-if="row.escalationLevel > 0"
                      :content="`已升级至 L${row.escalationLevel}（${relTime(row.escalatedAt)}）`" placement="top">
                      <span class="al-escalated">已升级</span>
                    </el-tooltip>
                    <el-tag v-if="diagOf(row.id)" size="small" type="success" effect="light" class="al-diag-tag">已诊断</el-tag>
                  </div>
                  <div class="al-d">
                    <span class="al-metric">{{ row.service }} · {{ row.metric }} {{ row.operator }} {{ row.threshold }}</span>
                    <span v-if="row.currentValue != null" class="al-cur">当前 {{ row.currentValue }}</span>
                    <!-- ★ 规格 3.3：认领人 tag（蓝 @username / 灰 未认领） -->
                    <span v-if="row.acknowledgedBy" class="al-owner-tag">@{{ row.acknowledgedBy }}</span>
                    <span v-else-if="isPending(row.status)" class="al-owner-tag none">未认领</span>
                  </div>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="触发 / 恢复" width="150">
              <template #default="{ row }">
                <span class="al-time">{{ fmtTime(row.firedAt) }}</span>
                <div v-if="row.status === 'RESOLVED' && row.resolvedAt" class="al-time al-resolved">
                  恢复 {{ fmtTime(row.resolvedAt) }}
                </div>
              </template>
            </el-table-column>
            <!-- ★ 规格 2.2：按钮按状态动态渲染 -->
            <el-table-column label="操作" width="290" align="right">
              <template #default="{ row }">
                <el-button link type="primary" @click="goDetail(row)">详情</el-button>
                <template v-if="canWrite">
                  <!-- FIRING / SILENCED：独立认领（规格 3.2，无 owner 时） -->
                  <el-button v-if="!row.acknowledgedBy && isPending(row.status)" link type="primary"
                    @click="handleClaim(row)">认领</el-button>
                  <!-- 接管他人（规格 3.4：二次确认） -->
                  <el-button v-if="row.acknowledgedBy && row.acknowledgedBy !== auth.username && row.status !== 'RESOLVED'"
                    link type="primary" @click="handleTakeover(row)">接管</el-button>
                  <!-- FIRING / SILENCED：确认告警（无二次确认，自动认领，规格 2.3） -->
                  <el-button v-if="['FIRING', 'SILENCED'].includes(row.status)" link type="primary"
                    @click="handleAck(row)">确认告警</el-button>
                  <!-- ACK / SILENCED：标记恢复（二次确认 + 恢复备注，规格 2.4） -->
                  <el-button v-if="['ACKNOWLEDGED', 'SILENCED'].includes(row.status)" link type="success"
                    @click="openResolve(row)">标记恢复</el-button>
                  <!-- FIRING / ACK：静默（规格 2.5） -->
                  <el-button v-if="['FIRING', 'ACKNOWLEDGED'].includes(row.status)" link
                    @click="openSilence(row)">静默</el-button>
                  <!-- SILENCED：解除静默（规格 2.2） -->
                  <el-button v-if="row.status === 'SILENCED'" link type="warning"
                    @click="handleUnsilence(row)">解除静默</el-button>
                </template>
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-if="!loadingEvents && visibleEvents.length === 0" description="暂无告警事件" :image-size="80" />
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

      <!-- ========== 标记恢复（规格 2.4：二次确认 + 恢复备注可选，绿色主按钮） ========== -->
      <el-dialog v-model="resolveVisible" title="标记恢复" width="460px" destroy-on-close>
        <div class="al-confirm-text">
          将告警 <b>{{ resolveTarget ? (resolveTarget.ruleName || resolveTarget.metric) : '' }}</b> 标记为已恢复？
          <span class="al-confirm-note">恢复为终态，此后告警不再进入待处理列表。</span>
        </div>
        <el-form label-width="80px" style="margin-top: 8px">
          <el-form-item label="恢复备注">
            <el-input v-model="resolveNote" type="textarea" :rows="3" maxlength="500" show-word-limit
              placeholder="可选，记录恢复操作说明（如：问题已处理，指标已回稳）" />
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="resolveVisible = false">取消</el-button>
          <el-button type="success" :loading="resolveLoading" @click="doResolve">确认恢复</el-button>
        </template>
      </el-dialog>

      <!-- ========== 静默弹窗（规格 2.5：原因枚举 + 预设时间 + 校验；单条 / 批量共用） ========== -->
      <el-dialog v-model="silenceVisible" :title="silenceBatch ? '批量静默告警' : '静默告警'" width="500px" destroy-on-close>
        <el-form label-width="90px">
          <el-form-item label="静默原因" required>
            <div class="al-reason-grid">
              <button v-for="r in SILENCE_REASONS" :key="r.value" class="al-reason-item"
                :class="{ active: silenceForm.reason === r.value }" @click="silenceForm.reason = r.value">
                {{ r.label }}
              </button>
            </div>
          </el-form-item>
          <el-form-item label="到期时间" required>
            <div class="al-until-row">
              <button v-for="p in UNTIL_PRESETS" :key="p.value" class="al-until-item"
                :class="{ active: silenceForm.untilType === p.value }" @click="pickUntil(p.value)">
                {{ p.label }}
              </button>
            </div>
            <el-date-picker v-if="silenceForm.untilType === 'custom'" v-model="silenceForm.untilCustom" type="datetime"
              :disabled-date="disabledBeforeNowPlus15"
              style="width: 100%; margin-top: 8px"
              placeholder="选择静默恢复时间（需晚于当前 15 分钟）" />
          </el-form-item>
          <el-form-item label="备注">
            <el-input v-model="silenceForm.note" type="textarea" :rows="2" maxlength="500" show-word-limit
              placeholder="可选，静默备注" />
          </el-form-item>
          <div class="al-silence-hint">到期必须 &gt; 当前时间 15 分钟，最多 7 天；到期后若指标仍异常将自动回到原状态。</div>
        </el-form>
        <template #footer>
          <el-button @click="silenceVisible = false">取消</el-button>
          <el-button type="primary" :loading="silenceLoading" @click="doSilence">确定静默</el-button>
        </template>
      </el-dialog>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, SetUp, ChatDotRound, Refresh } from '@element-plus/icons-vue'
import {
  listAlertEvents, acknowledgeAlertEvent, claimAlertEvent, resolveAlertEvent,
  silenceAlertEvent, unsilenceAlertEvent, batchAcknowledgeAlertEvents, markAllAlertEventsRead,
  getAlertSummary, batchSilenceAlertEvents,
} from '@/api/alerts'
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
const readFilter = ref('all') // all / unread / read（规格 1.5）

// ---- 批量选择 ----
const selectedRows = ref([])
const selectedIds = computed(() => selectedRows.value.map((r) => r.id))
const batchLoading = ref(false)
const batchAckCount = computed(() => selectedRows.value.filter((r) => r.status !== 'RESOLVED').length)
const batchSilenceCount = computed(() => selectedRows.value.filter((r) => r.status !== 'RESOLVED').length)

// ---- 诊断记录 ----
const diagnoses = ref([])
const loadingDiags = ref(false)
const diagKeyword = ref('')
const diagVisible = ref(false)
const currentDiag = ref(null)

// ---- 标记恢复（规格 2.4） ----
const resolveVisible = ref(false)
const resolveLoading = ref(false)
const resolveTarget = ref(null)
const resolveNote = ref('')

// ---- 静默（规格 2.5） ----
const SILENCE_REASONS = [
  { value: 'PLANNED_MAINTENANCE', label: '计划维护' },
  { value: 'KNOWN_ISSUE', label: '已知问题' },
  { value: 'FALSE_POSITIVE', label: '误报' },
  { value: 'OTHER', label: '其他' },
]
const UNTIL_PRESETS = [
  { value: '15m', label: '15 分钟' },
  { value: '30m', label: '30 分钟' },
  { value: '1h', label: '1 小时' },
  { value: '2h', label: '2 小时' },
  { value: 'endOfDay', label: '今天结束' },
  { value: 'custom', label: '自定义' },
]
const silenceVisible = ref(false)
const silenceBatch = ref(false)
const silenceLoading = ref(false)
const silenceTarget = ref(null) // null=batch
const silenceForm = reactive({ reason: '', untilType: '1h', untilCustom: null, note: '' })

// ---- P1 汇总（GET /alerts/events/summary，单卡失败显示 "—" 可重试） ----
const summary = ref(null)
const summaryErr = ref(false)
async function loadSummary() {
  summaryErr.value = false
  try {
    summary.value = await getAlertSummary()
  } catch (e) {
    summaryErr.value = true
    summary.value = null
  }
}
function summaryVal(v) {
  if (summaryErr.value) return '—'
  if (v === null || v === undefined) return '—'
  return v
}
function fmtMs(ms) {
  if (ms == null) return '—'
  if (ms < 1000) return `${Math.round(ms)} ms`
  return `${(ms / 1000).toFixed(1)} s`
}

// ---- 统计（规格 1.2 口径：待处理 = FIRING/ACK/SILENCED） ----
const stats = computed(() => {
  const pending = events.value.filter((e) => ['FIRING', 'ACKNOWLEDGED', 'SILENCED'].includes(e.status)).length
  const today = events.value.filter((e) => isToday(e.firedAt)).length
  const diagSet = new Set(diagnoses.value.map((d) => d.alertEventId).filter(Boolean))
  return { pending, today, diag: diagSet.size, total: events.value.length }
})

// 未读 / 已读筛选后的列表
const visibleEvents = computed(() => {
  if (readFilter.value === 'unread') {
    return events.value.filter((e) => e.read === false)
  }
  if (readFilter.value === 'read') {
    return events.value.filter((e) => e.read === true)
  }
  return events.value
})

function isToday(t) {
  if (!t) return false
  const d = new Date(t)
  const now = new Date()
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
}

function isPending(s) {
  return s === 'FIRING' || s === 'ACKNOWLEDGED' || s === 'SILENCED'
}

// ---- 状态映射 ----
const STATUS_LABEL = { FIRING: '待处理', SILENCED: '静默', ACKNOWLEDGED: '已确认', RESOLVED: '已恢复' }
const STATUS_TAG = { FIRING: 'danger', SILENCED: 'warning', ACKNOWLEDGED: 'info', RESOLVED: 'success' }
const SEV_CLS = { FIRING: 'sev-danger', SILENCED: 'sev-warning', ACKNOWLEDGED: 'sev-warning', RESOLVED: 'sev-muted' }

function statusLabel(s) { return STATUS_LABEL[s] || s || '-' }
function statusTagType(s) { return STATUS_TAG[s] || 'info' }
function sevCls(s) { return SEV_CLS[s] || 'sev-muted' }

// 行 class（规格 1.5：未读蓝条 / 已读字色由 CSS 处理）
function rowCls({ row }) {
  if (row.read === false) return 'row-unread'
  return 'row-read'
}

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
  readFilter.value = 'all'
  loadEvents()
}

// ---- 批量选择 ----
function onSelectionChange(rows) {
  selectedRows.value = rows
}

// ---- 操作 ----
function goDetail(row) {
  router.push(`/admin/alerts/${row.id}`)
}

// 独立认领（规格 3.2，无二次确认）
async function handleClaim(row) {
  try {
    await claimAlertEvent(row.id)
    ElMessage.success(`已认领告警，当前处置人 @${auth.username}`)
    loadEvents()
  } catch (e) {
    ElMessage.error(e.message || '认领失败')
  }
}

// 接管他人告警（规格 3.4：二次确认）
async function handleTakeover(row) {
  try {
    await ElMessageBox.confirm(
      `该告警当前由 @${row.acknowledgedBy} 认领。确认接管？`,
      '接管告警',
      { type: 'warning', confirmButtonText: '确认接管', cancelButtonText: '取消' }
    )
    await claimAlertEvent(row.id)
    ElMessage.success(`已接管，当前处置人 @${auth.username}`)
    loadEvents()
  } catch (e) {
    if (e && e.message) ElMessage.error(e.message)
  }
}

// 确认告警（规格 2.3：无二次确认，自动认领）
async function handleAck(row) {
  try {
    await acknowledgeAlertEvent(row.id)
    ElMessage.success(`已确认，处置人 @${auth.username}`)
    loadEvents()
  } catch (e) {
    ElMessage.error(e.message || '确认失败')
  }
}

// 标记恢复：打开弹窗（规格 2.4：二次确认 + 恢复备注）
function openResolve(row) {
  resolveTarget.value = row
  resolveNote.value = ''
  resolveVisible.value = true
}

async function doResolve() {
  resolveLoading.value = true
  try {
    await resolveAlertEvent(resolveTarget.value.id, { resolutionNote: resolveNote.value.trim() || undefined })
    ElMessage.success('已标记恢复')
    resolveVisible.value = false
    loadEvents()
  } catch (e) {
    ElMessage.error(e.message || '标记恢复失败')
  } finally {
    resolveLoading.value = false
  }
}

// ---- 静默 ----
function openSilence(row) {
  silenceBatch.value = false
  silenceTarget.value = row
  resetSilenceForm()
  silenceVisible.value = true
}

function openBatchSilence() {
  if (selectedIds.value.length === 0) {
    ElMessage.warning('请先勾选告警')
    return
  }
  silenceBatch.value = true
  silenceTarget.value = null
  resetSilenceForm()
  silenceVisible.value = true
}

function resetSilenceForm() {
  silenceForm.reason = ''
  silenceForm.untilType = '1h'
  silenceForm.untilCustom = null
  silenceForm.note = ''
}

function pickUntil(type) {
  silenceForm.untilType = type
  if (type !== 'custom') silenceForm.untilCustom = null
}

function disabledBeforeNowPlus15(date) {
  return date.getTime() < Date.now() + 15 * 60 * 1000
}

function computeUntil() {
  const now = Date.now()
  switch (silenceForm.untilType) {
    case '15m': return new Date(now + 16 * 60 * 1000) // 规格要求 > now+15min，留 1 分钟缓冲
    case '30m': return new Date(now + 30 * 60 * 1000)
    case '1h': return new Date(now + 60 * 60 * 1000)
    case '2h': return new Date(now + 2 * 60 * 60 * 1000)
    case 'endOfDay': {
      const d = new Date()
      d.setHours(23, 59, 59, 0)
      return d
    }
    default: return silenceForm.untilCustom
  }
}

async function doSilence() {
  if (!silenceForm.reason) {
    ElMessage.warning('请选择静默原因')
    return
  }
  const until = computeUntil()
  if (!until) {
    ElMessage.warning('请选择到期时间')
    return
  }
  // 校验：必须 > now+15min，最多 7 天（规格 2.5）
  const min = Date.now() + 15 * 60 * 1000
  const max = Date.now() + 7 * 24 * 3600 * 1000
  const untilTs = new Date(until).getTime()
  if (untilTs <= min) {
    ElMessage.warning('到期时间必须晚于当前时间 15 分钟')
    return
  }
  if (untilTs > max) {
    ElMessage.warning('静默最多 7 天，请缩短到期时间')
    return
  }
  silenceLoading.value = true
  try {
    const payload = {
      reason: silenceForm.reason,
      silencedUntil: formatDateTime(until),
      note: silenceForm.note.trim() || undefined,
    }
    if (silenceBatch.value) {
      // P1：批量静默走后端一次性接口，返回 { count, skipped }（已恢复等自动跳过）
      const res = await batchSilenceAlertEvents(selectedIds.value, payload)
      const ok = res && res.count != null ? res.count : selectedIds.value.length
      const skipped = res && res.skipped != null ? res.skipped : 0
      ElMessage.success(`已静默 ${ok} 条告警${skipped > 0 ? `，跳过 ${skipped} 条（已恢复等）` : ''}`)
    } else if (silenceTarget.value) {
      await silenceAlertEvent(silenceTarget.value.id, payload)
      ElMessage.success('已静默，到期自动恢复')
    }
    silenceVisible.value = false
    loadEvents()
  } catch (e) {
    ElMessage.error(e.message || '静默失败')
  } finally {
    silenceLoading.value = false
  }
}

// 解除静默（规格 2.2）
async function handleUnsilence(row) {
  try {
    await unsilenceAlertEvent(row.id)
    ElMessage.success('已解除静默')
    loadEvents()
  } catch (e) {
    ElMessage.error(e.message || '解除静默失败')
  }
}

// ---- 批量操作 ----
async function handleBatchAck() {
  if (selectedIds.value.length === 0) {
    ElMessage.warning('请先勾选告警')
    return
  }
  const ids = selectedRows.value.filter((r) => r.status !== 'RESOLVED').map((r) => r.id)
  const skipped = selectedRows.value.length - ids.length
  if (ids.length === 0) {
    ElMessage.warning('所选告警均已恢复，无需确认')
    return
  }
  try {
    batchLoading.value = true
    const res = await batchAcknowledgeAlertEvents(ids)
    const ok = res && res.count != null ? res.count : ids.length
    ElMessage.success(`已确认 ${ok} 条${skipped > 0 ? `，跳过已恢复 ${skipped} 条` : ''}`)
    selectedRows.value = []
    loadEvents()
  } catch (e) {
    if (e && e.message) ElMessage.error(e.message)
  } finally {
    batchLoading.value = false
  }
}

async function handleBatchRead() {
  if (selectedIds.value.length === 0) {
    ElMessage.warning('请先勾选告警')
    return
  }
  try {
    await markAllAlertEventsRead(selectedIds.value)
    ElMessage.success('已标记已读')
    selectedRows.value = []
    loadEvents()
  } catch (e) {
    ElMessage.error(e.message || '标记已读失败')
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

// ---- 相对时间 ----
function relTime(t) {
  if (!t) return ''
  const diff = Date.now() - new Date(t).getTime()
  if (diff < 60 * 1000) return '刚刚'
  if (diff < 3600 * 1000) return `${Math.floor(diff / 60000)} 分钟前`
  if (diff < 24 * 3600 * 1000) return `${Math.floor(diff / 3600000)} 小时前`
  return `${Math.floor(diff / 86400000)} 天前`
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
function formatDateTime(d) {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

onMounted(() => {
  loadEvents()
  loadDiagnoses()
  loadSummary()
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

.stat-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
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

/* 全部 / 未读 / 已读（规格 1.5） */
.al-read-seg {
  display: inline-flex;
  background: #EEF1F6;
  border-radius: 8px;
  padding: 3px;
  gap: 2px;
}
.al-seg {
  border: none;
  background: transparent;
  padding: 5px 14px;
  border-radius: 6px;
  font-size: 12.5px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s;
}
.al-seg.active {
  background: #fff;
  color: var(--primary);
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);
}

/* ============ 批量操作条 ============ */
.batch-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  margin-bottom: 12px;
  border-radius: 10px;
  background: rgba(37, 99, 235, 0.06);
  border: 1px solid rgba(37, 99, 235, 0.15);
  font-size: 13px;
  color: var(--text-secondary);
}

.batch-bar b {
  color: var(--primary);
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

/* 未读行首蓝色竖条（规格 1.5，替代红点） */
.al-unread-bar {
  width: 4px;
  height: 34px;
  border-radius: 2px;
  flex-shrink: 0;
  margin-top: 3px;
  background: #1677FF;
  box-shadow: 0 0 0 1px rgba(22, 119, 255, 0.2);
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

/* 已升级橙色徽标（规格 4.3） */
.al-escalated {
  display: inline-block;
  font-size: 11px;
  font-weight: 600;
  padding: 1px 8px;
  border-radius: 999px;
  background: rgba(217, 119, 6, 0.14);
  color: #D97706;
  cursor: default;
}

.al-diag-tag {
  background: rgba(13, 148, 136, 0.1);
  color: var(--teal);
}

.al-d {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 3px;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.al-metric {
  font-family: ui-monospace, monospace;
}

.al-cur {
  color: var(--danger);
  margin-left: 6px;
  font-weight: 500;
}

/* 认领人 tag（规格 3.3）：蓝 @username / 灰 未认领 */
.al-owner-tag {
  display: inline-block;
  font-size: 11px;
  font-weight: 500;
  padding: 1px 8px;
  border-radius: 999px;
  background: rgba(37, 99, 235, 0.1);
  color: #2563EB;
  border: 1px solid rgba(37, 99, 235, 0.18);
}
.al-owner-tag.none {
  background: rgba(100, 116, 139, 0.08);
  color: rgba(0, 0, 0, 0.3);
  border: 1px dashed rgba(100, 116, 139, 0.25);
}

.al-time {
  font-size: 12px;
  color: var(--text-muted);
}

.al-resolved {
  margin-top: 2px;
  color: var(--success);
}

.al-silence-hint {
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.6;
  padding: 4px 0 0;
}

/* 标记恢复确认 */
.al-confirm-text {
  font-size: 14px;
  color: var(--text-primary);
  line-height: 1.7;
}
.al-confirm-note {
  display: block;
  font-size: 12.5px;
  color: var(--text-muted);
  margin-top: 2px;
}

/* 静默原因枚举（规格 2.5） */
.al-reason-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  width: 100%;
}
.al-reason-item {
  border: 1px solid rgba(226, 232, 240, 0.9);
  background: #fff;
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s;
}
.al-reason-item:hover { border-color: rgba(37, 99, 235, 0.4); }
.al-reason-item.active {
  border-color: var(--primary);
  background: rgba(37, 99, 235, 0.06);
  color: var(--primary);
  font-weight: 600;
}

/* 静默预设时间 */
.al-until-row {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.al-until-item {
  border: 1px solid rgba(226, 232, 240, 0.9);
  background: #fff;
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 12.5px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s;
}
.al-until-item:hover { border-color: rgba(37, 99, 235, 0.4); }
.al-until-item.active {
  border-color: var(--primary);
  background: rgba(37, 99, 235, 0.06);
  color: var(--primary);
  font-weight: 600;
}

/* ============ 已读 / 未读整行视觉（规格 1.5） ============ */
:deep(.el-table .row-unread .al-t) { color: var(--text-primary); font-weight: 600; }
:deep(.el-table .row-read .al-t) { color: rgba(0, 0, 0, 0.65); }
:deep(.el-table .row-read .al-d),
:deep(.el-table .row-read .al-metric),
:deep(.el-table .row-read .al-time) { color: rgba(0, 0, 0, 0.5); }

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
  color: var(--text-muted);
}

.al-conf-bar {
  display: inline-block;
  width: 60px;
  height: 5px;
  border-radius: 999px;
  background: #EEF1F6;
  overflow: hidden;
}

.al-conf-bar i {
  display: block;
  height: 100%;
  border-radius: 999px;
}

.al-diag-time {
  font-size: 12px;
  color: var(--text-muted);
  white-space: nowrap;
}

/* 诊断详情 */
.al-diag-detail {
  max-height: 60vh;
  overflow-y: auto;
}
.al-dd-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
}
.al-dd-title { font-size: 15px; font-weight: 600; color: var(--text-primary); }
.al-dd-block { margin-bottom: 14px; }
.al-dd-lab { font-size: 12px; color: var(--text-muted); margin-bottom: 6px; }
.al-dd-text { font-size: 13.5px; color: var(--text-primary); line-height: 1.7; }
.al-dd-list { margin: 0; padding-left: 18px; font-size: 13px; color: var(--text-primary); line-height: 1.8; }
.al-dd-err { margin-top: 10px; padding: 8px 12px; background: rgba(220, 38, 38, 0.08); border-radius: 6px; color: #DC2626; font-size: 12.5px; }
</style>
