<template>
  <div class="page">
    <div class="page-body">
      <!-- 返回 -->
      <div class="back-link" @click="$router.push('/admin/alerts')">
        <el-icon><ArrowLeft /></el-icon>
        返回告警中心
      </div>

      <el-skeleton v-if="loading" :rows="8" animated />

      <template v-else-if="event">
        <!-- ========== 告警头 ========== -->
        <div class="kb-card" style="margin-bottom: 16px">
          <div class="al-head">
            <div class="al-head-main">
              <h3 class="al-head-title">
                {{ event.ruleName || event.metric }}
                <el-tag size="small" :type="statusTagType(event.status)">{{ statusLabel(event.status) }}</el-tag>
                <el-tag v-if="diag" size="small" type="success" effect="light">AI 已诊断</el-tag>
              </h3>
              <div class="al-head-meta">
                <span>规则：{{ event.ruleName || '-' }}</span>
                <span>服务：{{ event.service }}</span>
                <span>告警 #{{ event.id }}</span>
                <span>触发 {{ fmtTime(event.firedAt) }}</span>
              </div>
            </div>
            <div class="al-head-actions">
              <el-button v-if="canWrite && ['FIRING', 'SILENCED'].includes(event.status)" type="warning"
                @click="handleAck">确认告警</el-button>
              <el-button type="primary" @click="goChat">带上下文去对话追问</el-button>
            </div>
          </div>

          <!-- 链路 -->
          <div class="al-flow">
            <div class="al-flow-node active"><span class="al-flow-dot">✓</span>告警</div>
            <span class="al-flow-line"></span>
            <div class="al-flow-node" :class="{ active: snapshot }"><span class="al-flow-dot">✓</span>快照</div>
            <span class="al-flow-line"></span>
            <div class="al-flow-node" :class="{ active: diag }"><span class="al-flow-dot">✓</span>诊断</div>
            <span class="al-flow-line"></span>
            <div class="al-flow-node" :class="{ active: isAcked }"><span class="al-flow-dot">✓</span>处置</div>
            <span class="al-flow-line"></span>
            <div class="al-flow-node" :class="{ active: event.status === 'RESOLVED' }">
              <span class="al-flow-dot">…</span>恢复 / 沉淀
            </div>
          </div>

          <div class="al-kvgrid">
            <div class="al-kv"><div class="k">指标</div><div class="v">{{ event.metric }}</div></div>
            <div class="al-kv"><div class="k">阈值</div><div class="v">{{ event.operator }} {{ event.threshold }}</div></div>
            <div class="al-kv"><div class="k">当前值</div><div class="v" :class="{ bad: event.status === 'FIRING' }">{{ event.currentValue }}</div></div>
            <div class="al-kv"><div class="k">状态</div><div class="v">{{ statusLabel(event.status) }}</div></div>
          </div>
        </div>

        <div class="detail-grid">
          <!-- ========== 左列：AI 诊断 + 快照 ========== -->
          <div>
            <!-- AI 诊断 -->
            <div class="kb-card" style="margin-bottom: 16px">
              <div class="al-card-hd">
                <div class="al-card-title">
                  <el-icon color="var(--teal)"><Cpu /></el-icon>
                  AI 智能诊断
                </div>
                <span v-if="diag" class="al-conf-tag" :class="confCls(diag.confidence)">置信度 {{ diag.confidence || 0 }}%</span>
              </div>
              <div class="al-card-bd">
                <div v-if="diag">
                  <div class="al-diag-headline">
                    <div class="al-score-ring" :style="{ '--pct': diag.confidence || 0, '--ring': confColor(diag.confidence) }">
                      <span>{{ diag.confidence || 0 }}%</span>
                    </div>
                    <div class="al-diag-note">AI 结合指标快照、知识库手册与历史案例推断，根因建议人工确认后再执行处置。</div>
                  </div>

                  <div class="al-block">
                    <div class="al-lab">推断根因</div>
                    <div class="al-text">{{ diag.rootCause || '暂无根因结论' }}</div>
                  </div>
                  <div v-if="diag.evidence && diag.evidence.length" class="al-block">
                    <div class="al-lab">证据</div>
                    <ul class="al-list">
                      <li v-for="(e, i) in diag.evidence" :key="i">{{ e }}</li>
                    </ul>
                  </div>
                  <div v-if="diag.suggestions && diag.suggestions.length" class="al-block">
                    <div class="al-lab">建议处置</div>
                    <ol class="al-list">
                      <li v-for="(s, i) in diag.suggestions" :key="i">{{ s }}</li>
                    </ol>
                  </div>
                  <div v-if="diag.errorMessage" class="al-err">{{ diag.errorMessage }}</div>

                  <div class="al-tip">
                    <el-icon><InfoFilled /></el-icon>
                    诊断摘要与建议由 LLM 结合实时快照与知识库生成，关键结论可溯源，处置前请结合现场确认。
                  </div>

                  <div class="al-card-actions">
                    <el-button @click="followVisible = true">基于此告警继续追问</el-button>
                    <el-button v-if="canWrite && ['FIRING', 'SILENCED'].includes(event.status)" type="primary"
                      @click="handleAck">采纳并确认告警</el-button>
                  </div>
                </div>
                <el-empty v-else description="暂无 AI 诊断" :image-size="80">
                  <el-button v-if="canWrite && snapshot" :loading="diagLoading" @click="handleTriggerDiag">基于快照触发诊断</el-button>
                </el-empty>
              </div>
            </div>

            <!-- 故障快照 -->
            <div class="kb-card">
              <div class="al-card-hd">
                <div class="al-card-title">
                  <el-icon color="var(--primary)"><Camera /></el-icon>
                  故障快照（告警瞬间现场）
                </div>
                <span v-if="snapshot" class="al-muted">采集于 {{ fmtTime(snapshot.createdAt) }} · snapshot #{{ snapshot.id }}</span>
              </div>
              <div class="al-card-bd">
                <div v-if="snapshotData" class="al-snap-grid">
                  <div v-for="(val, key) in snapshotData" :key="key" class="al-snap-item">
                    <div class="k">{{ key }}</div>
                    <div class="v">{{ displayValue(val) }}</div>
                  </div>
                </div>
                <el-empty v-else-if="!snapshot" description="暂无故障快照" :image-size="70" />
                <details v-if="snapshotData" class="al-snap-json">
                  <summary>查看快照原始 JSON</summary>
                  <pre>{{ snapshotJson }}</pre>
                </details>
              </div>
            </div>
          </div>

          <!-- ========== 右列：通知 + 处置 + 沉淀 ========== -->
          <div>
            <!-- 通知记录 -->
            <div class="kb-card" style="margin-bottom: 16px">
              <div class="al-card-hd">
                <div class="al-card-title">通知记录</div>
                <el-button link type="primary" @click="$router.push('/admin/channels')">渠道配置</el-button>
              </div>
              <div class="al-card-bd">
                <div v-if="records.length" class="al-timeline">
                  <div v-for="r in records" :key="r.id" class="al-tl-item">
                    <span class="al-tl-dot" :class="dotCls(r.status)"></span>
                    <div class="al-tl-t">{{ r.channelName || r.channelType }}
                      <el-tag size="small" :type="recTagType(r.status)">{{ recLabel(r.status) }}</el-tag>
                    </div>
                    <div class="al-tl-d">{{ r.target || '-' }}{{ recNote(r) }}</div>
                    <div class="al-tl-time">{{ fmtTime(r.sentAt || r.createdAt) }}</div>
                  </div>
                </div>
                <el-empty v-else description="暂无通知记录" :image-size="70" />
              </div>
            </div>

            <!-- 处置与闭环 -->
            <div class="kb-card" style="margin-bottom: 16px">
              <div class="al-card-hd"><div class="al-card-title">处置与闭环</div></div>
              <div class="al-card-bd">
                <div class="al-timeline">
                  <div class="al-tl-item">
                    <span class="al-tl-dot ok"></span>
                    <div class="al-tl-t">{{ diag ? '已触发自动诊断' : '待触发诊断' }}</div>
                    <div class="al-tl-d">{{ diag ? `生成根因/证据/建议（置信度 ${diag.confidence || 0}%）` : '确认告警后可由快照触发诊断' }}</div>
                  </div>
                  <div class="al-tl-item">
                    <span class="al-tl-dot" :class="isAcked ? 'ok' : 'gray'"></span>
                    <div class="al-tl-t">{{ isAcked ? '已确认告警' : '待确认告警 / 执行处置' }}</div>
                    <div class="al-tl-d">确认后记录处置人；恢复后自动生成候选案例</div>
                  </div>
                </div>
              </div>
            </div>

            <!-- 案例沉淀 -->
            <div class="kb-card">
              <div class="al-card-bd">
                <div class="al-card-title" style="margin-bottom: 8px">
                  <el-icon color="var(--warning)"><RefreshLeft /></el-icon>
                  恢复后沉淀案例
                </div>
                <div class="al-case-desc">告警恢复并确认真实根因/有效处置后，系统会生成候选案例，脱敏后一键沉淀进知识库，在相似故障诊断中被引用。</div>
                <el-button type="primary" style="width: 100%" @click="$router.push('/admin/knowledge')">去案例沉淀（知识库）</el-button>
              </div>
            </div>
          </div>
        </div>

        <!-- 追问 dialog -->
        <el-dialog v-model="followVisible" title="继续追问 AI 诊断" width="560px" destroy-on-close>
          <el-input v-model="followQuestion" type="textarea" :rows="4" placeholder="例如：结合快照里活跃线程打满的现象，进一步分析扩容后还有哪些风险？" />
          <template #footer>
            <el-button @click="followVisible = false">取消</el-button>
            <el-button type="primary" :loading="followLoading" @click="handleFollowUp">追问</el-button>
          </template>
        </el-dialog>
      </template>

      <el-empty v-else-if="!loading" description="告警不存在或已删除">
        <el-button @click="$router.push('/admin/alerts')">返回告警中心</el-button>
      </el-empty>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft, Cpu, Camera, InfoFilled, RefreshLeft } from '@element-plus/icons-vue'
import { listAlertEvents, acknowledgeAlertEvent } from '@/api/alerts'
import { listDiagnoses, followUpDiagnosis, triggerDiagnosis } from '@/api/diagnosis'
import { getFailureSnapshot, listFailureSnapshots } from '@/api/snapshot'
import { listNotificationRecords } from '@/api/notifications'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const canWrite = computed(() => auth.isOperator)

const eventId = route.params.id
const loading = ref(true)
const event = ref(null)
const diag = ref(null)
const snapshot = ref(null)
const snapshotData = ref(null)
const snapshotJson = ref('')
const records = ref([])
const diagLoading = ref(false)
const followVisible = ref(false)
const followQuestion = ref('')
const followLoading = ref(false)

const isAcked = computed(() => event.value && event.value.status === 'ACKNOWLEDGED')

const STATUS_LABEL = { FIRING: '待处理', SILENCED: '静默', ACKNOWLEDGED: '已确认', RESOLVED: '已恢复' }
const STATUS_TAG = { FIRING: 'danger', SILENCED: 'warning', ACKNOWLEDGED: 'info', RESOLVED: 'success' }
function statusLabel(s) { return STATUS_LABEL[s] || s || '-' }
function statusTagType(s) { return STATUS_TAG[s] || 'info' }

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

// ---- 通知记录状态 ----
const REC_LABEL = { SUCCESS: '已送达', FAILED: '失败', RETRYING: '重试中', PENDING: '待发送', SENT: '已送达' }
function recLabel(s) { return REC_LABEL[s] || s || '-' }
function recTagType(s) {
  if (s === 'SUCCESS' || s === 'SENT') return 'success'
  if (s === 'RETRYING' || s === 'PENDING') return 'warning'
  return 'danger'
}
function dotCls(s) {
  if (s === 'SUCCESS' || s === 'SENT') return 'ok'
  if (s === 'RETRYING' || s === 'PENDING') return 'warn'
  return 'fail'
}
function recNote(r) {
  if (r.status === 'RETRYING' || r.status === 'FAILED') {
    return ` · ${r.errorMessage || ''}${r.retryCount != null ? `（已重试 ${r.retryCount}/${r.maxRetry || 3}）` : ''}`
  }
  return ''
}

// ---- 快照展示 ----
function displayValue(v) {
  if (v == null) return '-'
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

// ---- 加载 ----
async function load() {
  loading.value = true
  try {
    // 1. 找告警事件（列表接口无单查，全量匹配）
    const list = (await listAlertEvents({ limit: 200 })) || []
    event.value = list.find((e) => String(e.id) === String(eventId)) || null
    if (!event.value) return

    // 2. 诊断
    const diags = (await listDiagnoses({ alertEventId: Number(eventId), limit: 10 })) || []
    diag.value = diags.find((d) => d.status !== 'FAILED') || diags[0] || null

    // 3. 快照：优先用诊断关联，其次按告警事件查
    let snap = null
    if (diag.value && diag.value.snapshotId) {
      try {
        snap = await getFailureSnapshot(diag.value.snapshotId)
      } catch { /* 忽略 */ }
    }
    if (!snap) {
      const snaps = (await listFailureSnapshots({ alertEventId: Number(eventId), limit: 5 })) || []
      snap = snaps[0] || null
    }
    snapshot.value = snap
    if (snap && snap.snapshot) {
      snapshotData.value = snap.snapshot
      snapshotJson.value = JSON.stringify(snap.snapshot, null, 2)
    }

    // 4. 通知记录
    records.value = (await listNotificationRecords({ alertEventId: Number(eventId), limit: 20 })) || []
  } catch (e) {
    ElMessage.error(e.message || '加载告警详情失败')
  } finally {
    loading.value = false
  }
}

async function handleAck() {
  try {
    await ElMessageBox.confirm('确认该告警？确认后将记录处置人。', '确认告警', {
      type: 'warning', confirmButtonText: '确认', cancelButtonText: '取消',
    })
    await acknowledgeAlertEvent(event.value.id)
    ElMessage.success('已确认')
    load()
  } catch (e) {
    if (e && e.message) ElMessage.error(e.message)
  }
}

async function handleTriggerDiag() {
  diagLoading.value = true
  try {
    await triggerDiagnosis(snapshot.value.id)
    ElMessage.success('诊断已触发')
    load()
  } catch (e) {
    ElMessage.error(e.message || '触发诊断失败')
  } finally {
    diagLoading.value = false
  }
}

async function handleFollowUp() {
  const q = (followQuestion.value || '').trim()
  if (!q) {
    ElMessage.warning('请输入追问内容')
    return
  }
  if (!diag.value) return
  followLoading.value = true
  try {
    await followUpDiagnosis(diag.value.id, q)
    ElMessage.success('追问完成')
    followVisible.value = false
    followQuestion.value = ''
    load()
  } catch (e) {
    ElMessage.error(e.message || '追问失败')
  } finally {
    followLoading.value = false
  }
}

function goChat() {
  router.push('/chat')
}

function fmtTime(t) {
  if (!t) return '-'
  const d = new Date(t)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

onMounted(load)
</script>

<style scoped>
.page {
  padding: 20px 24px 32px;
  max-width: 1160px;
  margin: 0 auto;
}

.back-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
  margin-bottom: 14px;
  transition: color 0.15s;
}

.back-link:hover { color: var(--primary); }

/* ============ 告警头 ============ */
.al-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
}

.al-head-title {
  font-size: 17px;
  font-weight: 600;
  margin: 0 0 8px;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  color: var(--text-primary);
}

.al-head-meta {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
  font-size: 12.5px;
  color: var(--text-muted);
}

.al-head-actions {
  display: flex;
  gap: 10px;
  flex-shrink: 0;
}

/* ============ 链路 ============ */
.al-flow {
  display: flex;
  align-items: center;
  margin: 16px 0 4px;
  flex-wrap: wrap;
  gap: 6px;
}

.al-flow-node {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 12.5px;
  color: var(--text-secondary);
}

.al-flow-dot {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--success-bg);
  color: var(--success);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
}

.al-flow-node.active .al-flow-dot {
  background: linear-gradient(135deg, #2563EB, #1E40AF);
  color: #fff;
}

.al-flow-line {
  flex: 0 0 26px;
  height: 2px;
  background: #C7F0DE;
}

/* ============ kv ============ */
.al-kvgrid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-top: 14px;
}

.al-kv {
  background: #F8FAFC;
  border-radius: 8px;
  padding: 10px 12px;
}

.al-kv .k {
  font-size: 11.5px;
  color: var(--text-muted);
  margin-bottom: 3px;
}

.al-kv .v {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  font-family: ui-monospace, monospace;
}

.al-kv .v.bad { color: var(--danger); }

/* ============ 双列布局 ============ */
.detail-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 16px;
}

/* ============ 卡片 ============ */
.al-card-hd {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid rgba(226, 232, 240, 0.6);
}

.al-card-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.al-card-bd { padding: 16px 18px; }

.al-muted { font-size: 12px; color: var(--text-muted); }

.al-conf-tag {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 11.5px;
  font-weight: 600;
}

.conf-high { background: rgba(13, 148, 136, 0.12); color: var(--teal); }
.conf-mid { background: rgba(217, 119, 6, 0.12); color: var(--warning); }
.conf-low { background: rgba(100, 116, 139, 0.1); color: var(--text-muted); }

/* ============ 诊断 ============ */
.al-diag-headline {
  display: flex;
  gap: 16px;
  align-items: center;
  margin-bottom: 14px;
}

.al-score-ring {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  flex-shrink: 0;
  background: conic-gradient(var(--ring) calc(var(--pct) * 1%), #EEF1F6 0);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.al-score-ring::before {
  content: '';
  position: absolute;
  inset: 7px;
  border-radius: 50%;
  background: #fff;
}

.al-score-ring span {
  position: relative;
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
}

.al-diag-note {
  font-size: 12.5px;
  color: var(--text-secondary);
  line-height: 1.7;
}

.al-block { margin-bottom: 14px; }

.al-lab {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  margin-bottom: 6px;
}

.al-text {
  font-size: 13.5px;
  line-height: 1.7;
  color: var(--text-primary);
}

.al-list {
  margin: 0;
  padding-left: 18px;
  font-size: 13px;
  line-height: 1.8;
  color: var(--text-secondary);
}

.al-err {
  padding: 8px 12px;
  border-radius: 8px;
  background: rgba(239, 68, 68, 0.08);
  color: var(--danger);
  font-size: 12.5px;
  margin-bottom: 12px;
}

.al-tip {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  padding: 10px 12px;
  border-radius: 8px;
  background: rgba(30, 64, 175, 0.05);
  border: 1px solid rgba(30, 64, 175, 0.1);
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.6;
  margin-top: 6px;
}

.al-card-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 14px;
}

/* ============ 快照 ============ */
.al-snap-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-bottom: 10px;
}

.al-snap-item {
  background: #F8FAFC;
  border-radius: 8px;
  padding: 8px 10px;
}

.al-snap-item .k {
  font-size: 11px;
  color: var(--text-muted);
  margin-bottom: 2px;
  word-break: break-all;
}

.al-snap-item .v {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  word-break: break-all;
}

.al-snap-json summary {
  cursor: pointer;
  font-size: 12.5px;
  color: var(--primary);
  margin-bottom: 8px;
}

.al-snap-json pre {
  background: #0F172A;
  color: #E2E8F0;
  padding: 12px;
  border-radius: 8px;
  font-size: 12px;
  overflow: auto;
  max-height: 220px;
  font-family: ui-monospace, monospace;
  line-height: 1.6;
}

/* ============ 时间线 ============ */
.al-timeline {
  position: relative;
}

.al-tl-item {
  position: relative;
  padding: 0 0 14px 20px;
}

.al-tl-item::before {
  content: '';
  position: absolute;
  left: 5px;
  top: 12px;
  bottom: 0;
  width: 1px;
  background: #E2E8F0;
}

.al-tl-item:last-child { padding-bottom: 0; }
.al-tl-item:last-child::before { display: none; }

.al-tl-dot {
  position: absolute;
  left: 0;
  top: 4px;
  width: 11px;
  height: 11px;
  border-radius: 50%;
}

.al-tl-dot.ok { background: #10B981; }
.al-tl-dot.warn { background: var(--warning); }
.al-tl-dot.fail { background: var(--danger); }
.al-tl-dot.gray { background: #CBD5E1; }

.al-tl-t {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 6px;
}

.al-tl-d {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 2px;
}

.al-tl-time {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 2px;
}

/* ============ 案例沉淀 ============ */
.al-case-desc {
  font-size: 12.5px;
  color: var(--text-secondary);
  margin-bottom: 12px;
  line-height: 1.6;
}
</style>
