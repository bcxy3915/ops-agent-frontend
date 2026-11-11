<template>
  <el-drawer :model-value="modelValue" title="自主诊断" size="min(850px, 100vw)" class="service-diagnosis-drawer"
    :close-on-click-modal="!running" :close-on-press-escape="!running" :show-close="!running" :before-close="beforeClose" @update:model-value="updateVisible">
    <template #header><div class="drawer-title"><strong>自主诊断</strong><el-tag size="small">只读</el-tag></div></template>
    <div v-if="service" ref="bodyElement" class="diagnosis-body">
      <div class="service-heading"><el-icon><Monitor /></el-icon><div><strong>{{ service.name }}</strong> <el-tag size="small">{{ service.env || '未设置环境' }}</el-tag><p>{{ service.owner || '未设置负责人' }}</p></div></div>
      <template v-if="phase === 'ready'">
        <h3>诊断范围</h3>
        <section class="scope-grid">
          <div><label>目标服务</label>{{ service.name }} · 仅此服务</div>
          <div><label>执行方式</label>按观测反馈选择只读工具</div>
          <div><label>初始检查</label>健康、CPU、连接池指标</div>
          <div><label>补充取证</label>按需查询指标时间窗、绑定日志及业务探针</div>
        </section>
        <el-alert title="本次只读取证并生成报告，不会重启、部署或修改服务。未绑定的数据源将作为证据缺口说明。" type="info" :closable="false" />
        <h3>执行说明</h3>
        <p class="muted">正常检查可直接结束；发现异常后进行多步取证。诊断可能需要数分钟，完整步骤将在完成后展示。</p>
      </template>
      <div v-else-if="running" class="waiting" role="status" aria-live="polite">
        <el-icon class="is-loading"><Loading /></el-icon><h3>正在诊断 {{ service.name }}</h3>
        <p>正在检查服务，并按观测结果补充取证。</p><p class="muted">请保持当前页面打开。当前版本暂不支持中途停止；关闭浏览器也不代表后台任务已取消。</p>
      </div>
      <template v-else-if="phase === 'error'">
        <el-alert :title="uncertain ? '暂未获取到诊断结果' : '诊断请求未完成'" :description="errorText" type="warning" :closable="false" />
        <p v-if="uncertain" class="muted">连接中断或请求失败不代表后台已经停止。请先核对最近任务，再决定是否重新发起。</p>
        <p v-if="uncertain && !canRead" class="muted">当前账号没有任务查询权限，请联系有权限的运维人员核对。</p>
      </template>
      <ServiceDiagnosisReport v-if="phase === 'result' && task" :key="task.id" :task="task" />
      <div v-if="needsConfirmation && !running" class="confirmation">
        <el-alert title="该服务有一次结果待确认的诊断，请勿直接重复发起。" type="warning" :closable="false" />
        <el-checkbox v-model="confirmed">我已核实上一任务已结束，允许重新发起</el-checkbox>
      </div>
      <section v-if="canRead && !running" class="history-section">
        <div class="history-heading"><h3>最近任务</h3><el-button link type="primary" :loading="historyLoading" @click="loadHistory">刷新任务</el-button></div>
        <p class="muted history-note">展示该服务最近 20 条任务，包含规则巡检和自主诊断。</p>
        <p v-if="historyError" class="history-error">{{ historyError }}</p>
        <div v-else-if="historyLoading && !history.length" class="history-empty">正在加载任务…</div>
        <div v-else-if="!history.length" class="history-empty">暂无任务记录</div>
        <button v-for="item in history" :key="item.id" type="button" class="history-row" :disabled="detailLoading" @click="viewTask(item.id)">
          <span>{{ taskTime(item.createdAt) }}<small>{{ item.requestedBy || '—' }} · {{ item.id }}</small></span>
          <el-tag :type="(TASK_STATES[item.status] || {}).type || 'info'">{{ TASK_STATES[item.status]?.label || item.status || '未知状态' }}</el-tag>
        </button>
        <p v-if="detailError" class="history-error">{{ detailError }}</p>
      </section>
    </div>
    <template #footer><div class="drawer-footer"><span>{{ running ? '请等待诊断结果' : '仅作用于当前目标服务' }}</span><div>
      <el-button :disabled="running" @click="updateVisible(false)">关闭</el-button>
      <el-button v-if="canTrigger && phase === 'ready'" type="primary" :disabled="needsConfirmation && !confirmed" @click="start">开始诊断</el-button>
      <el-button v-else-if="canTrigger && !running" :disabled="task?.status === 'RUNNING' || (needsConfirmation && !confirmed)" type="primary" @click="prepare">返回发起页</el-button>
      <el-button v-if="running" type="primary" loading disabled>诊断中…</el-button>
    </div></div></template>
  </el-drawer>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { Loading, Monitor } from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'
import { diagnoseService, getAgentTask, listServiceTasks } from '@/api/agent-tasks'
import ServiceDiagnosisReport from './ServiceDiagnosisReport.vue'
import { TASK_STATES, taskTime } from './diagnosis-format'
const props = defineProps({ modelValue: Boolean, service: { type: Object, default: null } })
const emit = defineEmits(['update:modelValue'])
const auth = useAuthStore()
const canTrigger = computed(() => auth.hasPermission('service:read') && auth.hasPermission('diagnosis:trigger'))
const canRead = computed(() => auth.hasPermission('service:read') && auth.hasPermission('diagnosis:read'))
const bodyElement = ref(null)
const phase = ref('ready')
const running = computed(() => phase.value === 'running')
const task = ref(null)
const history = ref([])
const historyLoading = ref(false)
const historyError = ref('')
const detailLoading = ref(false)
const detailError = ref('')
const errorText = ref('')
const uncertain = ref(false)
const confirmed = ref(false)
const pendingServices = ref(new Set())
const needsConfirmation = computed(() => pendingServices.value.has(props.service?.id))
let generation = 0
let historyVersion = 0
let detailVersion = 0

/**
 * 清理本次抽屉状态，使旧请求无法写入新的服务或身份。
 * 无入参。
 * @returns {void} 无返回值
 */
function reset() {
  generation++; historyVersion++; detailVersion++
  phase.value = 'ready'; task.value = null; history.value = []
  historyLoading.value = false; detailLoading.value = false
  historyError.value = ''; detailError.value = ''; errorText.value = ''; uncertain.value = false; confirmed.value = false
}
watch(() => [props.modelValue, props.service?.id], ([visible]) => {
  reset()
  if (visible && props.service?.id && canRead.value) loadHistory()
}, { immediate: true })
watch(() => [auth.token, auth.userId, auth.tenantId, auth.deptId, [...auth.permissions].sort().join(',')], () => {
  pendingServices.value.clear()
  reset()
  emit('update:modelValue', false)
})
onBeforeUnmount(() => { generation++; historyVersion++; detailVersion++ })

/**
 * 切换报告或执行状态后回到抽屉顶部，避免保留历史列表的滚动位置。
 * 无入参。
 * @returns {Promise<void>} 本次页面更新完成
 */
async function scrollTop() {
  await nextTick()
  bodyElement.value?.parentElement?.scrollTo?.({ top: 0 })
}

/**
 * 更新抽屉显示，执行中不把关闭当成取消后台任务。
 * @param {boolean} visible 是否显示
 * @returns {void} 无返回值
 */
function updateVisible(visible) { if (!running.value) emit('update:modelValue', visible) }

/**
 * 保护同步诊断期间的关闭操作。
 * @param {Function} done 组件关闭回调
 * @returns {void} 无返回值
 */
function beforeClose(done) { if (!running.value) done() }

/**
 * 返回目标确认页，保持未确认任务的提醒。
 * 无入参。
 * @returns {void} 无返回值
 */
function prepare() { if (!running.value) { detailVersion++; detailLoading.value = false; task.value = null; phase.value = 'ready'; scrollTop() } }

/**
 * 发起一次真实诊断，不自动重试创建请求。
 * 无入参。
 * @returns {Promise<void>} 请求处理完成
 */
async function start() {
  if (!canTrigger.value || running.value || !props.service?.id || (needsConfirmation.value && !confirmed.value)) return
  const version = generation, serviceId = props.service.id
  detailVersion++; detailLoading.value = false
  phase.value = 'running'; task.value = null; errorText.value = ''; confirmed.value = false
  scrollTop()
  pendingServices.value.add(serviceId)
  try {
    const result = await diagnoseService(serviceId)
    if (version !== generation) return
    if (!result?.id || result.serviceId !== serviceId) throw new Error('诊断响应与当前服务不匹配，请核对任务状态')
    task.value = result; phase.value = 'result'; scrollTop()
    if (result.status !== 'RUNNING') pendingServices.value.delete(serviceId)
    if (canRead.value) loadHistory()
  } catch (error) {
    if (version !== generation) return
    const rejected = [400, 401, 403, 404, 429].includes(error.response?.status)
    uncertain.value = !rejected
    if (rejected) pendingServices.value.delete(serviceId)
    errorText.value = error.message || '请求失败，请检查任务状态'
    phase.value = 'error'; scrollTop()
    if (canRead.value) loadHistory()
  }
}

/**
 * 按需加载当前服务任务；请求失败不伪装成无记录。
 * 无入参。
 * @returns {Promise<void>} 列表查询完成
 */
async function loadHistory() {
  if (!canRead.value || !props.modelValue || !props.service?.id) return
  const version = generation, requestVersion = ++historyVersion
  historyLoading.value = true; historyError.value = ''
  try {
    const result = await listServiceTasks(props.service.id)
    if (version === generation && requestVersion === historyVersion) history.value = Array.isArray(result) ? result : []
  } catch (error) {
    if (version === generation && requestVersion === historyVersion) { history.value = []; historyError.value = `任务列表加载失败：${error.message || '请稍后刷新'}` }
  } finally {
    if (version === generation && requestVersion === historyVersion) historyLoading.value = false
  }
}

/**
 * 查询持久化任务详情，不重跑模型；晚到响应不得覆盖其他目标。
 * @param {string} taskId 当前服务的任务标识
 * @returns {Promise<void>} 详情查询完成
 */
async function viewTask(taskId) {
  if (!canRead.value || running.value) return
  const version = generation, requestVersion = ++detailVersion, serviceId = props.service.id
  detailLoading.value = true; detailError.value = ''
  try {
    const result = await getAgentTask(taskId)
    if (version !== generation || requestVersion !== detailVersion) return
    if (!result?.id || result.serviceId !== serviceId) throw new Error('任务不属于当前服务')
    task.value = result; phase.value = 'result'
  } catch (error) {
    if (version === generation && requestVersion === detailVersion) detailError.value = `报告加载失败：${error.message || '请稍后重试'}`
  } finally {
    if (version === generation && requestVersion === detailVersion) detailLoading.value = false
  }
}
</script>

<style scoped>
.drawer-title{display:flex;align-items:center;gap:12px;font-size:18px;color:var(--text-primary)}
.diagnosis-body{color:var(--text-primary)}.service-heading{display:flex;align-items:center;gap:14px;margin-bottom:24px}.service-heading>.el-icon{width:42px;height:42px;background:var(--primary-light,#eff6ff);color:var(--primary);border-radius:8px;font-size:24px}.service-heading strong{font-size:16px;overflow-wrap:anywhere}.service-heading p{margin:5px 0 0;font-size:12px;color:var(--text-muted)}
h3{font-size:14px;margin:22px 0 12px}.scope-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;background:var(--bg-secondary,#f8fafc);border:1px solid var(--border);border-radius:8px;padding:18px;font-size:13px}.scope-grid label{display:block;color:var(--text-muted);font-size:12px;margin-bottom:5px}
.el-alert{margin-top:18px}.muted{color:var(--text-secondary);font-size:13px;line-height:1.8}.waiting{text-align:center;padding:48px 18px}.waiting>.el-icon{font-size:36px;color:var(--primary)}.waiting p{font-size:13px;line-height:1.8}
.drawer-footer{display:flex;justify-content:space-between;align-items:center;gap:12px;border-top:1px solid var(--border);padding-top:16px}.drawer-footer>span{color:var(--text-muted);font-size:12px}.drawer-footer>div{display:flex;gap:8px;flex-wrap:wrap}.drawer-footer .el-button+.el-button{margin-left:0}
.history-section{margin-top:26px}.history-heading{display:flex;align-items:center;justify-content:space-between}.history-heading h3{margin:0}.history-note{font-size:12px}.history-empty{border:1px solid var(--border);border-radius:8px;padding:20px;color:var(--text-muted);font-size:13px}.history-error{color:var(--danger);font-size:13px;overflow-wrap:anywhere}
.history-row{width:100%;border:1px solid var(--border);border-radius:7px;background:var(--card-bg,#fff);padding:13px 14px;margin-top:8px;display:flex;align-items:center;justify-content:space-between;gap:12px;text-align:left;cursor:pointer;font:inherit;font-size:13px;color:var(--text-primary)}.history-row:hover{border-color:var(--primary)}.history-row:disabled{cursor:wait;opacity:.6}.history-row small{display:block;font-size:11px;color:var(--text-muted);margin-top:5px;overflow-wrap:anywhere}.history-row>span{min-width:0}.confirmation{margin-top:20px}.confirmation .el-checkbox{height:auto;white-space:normal;margin-top:12px}.confirmation :deep(.el-checkbox__label){white-space:normal;line-height:1.6}
@media(max-width:600px){.scope-grid{grid-template-columns:1fr}.drawer-footer{flex-wrap:wrap}.history-row{align-items:flex-start}.drawer-footer>span{width:100%}}
</style>
