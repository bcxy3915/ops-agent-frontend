<template>
  <div class="page">
    <!-- ========== 页头 ========== -->
    <div class="page-header">
      <div class="page-header-left">
        <h2 class="page-title">告警规则</h2>
        <span class="page-subtitle">阈值触发、通知节流、升级策略与渠道绑定</span>
      </div>
      <div class="page-header-actions">
        <el-button v-if="canWrite" type="primary" :icon="Plus" @click="openCreate">新建规则</el-button>
      </div>
    </div>

    <div class="page-body">
      <!-- 筛选 -->
      <div class="rule-filter-row">
        <el-input v-model="filters.keyword" placeholder="搜索规则名称 / 服务 / 指标" style="width: 220px" clearable
          @keyup.enter="loadRules" @clear="loadRules">
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        <el-select v-model="filters.service" placeholder="全部服务" style="width: 150px" clearable @change="loadRules">
          <el-option v-for="s in serviceOptions" :key="s" :label="s" :value="s" />
        </el-select>
        <el-select v-model="filters.enabled" placeholder="全部状态" style="width: 130px" @change="loadRules">
          <el-option label="全部状态" value="" />
          <el-option label="已启用" :value="true" />
          <el-option label="已停用" :value="false" />
        </el-select>
        <el-button @click="handleReset">重置</el-button>
      </div>

      <!-- 表格 -->
      <div class="kb-card" style="overflow: hidden">
        <el-table v-loading="loading" :data="rows" stripe>
          <el-table-column label="规则" min-width="240">
            <template #default="{ row }">
              <div class="rule-name">{{ row.name }}</div>
              <div class="rule-meta">{{ ruleMeta(row) }}</div>
            </template>
          </el-table-column>
          <el-table-column label="触发条件" width="220">
            <template #default="{ row }">
              <span class="rule-expr">{{ row.metric }} <b>{{ opLabel(row.operator) }} {{ row.threshold }}</b></span>
              <div class="rule-meta" v-if="row.compareMode && row.compareMode !== 'THRESHOLD'">{{ row.compareMode }}</div>
            </template>
          </el-table-column>
          <!-- ★ P0 规格 4：升级策略（多级路径） -->
          <el-table-column label="升级策略" width="220">
            <template #default="{ row }">
              <template v-if="row.escalationEnabled && row.escalationLevels && row.escalationLevels.length">
                <el-tooltip :content="escalationTooltip(row)" placement="top" :show-after="150">
                  <div class="rule-escalation">
                    <span v-for="(lv, i) in row.escalationLevels" :key="i" class="rule-esc-item">
                      <b>L{{ i + 1 }}</b> {{ fmtDur(lv.afterSeconds) }}→{{ roleLabel(lv.toRole) || lv.toUsers.join('/') }}
                    </span>
                  </div>
                </el-tooltip>
              </template>
              <el-tag v-else-if="row.escalationEnabled" size="small" type="warning" effect="light">已开启（未配置级别）</el-tag>
              <span v-else class="rule-meta">未开启</span>
            </template>
          </el-table-column>
          <el-table-column label="服务" width="140">
            <template #default="{ row }">
              <span class="rule-sec">{{ row.service || '全部服务' }}</span>
            </template>
          </el-table-column>
          <el-table-column label="通知渠道" width="120">
            <template #default="{ row }">
              <span class="rule-sec" title="规则触发后按已启用的通知渠道发送">默认渠道</span>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="90">
            <template #default="{ row }">
              <el-switch :model-value="!!row.enabled" :disabled="!canWrite"
                @change="(v) => handleToggle(row, v)" />
            </template>
          </el-table-column>
          <el-table-column label="操作" width="150" align="right">
            <template #default="{ row }">
              <el-button v-if="canWrite" link type="primary" @click="openEdit(row)">编辑</el-button>
              <el-button v-if="auth.isAdmin" link type="danger" @click="handleDelete(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-if="!loading && rows.length === 0" description="暂无告警规则" :image-size="80" />
      </div>

      <div class="rule-tip">
        <el-icon><InfoFilled /></el-icon>
        规则触发后自动抓快照、发通知并调用 LLM 诊断；同一规则在节流窗口内不重复告警。开启升级策略后，未确认 / 未恢复告警将按多级路径逐级升级提醒（规格 4）。
      </div>
    </div>

    <!-- ========== 新建 / 编辑 dialog ========== -->
    <el-dialog
      v-model="dialogVisible"
      :title="editingId ? '编辑告警规则' : '新建告警规则'"
      width="760px"
      top="5vh"
      class="rule-dialog"
      destroy-on-close
    >
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="110px">
        <el-form-item label="规则名称" prop="name">
          <el-input v-model="form.name" placeholder="如：5xx-错误率告警" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.description" type="textarea" :rows="2" placeholder="可选：规则用途说明" />
        </el-form-item>
        <el-form-item label="目标服务">
          <el-input v-model="form.service" placeholder="留空 = 全部服务；如 payment-gateway" />
        </el-form-item>
        <el-form-item label="指标" prop="metric">
          <el-input v-model="form.metric" placeholder="如 http_error_rate / jvm_heap_used / mq_lag" />
        </el-form-item>
        <el-form-item label="比较符" prop="operator">
          <el-select v-model="form.operator" style="width: 100%">
            <el-option label="大于 (>)" value="gt" />
            <el-option label="小于 (<)" value="lt" />
          </el-select>
        </el-form-item>
        <el-form-item label="阈值" prop="threshold">
          <el-input-number v-model="form.threshold" :controls="false" style="width: 100%" placeholder="如 5" />
        </el-form-item>
        <el-form-item label="持续秒数">
          <el-input-number v-model="form.durationSeconds" :min="0" :step="10" style="width: 100%" />
          <span class="rule-form-hint">指标持续超过阈值 N 秒才触发</span>
        </el-form-item>
        <el-form-item label="静默期(秒)">
          <el-input-number v-model="form.silenceSeconds" :min="0" :step="60" style="width: 100%" />
          <span class="rule-form-hint">触发后静默期内不重复告警</span>
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="form.enabled" />
        </el-form-item>

        <!-- ★ P0 规格 4：升级策略（多级路径编辑器） -->
        <el-divider content-position="left">升级策略（未确认 / 未恢复自动升级）</el-divider>
        <el-form-item label="开启升级">
          <el-switch v-model="form.escalationEnabled" />
          <span class="rule-form-hint">默认开启：告警触发后长时间无人处置，自动按级别逐级升级提醒（规格 4 核心决策 4）</span>
        </el-form-item>

        <template v-if="form.escalationEnabled">
          <!-- 升级级别列表 -->
          <el-form-item label="升级路径">
            <div class="esc-levels">
              <div v-for="(lv, idx) in form.escalationLevels" :key="idx" class="esc-level-card">
                <div class="esc-level-hd">
                  <span class="esc-level-no">Level {{ idx + 1 }}</span>
                  <span class="esc-level-note">触发后第 {{ idx + 1 }} 级升级</span>
                  <el-button v-if="form.escalationLevels.length > 1" link type="danger" :icon="Delete"
                    @click="removeLevel(idx)">删除</el-button>
                </div>
                <div class="esc-level-row">
                  <div class="esc-field">
                    <div class="esc-lab">after 时间</div>
                    <el-select v-model="lv.afterMinutes" style="width: 100%">
                      <el-option v-for="m in AFTER_PRESETS" :key="m" :label="m + ' 分钟'" :value="m" />
                      <el-option :value="lv.afterMinutes" v-if="lv.afterMinutes && !AFTER_PRESETS.includes(lv.afterMinutes)"
                        :label="lv.afterMinutes + ' 分钟'" />
                    </el-select>
                  </div>
                  <div class="esc-field">
                    <div class="esc-lab">触发条件</div>
                    <el-select v-model="lv.triggerOn" style="width: 100%">
                      <el-option label="未确认（UNACKNOWLEDGED）" value="UNACKNOWLEDGED" />
                      <el-option label="未恢复（UNRESOLVED）" value="UNRESOLVED" />
                    </el-select>
                  </div>
                  <div class="esc-field">
                    <div class="esc-lab">通知角色</div>
                    <el-select v-model="lv.toRole" style="width: 100%" clearable placeholder="选择角色（与用户二选一）">
                      <el-option label="OPERATOR（值班）" value="OPERATOR" />
                      <el-option label="ADMIN（管理员）" value="ADMIN" />
                    </el-select>
                  </div>
                  <div class="esc-field esc-field-users">
                    <div class="esc-lab">通知用户（可选）</div>
                    <el-select v-model="lv.toUsers" multiple filterable style="width: 100%" placeholder="可多选具体用户">
                      <el-option v-for="u in userOptions" :key="u.username" :label="u.displayName ? `${u.displayName}（${u.username}）` : u.username"
                        :value="u.username" />
                    </el-select>
                  </div>
                </div>
              </div>
              <el-button class="esc-add" :icon="Plus" @click="addLevel">新增升级级别</el-button>
              <div class="esc-tip">
                级别按 after 时间严格递增（1 分钟 ~ 24 小时）；系统每 30 秒扫描一次，满足条件自动升级并记录时间线（规格 4.4）。
              </div>
            </div>
          </el-form-item>
        </template>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Search, InfoFilled, Delete } from '@element-plus/icons-vue'
import {
  listAlertRules, createAlertRule, updateAlertRule, setAlertRuleEnabled, deleteAlertRule,
} from '@/api/alerts'
import { listUsers } from '@/api/user'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const canWrite = computed(() => auth.isOperator)

const loading = ref(false)
const rows = ref([])
const filters = reactive({ keyword: '', service: '', enabled: '' })
const serviceOptions = ref([])

// 用户列表（升级通知目标，规格 4.1 toUsers）
const userOptions = ref([])
async function loadUsers() {
  try {
    userOptions.value = (await listUsers({})) || []
  } catch {
    userOptions.value = []
  }
}

const AFTER_PRESETS = [1, 2, 3, 5, 10, 15, 30, 60]

async function loadRules() {
  loading.value = true
  try {
    const params = {
      service: filters.service || undefined,
      enabled: filters.enabled === '' ? undefined : !!filters.enabled,
    }
    const list = await listAlertRules(params)
    rows.value = list || []
    if (filters.keyword) {
      const kw = filters.keyword.toLowerCase()
      rows.value = rows.value.filter(
        (r) => (r.name || '').toLowerCase().includes(kw) ||
          (r.service || '').toLowerCase().includes(kw) ||
          (r.metric || '').toLowerCase().includes(kw)
      )
    }
    const set = new Set(serviceOptions.value)
    rows.value.forEach((r) => r.service && set.add(r.service))
    serviceOptions.value = Array.from(set).sort()
  } catch (e) {
    ElMessage.error(e.message || '加载规则失败')
  } finally {
    loading.value = false
  }
}

function ruleMeta(row) {
  const parts = []
  if (row.durationSeconds) parts.push(`持续 ${row.durationSeconds} 秒`)
  if (row.silenceSeconds) parts.push(`${fmtDur(row.silenceSeconds)}内不重复告警`)
  return parts.join(' · ')
}

function fmtDur(sec) {
  if (sec == null) return '-'
  if (sec % 60 === 0) return `${sec / 60} 分钟`
  return `${sec} 秒`
}

function opLabel(op) {
  if (op === 'gt') return '>'
  if (op === 'lt') return '<'
  return op || '-'
}

function roleLabel(role) {
  if (role === 'OPERATOR') return 'OPERATOR'
  if (role === 'ADMIN') return 'ADMIN'
  return role || ''
}

function escalationTooltip(row) {
  const lines = (row.escalationLevels || []).map((lv, i) =>
    `L${i + 1}：触发后 ${fmtDur(lv.afterSeconds)} · ${lv.triggerOn === 'UNRESOLVED' ? '未恢复' : '未确认'} → ${roleLabel(lv.toRole) || '指定用户'}${lv.toUsers && lv.toUsers.length ? ` + ${lv.toUsers.join(',')}` : ''}`
  )
  return `升级路径：\n${lines.join('\n')}`
}

function handleReset() {
  filters.keyword = ''
  filters.service = ''
  filters.enabled = ''
  loadRules()
}

async function handleToggle(row, val) {
  try {
    await setAlertRuleEnabled(row.id, val)
    row.enabled = val
    ElMessage.success(val ? '已启用' : '已停用')
  } catch (e) {
    ElMessage.error(e.message || '操作失败')
  }
}

// ---- 新建 / 编辑 ----
const dialogVisible = ref(false)
const editingId = ref(null)
const saving = ref(false)
const formRef = ref()

// 规格 4 默认路径：L1 5m→OPERATOR（未确认），L2 15m→ADMIN（未确认）
function defaultLevels() {
  return [
    { afterMinutes: 5, afterSeconds: 300, triggerOn: 'UNACKNOWLEDGED', toRole: 'OPERATOR', toUsers: [] },
    { afterMinutes: 15, afterSeconds: 900, triggerOn: 'UNACKNOWLEDGED', toRole: 'ADMIN', toUsers: [] },
  ]
}

const emptyForm = () => ({
  name: '', description: '', service: '', metric: '', operator: 'gt',
  threshold: null, durationSeconds: 60, silenceSeconds: 0, enabled: true,
  escalationEnabled: true, escalationLevels: defaultLevels(),
})
const form = reactive(emptyForm())

const formRules = {
  name: [{ required: true, message: '请输入规则名称', trigger: 'blur' }],
  metric: [{ required: true, message: '请输入指标', trigger: 'blur' }],
  operator: [{ required: true, message: '请选择比较符', trigger: 'change' }],
  threshold: [{ required: true, message: '请输入阈值', trigger: 'blur' }],
}

function resetForm(data) {
  Object.assign(form, emptyForm(), data || {})
}

function openCreate() {
  editingId.value = null
  resetForm()
  dialogVisible.value = true
}

function openEdit(row) {
  editingId.value = row.id
  const levels = (row.escalationLevels || []).map((lv) => ({
    afterMinutes: Math.max(1, Math.round((lv.afterSeconds || 300) / 60)),
    afterSeconds: lv.afterSeconds || 300,
    triggerOn: lv.triggerOn || 'UNACKNOWLEDGED',
    toRole: lv.toRole || null,
    toUsers: lv.toUsers || [],
  }))
  resetForm({
    name: row.name, description: row.description || '', service: row.service || '',
    metric: row.metric, operator: row.operator || 'gt', threshold: row.threshold,
    durationSeconds: row.durationSeconds ?? 60, silenceSeconds: row.silenceSeconds ?? 0,
    enabled: row.enabled !== false,
    escalationEnabled: row.escalationEnabled !== false,
    escalationLevels: levels.length ? levels : defaultLevels(),
  })
  dialogVisible.value = true
}

function addLevel() {
  const prev = form.escalationLevels[form.escalationLevels.length - 1]
  const nextMin = prev ? Math.min(prev.afterMinutes + 5, 24 * 60) : 5
  form.escalationLevels.push({
    afterMinutes: nextMin,
    afterSeconds: nextMin * 60,
    triggerOn: 'UNACKNOWLEDGED',
    toRole: form.escalationLevels.length >= 2 ? null : 'OPERATOR',
    toUsers: [],
  })
}

function removeLevel(idx) {
  form.escalationLevels.splice(idx, 1)
}

// 规格 4.1 校验：至少 1 级、after 1m~24h 严格递增、toRole/toUsers 至少一个
function validateEscalation() {
  const levels = form.escalationLevels
  if (levels.length === 0) {
    ElMessage.warning('升级路径至少需要 1 个级别')
    return false
  }
  let prev = 0
  for (let i = 0; i < levels.length; i++) {
    const lv = levels[i]
    const sec = Math.max(60, Math.min((lv.afterMinutes || 0) * 60, 24 * 3600))
    if (sec <= prev) {
      ElMessage.warning(`Level ${i + 1} 的 after 时间必须大于上一级（严格递增）`)
      return false
    }
    prev = sec
    if (!lv.triggerOn) {
      ElMessage.warning(`请选择 Level ${i + 1} 的触发条件`)
      return false
    }
    if (!lv.toRole && (!lv.toUsers || lv.toUsers.length === 0)) {
      ElMessage.warning(`Level ${i + 1} 需要至少选择一个通知角色或用户`)
      return false
    }
  }
  return true
}

async function handleSave() {
  try {
    await formRef.value.validate()
  } catch {
    return
  }
  if (form.escalationEnabled && !validateEscalation()) return
  saving.value = true
  try {
    const levels = form.escalationEnabled
      ? form.escalationLevels.map((lv) => ({
          afterSeconds: Math.max(60, Math.min((lv.afterMinutes || 0) * 60, 24 * 3600)),
          triggerOn: lv.triggerOn,
          toRole: lv.toRole || null,
          toUsers: lv.toUsers || [],
          channelIds: [],
        }))
      : []
    const payload = {
      name: form.name, description: form.description, service: form.service || null,
      metric: form.metric, operator: form.operator, threshold: form.threshold,
      compareMode: 'THRESHOLD', durationSeconds: form.durationSeconds,
      silenceSeconds: form.silenceSeconds, enabled: form.enabled,
      escalationEnabled: form.escalationEnabled,
      escalationLevels: levels,
    }
    if (editingId.value) {
      await updateAlertRule(editingId.value, payload)
      ElMessage.success('规则已更新')
    } else {
      await createAlertRule(payload)
      ElMessage.success('规则已创建')
    }
    dialogVisible.value = false
    loadRules()
  } catch (e) {
    ElMessage.error(e.message || '保存失败')
  } finally {
    saving.value = false
  }
}

async function handleDelete(row) {
  try {
    await ElMessageBox.confirm(`确定删除规则"${row.name}"？删除后关联告警事件保留。`, '删除规则', {
      type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消',
    })
    await deleteAlertRule(row.id)
    ElMessage.success('已删除')
    loadRules()
  } catch (e) {
    if (e && e.message) ElMessage.error(e.message)
  }
}

onMounted(() => {
  loadRules()
  loadUsers()
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

.rule-filter-row {
  display: flex;
  gap: 10px;
  margin-bottom: 14px;
  flex-wrap: wrap;
  align-items: center;
}

.rule-name {
  font-weight: 600;
  font-size: 13.5px;
  color: var(--text-primary);
}

.rule-meta {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 2px;
}

.rule-expr {
  font-family: ui-monospace, monospace;
  font-size: 13px;
  color: var(--text-secondary);
}

.rule-expr b { color: var(--primary); }

.rule-sec {
  font-size: 12.5px;
  color: var(--text-secondary);
}

/* 升级策略展示（规格 4） */
.rule-escalation {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.rule-esc-item {
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.rule-esc-item b {
  display: inline-block;
  font-size: 11px;
  color: #B45309;
  background: rgba(217, 119, 6, 0.12);
  border-radius: 4px;
  padding: 0 5px;
  margin-right: 3px;
}

.rule-tip {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  padding: 12px 14px;
  border-radius: 10px;
  background: rgba(30, 64, 175, 0.05);
  border: 1px solid rgba(30, 64, 175, 0.1);
  color: var(--text-secondary);
  font-size: 12.5px;
  line-height: 1.6;
  margin-top: 16px;
}

.rule-form-hint {
  display: block;
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.4;
  margin-top: 4px;
}

/* 多级升级编辑器 */
.esc-levels {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.esc-level-card {
  border: 1px solid rgba(226, 232, 240, 0.9);
  border-radius: 10px;
  padding: 12px 14px;
  background: #FAFBFC;
}

.esc-level-hd {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.esc-level-no {
  font-weight: 700;
  font-size: 13px;
  color: var(--primary);
}

.esc-level-note {
  flex: 1;
  font-size: 12px;
  color: var(--text-muted);
}

.esc-level-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.esc-field {
  min-width: 0;
}

.esc-field .esc-lab {
  font-size: 11.5px;
  color: var(--text-muted);
  margin-bottom: 4px;
}

.esc-add {
  width: 100%;
  border-style: dashed;
}

.esc-tip {
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.6;
}

/* 弹窗固定高度：内容区滚动，底部按钮始终可见 */
:global(.rule-dialog) {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 10vh - 40px);
  max-height: 820px;
  max-width: calc(100vw - 32px);
  margin-bottom: 0;
}

:global(.rule-dialog .el-dialog__body) {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-top: 8px;
}

:global(.rule-dialog .el-dialog__footer) {
  flex-shrink: 0;
  border-top: 1px solid var(--border);
  padding-top: 12px;
}
</style>
