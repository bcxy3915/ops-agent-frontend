<template>
  <div class="page">
    <!-- ========== 页头 ========== -->
    <div class="page-header">
      <div class="page-header-left">
        <h2 class="page-title">通知渠道</h2>
        <span class="page-subtitle">告警通知的发送目标，支持发送测试验证连通</span>
      </div>
      <div class="page-header-actions">
        <el-button :icon="List" @click="recordsVisible = true">发送记录</el-button>
        <el-button v-if="canWrite" type="primary" :icon="Plus" @click="openCreate">新建渠道</el-button>
      </div>
    </div>

    <div class="page-body">
      <!-- ========== 渠道卡片 ========== -->
      <div v-loading="loading" class="channel-grid">
        <div v-for="c in channels" :key="c.id" class="channel-card">
          <div class="ch-head">
            <span class="ch-ico" :class="icoCls(c.type)">
              <el-icon><component :is="icoIcon(c.type)" /></el-icon>
            </span>
            <div class="ch-info">
              <div class="ch-name">{{ c.name }}</div>
              <div class="ch-d">{{ typeLabel(c.type) }} · {{ c.description || '—' }}</div>
            </div>
            <span class="ch-state" :class="c.enabled ? 'up' : 'down'" :title="c.enabled ? '已启用' : '已停用'"></span>
          </div>
          <div class="ch-cfg">
            <div v-for="(v, k) in displayConfig(c)" :key="k" class="ch-row">
              <span class="k">{{ k }}</span>
              <span class="ch-val">{{ v }}</span>
            </div>
            <div class="ch-row">
              <span class="k">最近发送</span>
              <span :class="lastRecCls(c.lastRecord)">{{ lastRecText(c.lastRecord) }}</span>
            </div>
          </div>
          <div class="ch-actions">
            <el-button v-if="canWrite" style="flex: 1" @click="openEdit(c)">编辑</el-button>
            <el-button v-if="canWrite" style="flex: 1" :loading="testingId === c.id" @click="handleTest(c)">发送测试</el-button>
            <el-switch v-if="canWrite" :model-value="!!c.enabled" @change="(v) => handleToggle(c, v)" />
          </div>
        </div>

        <!-- 添加渠道占位 -->
        <div v-if="canWrite" class="channel-card channel-add" @click="openCreate">
          <div>
            <el-icon :size="26"><Plus /></el-icon>
            <div class="add-t">添加渠道</div>
            <div class="add-d">邮件 / 飞书 / 通用 Webhook</div>
          </div>
        </div>
      </div>

      <div class="ch-tip">
        <el-icon><InfoFilled /></el-icon>
        发送失败自动重试（最多 3 次、指数退避）；通知发送记录可在「发送记录」追溯。敏感配置（密钥、Webhook Token）脱敏展示。
      </div>
    </div>

    <!-- ========== 新建 / 编辑 dialog ========== -->
    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑通知渠道' : '新建通知渠道'" width="600px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="110px">
        <el-form-item label="渠道名称" prop="name">
          <el-input v-model="form.name" placeholder="如：运维值班群机器人" />
        </el-form-item>
        <el-form-item label="渠道类型" prop="type">
          <el-radio-group v-model="form.type" @change="onTypeChange">
            <el-radio-button value="FEISHU_WEBHOOK">飞书群机器人</el-radio-button>
            <el-radio-button value="EMAIL">邮件</el-radio-button>
            <el-radio-button value="GENERIC_WEBHOOK">通用 Webhook</el-radio-button>
          </el-radio-group>
        </el-form-item>

        <!-- 飞书 -->
        <template v-if="form.type === 'FEISHU_WEBHOOK'">
          <el-form-item label="Webhook URL" prop="webhookUrl">
            <el-input v-model="form.webhookUrl" placeholder="https://open.feishu.cn/open-apis/bot/v2/hook/..." />
          </el-form-item>
        </template>

        <!-- 邮件 -->
        <template v-else-if="form.type === 'EMAIL'">
          <el-form-item label="收件人" prop="recipients">
            <el-input v-model="form.recipients" placeholder="多个收件人用英文逗号分隔" />
          </el-form-item>
          <el-form-item label="主题前缀">
            <el-input v-model="form.subjectPrefix" placeholder="如 [Ops-Agent 告警]" />
          </el-form-item>
        </template>

        <!-- 通用 Webhook -->
        <template v-else>
          <el-form-item label="Webhook URL" prop="webhookUrl">
            <el-input v-model="form.webhookUrl" placeholder="https://hook.internal/alerts" />
          </el-form-item>
        </template>

        <el-form-item label="Secret">
          <el-input v-model="form.secret" type="password" show-password :placeholder="editingId ? '已配置，输入新值可覆盖' : '可选：签名密钥'" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.description" placeholder="可选" />
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

    <!-- ========== 发送记录 dialog ========== -->
    <el-dialog v-model="recordsVisible" title="通知发送记录" width="860px" destroy-on-close>
      <div class="rec-filter">
        <el-select v-model="recStatus" placeholder="全部状态" style="width: 140px" @change="loadRecords">
          <el-option label="全部状态" value="" />
          <el-option label="已送达" value="SUCCESS" />
          <el-option label="失败" value="FAILED" />
          <el-option label="重试中" value="RETRYING" />
        </el-select>
        <el-button @click="loadRecords">刷新</el-button>
      </div>
      <el-table v-loading="recLoading" :data="records" max-height="480" stripe>
        <el-table-column label="时间" width="150">
          <template #default="{ row }">{{ fmtTime(row.sentAt || row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="渠道" width="140">
          <template #default="{ row }">{{ row.channelName || row.channelType }}</template>
        </el-table-column>
        <el-table-column label="标题" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">{{ row.title || '-' }}</template>
        </el-table-column>
        <el-table-column label="目标" min-width="140" show-overflow-tooltip>
          <template #default="{ row }">{{ row.target || '-' }}</template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag size="small" :type="recTagType(row.status)">{{ recLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="重试" width="90">
          <template #default="{ row }">{{ row.retryCount }}/{{ row.maxRetry || 3 }}</template>
        </el-table-column>
        <el-table-column label="错误信息" min-width="150" show-overflow-tooltip>
          <template #default="{ row }">{{ row.errorMessage || '-' }}</template>
        </el-table-column>
      </el-table>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Search, List, InfoFilled, Message, ChatDotRound, Connection } from '@element-plus/icons-vue'
import {
  listNotificationChannels, createNotificationChannel, updateNotificationChannel,
  setNotificationChannelEnabled, testNotificationChannel, listNotificationRecords,
} from '@/api/notifications'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const canWrite = computed(() => auth.isOperator)

const loading = ref(false)
const channels = ref([])

// ---- 类型映射 ----
const TYPE_LABEL = {
  FEISHU_WEBHOOK: '飞书群机器人',
  EMAIL: '邮件',
  GENERIC_WEBHOOK: '通用 Webhook',
}
function typeLabel(t) { return TYPE_LABEL[t] || t || '-' }
function icoIcon(t) {
  if (t === 'EMAIL') return Message
  if (t === 'FEISHU_WEBHOOK') return ChatDotRound
  return Connection
}
function icoCls(t) {
  if (t === 'EMAIL') return 'ch-mail'
  if (t === 'FEISHU_WEBHOOK') return 'ch-feishu'
  return 'ch-webhook'
}

// ---- 配置解析与脱敏展示 ----
function parseConfig(c) {
  try {
    return c.config ? JSON.parse(c.config) : {}
  } catch {
    return { raw: c.config || '' }
  }
}

function maskSecret(v) {
  if (!v) return ''
  if (v.includes('*')) return v
  return '••••••••'
}

function displayConfig(c) {
  const cfg = parseConfig(c)
  const out = {}
  if (c.type === 'EMAIL') {
    out['收件人'] = cfg.recipients || '-'
    if (cfg.subjectPrefix) out['主题前缀'] = cfg.subjectPrefix
  } else if (c.type === 'FEISHU_WEBHOOK') {
    out['Webhook'] = maskUrl(cfg.webhookUrl) || '-'
  } else if (c.type === 'GENERIC_WEBHOOK') {
    out['URL'] = maskUrl(cfg.webhookUrl || cfg.url) || '-'
  }
  if (cfg.secret) out['Secret'] = maskSecret(cfg.secret)
  return out
}

function maskUrl(u) {
  if (!u) return ''
  try {
    const url = new URL(u)
    const host = url.hostname
    return `${host}${url.pathname.length > 12 ? url.pathname.slice(0, 12) + '…' : url.pathname}`
  } catch {
    return u.length > 24 ? u.slice(0, 24) + '…' : u
  }
}

// ---- 最近发送 ----
function lastRecText(rec) {
  if (!rec) return '暂无记录'
  const t = fmtShort(rec.sentAt || rec.createdAt)
  const st = recLabel(rec.status)
  return `${t} · ${st}`
}
function lastRecCls(rec) {
  if (!rec) return ''
  if (rec.status === 'SUCCESS' || rec.status === 'SENT') return 'rec-ok'
  if (rec.status === 'RETRYING' || rec.status === 'PENDING') return 'rec-warn'
  return 'rec-fail'
}

async function loadChannels() {
  loading.value = true
  try {
    channels.value = (await listNotificationChannels()) || []
    // 并行拉最近一条发送记录
    await Promise.all(
      channels.value.map(async (c) => {
        try {
          const recs = (await listNotificationRecords({ channelId: c.id, limit: 1 })) || []
          c.lastRecord = recs[0] || null
        } catch {
          c.lastRecord = null
        }
      })
    )
  } catch (e) {
    ElMessage.error(e.message || '加载渠道失败')
  } finally {
    loading.value = false
  }
}

async function handleToggle(c, val) {
  try {
    await setNotificationChannelEnabled(c.id, val)
    c.enabled = val
    ElMessage.success(val ? '已启用' : '已停用')
  } catch (e) {
    ElMessage.error(e.message || '操作失败')
  }
}

async function handleTest(c) {
  testingId.value = c.id
  try {
    const rec = await testNotificationChannel(c.id)
    if (rec && (rec.status === 'SUCCESS' || rec.status === 'SENT')) {
      ElMessage.success(`测试发送成功 → ${rec.target || c.name}`)
    } else {
      ElMessage.warning(`测试发送${recLabel(rec?.status)}：${rec?.errorMessage || '请查看发送记录'}`)
    }
    loadChannels()
  } catch (e) {
    ElMessage.error(e.message || '测试发送失败')
  } finally {
    testingId.value = null
  }
}

// ---- 新建 / 编辑 ----
const dialogVisible = ref(false)
const editingId = ref(null)
const saving = ref(false)
const formRef = ref()
const testingId = ref(null)

const emptyForm = () => ({
  name: '', type: 'FEISHU_WEBHOOK', webhookUrl: '', recipients: '',
  subjectPrefix: '', secret: '', description: '', enabled: true,
})
const form = reactive(emptyForm())

const formRules = {
  name: [{ required: true, message: '请输入渠道名称', trigger: 'blur' }],
  type: [{ required: true, message: '请选择渠道类型', trigger: 'change' }],
  webhookUrl: [{
    validator: (_, v, cb) => {
      if (form.type !== 'EMAIL' && !v) return cb(new Error('请输入 Webhook URL'))
      cb()
    }, trigger: 'blur',
  }],
  recipients: [{
    validator: (_, v, cb) => {
      if (form.type === 'EMAIL' && !v) return cb(new Error('请输入收件人'))
      cb()
    }, trigger: 'blur',
  }],
}

function resetForm(data) {
  Object.assign(form, emptyForm(), data || {})
}

function onTypeChange() {
  form.webhookUrl = ''
  form.recipients = ''
}

function openCreate() {
  editingId.value = null
  resetForm()
  dialogVisible.value = true
}

function openEdit(c) {
  editingId.value = c.id
  const cfg = parseConfig(c)
  resetForm({
    name: c.name, type: c.type,
    webhookUrl: cfg.webhookUrl || cfg.url || '',
    recipients: cfg.recipients || '',
    subjectPrefix: cfg.subjectPrefix || '',
    secret: '',
    description: c.description || '',
    enabled: c.enabled !== false,
  })
  dialogVisible.value = true
}

function buildConfig() {
  const cfg = {}
  if (form.type === 'EMAIL') {
    cfg.recipients = form.recipients
    if (form.subjectPrefix) cfg.subjectPrefix = form.subjectPrefix
  } else {
    cfg.webhookUrl = form.webhookUrl
  }
  if (form.secret) cfg.secret = form.secret
  return JSON.stringify(cfg)
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
      name: form.name, type: form.type, enabled: form.enabled,
      config: buildConfig(), description: form.description,
    }
    if (editingId.value) {
      await updateNotificationChannel(editingId.value, payload)
      ElMessage.success('渠道已更新')
    } else {
      await createNotificationChannel(payload)
      ElMessage.success('渠道已创建')
    }
    dialogVisible.value = false
    loadChannels()
  } catch (e) {
    ElMessage.error(e.message || '保存失败')
  } finally {
    saving.value = false
  }
}

// ---- 发送记录 ----
const recordsVisible = ref(false)
const recLoading = ref(false)
const recStatus = ref('')
const records = ref([])

async function loadRecords() {
  recLoading.value = true
  try {
    records.value = (await listNotificationRecords({
      status: recStatus.value || undefined, limit: 100,
    })) || []
  } catch (e) {
    ElMessage.error(e.message || '加载发送记录失败')
  } finally {
    recLoading.value = false
  }
}

const REC_LABEL = { SUCCESS: '已送达', SENT: '已送达', FAILED: '失败', RETRYING: '重试中', PENDING: '待发送' }
function recLabel(s) { return REC_LABEL[s] || s || '-' }
function recTagType(s) {
  if (s === 'SUCCESS' || s === 'SENT') return 'success'
  if (s === 'RETRYING' || s === 'PENDING') return 'warning'
  return 'danger'
}

function fmtTime(t) {
  if (!t) return '-'
  const d = new Date(t)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}
function fmtShort(t) {
  if (!t) return '-'
  const d = new Date(t)
  const p = (n) => String(n).padStart(2, '0')
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

onMounted(() => {
  loadChannels()
  loadRecords()
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

/* ============ 渠道卡片网格 ============ */
.channel-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 14px;
  min-height: 120px;
}

.channel-card {
  background: rgba(255, 255, 255, 0.85);
  border: 1px solid rgba(226, 232, 240, 0.8);
  border-radius: 12px;
  padding: 16px;
  transition: all 0.2s;
  box-shadow: 0 1px 3px rgba(30, 64, 175, 0.04);
}

.channel-card:hover {
  border-color: rgba(30, 64, 175, 0.2);
  box-shadow: 0 6px 16px rgba(30, 64, 175, 0.08);
}

.ch-head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.ch-ico {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 19px;
  flex-shrink: 0;
}

.ch-mail { background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%); }
.ch-feishu { background: linear-gradient(135deg, #3B82F6 0%, #1E40AF 100%); }
.ch-webhook { background: linear-gradient(135deg, #818CF8 0%, #4F46E5 100%); }

.ch-info { flex: 1; min-width: 0; }

.ch-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.ch-d {
  font-size: 12px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ch-state {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.ch-state.up { background: #10B981; box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.15); }
.ch-state.down { background: #CBD5E1; box-shadow: 0 0 0 3px rgba(203, 213, 225, 0.2); }

.ch-cfg {
  background: #F8FAFC;
  border-radius: 8px;
  padding: 10px 12px;
  margin-bottom: 12px;
}

.ch-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  font-size: 12px;
  padding: 3px 0;
}

.ch-row .k {
  color: var(--text-muted);
  flex-shrink: 0;
  width: 64px;
}

.ch-val {
  color: var(--text-secondary);
  font-family: ui-monospace, monospace;
  word-break: break-all;
}

.rec-ok { color: var(--success); }
.rec-warn { color: var(--warning); }
.rec-fail { color: var(--danger); }

.ch-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ch-actions .el-button {
  margin-left: 0;
}

/* 添加占位卡 */
.channel-add {
  border-style: dashed;
  border-color: #CBD5E1;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  text-align: center;
  color: #94A3B8;
  min-height: 170px;
}

.channel-add:hover {
  color: var(--primary);
  border-color: var(--primary);
}

.add-t {
  margin-top: 8px;
  font-weight: 600;
  font-size: 14px;
  color: var(--text-secondary);
}

.add-d {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 2px;
}

.ch-tip {
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
  margin-top: 18px;
}

/* ============ 发送记录 ============ */
.rec-filter {
  display: flex;
  gap: 10px;
  margin-bottom: 12px;
}
</style>
