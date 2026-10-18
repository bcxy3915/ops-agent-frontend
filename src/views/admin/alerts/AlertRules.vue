<template>
  <div class="page">
    <!-- ========== 页头 ========== -->
    <div class="page-header">
      <div class="page-header-left">
        <h2 class="page-title">告警规则</h2>
        <span class="page-subtitle">阈值触发、通知节流与渠道绑定</span>
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
          <el-table-column label="服务" width="140">
            <template #default="{ row }">
              <span class="rule-sec">{{ row.service || '全部服务' }}</span>
            </template>
          </el-table-column>
          <el-table-column label="通知渠道" width="130">
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
        规则触发后自动抓快照、发通知并调用 LLM 诊断；同一规则在节流窗口内不重复告警，避免告警风暴。
      </div>
    </div>

    <!-- ========== 新建 / 编辑 dialog ========== -->
    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑告警规则' : '新建告警规则'" width="600px" destroy-on-close>
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
import { Plus, Search, InfoFilled } from '@element-plus/icons-vue'
import {
  listAlertRules, createAlertRule, updateAlertRule, setAlertRuleEnabled, deleteAlertRule,
} from '@/api/alerts'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const canWrite = computed(() => auth.isOperator)

const loading = ref(false)
const rows = ref([])
const filters = reactive({ keyword: '', service: '', enabled: '' })
const serviceOptions = ref([])

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
  if (sec % 60 === 0) return `${sec / 60} 分钟`
  return `${sec} 秒`
}

function opLabel(op) {
  if (op === 'gt') return '>'
  if (op === 'lt') return '<'
  return op || '-'
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

const emptyForm = () => ({
  name: '', description: '', service: '', metric: '', operator: 'gt',
  threshold: null, durationSeconds: 60, silenceSeconds: 0, enabled: true,
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
  resetForm({
    name: row.name, description: row.description || '', service: row.service || '',
    metric: row.metric, operator: row.operator || 'gt', threshold: row.threshold,
    durationSeconds: row.durationSeconds ?? 60, silenceSeconds: row.silenceSeconds ?? 0,
    enabled: row.enabled !== false,
  })
  dialogVisible.value = true
}

async function handleSave() {
  try {
    await formRef.value.validate()
  } catch {
    return
  }
  saving.value = true
  try {
    const payload = {
      name: form.name, description: form.description, service: form.service || null,
      metric: form.metric, operator: form.operator, threshold: form.threshold,
      compareMode: 'THRESHOLD', durationSeconds: form.durationSeconds,
      silenceSeconds: form.silenceSeconds, enabled: form.enabled,
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

onMounted(loadRules)
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
</style>
