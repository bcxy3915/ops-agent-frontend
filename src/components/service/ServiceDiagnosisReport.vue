<template>
  <div class="diagnosis-report">
    <section class="result-card">
      <div class="result-heading">
        <strong>{{ report?.summary ? '服务诊断报告' : '任务详情' }}</strong>
        <el-tag :type="state.type">{{ state.label }}</el-tag>
      </div>
      <div class="task-id">任务 {{ task.id }} · {{ taskTime(task.createdAt) }}</div>
      <div class="result-meta">
        <div><span>初始观测结论</span><el-tag :type="outcome.type">{{ outcome.label }}</el-tag></div>
        <div><span>发起人</span>{{ task.requestedBy || '—' }}</div>
        <div><span>执行范围</span>只读取证</div>
      </div>
    </section>
    <el-alert v-if="task.status === 'RUNNING'" title="任务仍在执行，完整步骤和报告尚未生成。请稍后刷新查询；关闭此面板不会停止后台任务。" type="info" :closable="false" />
    <el-alert v-else-if="task.status === 'FAILED'" :title="`任务执行失败：${task.errorCode || '未提供错误码'}`" type="error" :closable="false" />
    <template v-if="report">
      <h3>诊断结论</h3>
      <section class="summary-card">
        <p>{{ report.summary || '未提供结论' }}</p>
        <div class="citations">
          <el-button v-for="id in report.evidenceIds || []" :key="id" link type="primary" :disabled="!evidence.some(e => e.id === id)" @click="locate(id)">{{ id }}</el-button>
        </div>
        <p v-if="report.limitations" class="muted">局限：{{ report.limitations }}</p>
        <p v-if="report.reason" class="muted">停止原因：{{ STOP_REASONS[report.reason] || report.reason }}</p>
      </section>
      <h3>取证步骤 <small>完成后展示，不代表模型内部思维</small></h3>
      <ol class="steps">
        <li v-if="initialEvidence"><span class="step-symbol">✓</span><div><strong>初始服务巡检</strong><p class="muted">规则巡检观测已采集 <el-button link type="primary" @click="locate('e0')">e0</el-button></p></div></li>
        <li v-for="step in report.steps || []" :key="step.number">
          <span class="step-symbol" :class="{ failed: stepResult(step).warning }">{{ stepResult(step).warning ? '!' : '✓' }}</span>
          <div><strong>{{ ACTION_NAMES[step.action] || step.action }}</strong><p class="muted">{{ stepResult(step).label }}<span v-if="step.argument"> · {{ step.argument }}</span> <el-button v-if="step.evidenceId" link type="primary" @click="locate(step.evidenceId)">{{ step.evidenceId }}</el-button></p></div>
        </li>
      </ol>
      <p v-if="!initialEvidence && !report.steps?.length" class="muted">暂无已记录的取证步骤。</p>
      <h3>证据详情</h3>
      <details v-for="item in evidence" :key="item.id" :ref="el => bindEvidence(item.id, el)" class="evidence">
        <summary><el-tag size="small">{{ item.id }}</el-tag> {{ evidenceName(item.type) }} <span class="muted"> · {{ taskTime(item.collectedAt) }}</span></summary>
        <pre>{{ JSON.stringify(item.data, null, 2) }}</pre>
      </details>
      <p v-if="!evidence.length" class="muted">暂无可展示的证据。</p>
    </template>
    <template v-else-if="task.status !== 'RUNNING'">
      <h3>{{ task.taskType === 'INSPECTION' ? '巡检观测' : '可用观测' }}</h3>
      <p class="muted">{{ task.taskType === 'INSPECTION' ? '本条为规则巡检记录，不是自主诊断报告。' : '当前任务没有完整自主诊断报告，不推断诊断结论。' }}</p>
      <details v-for="item in inspectionEvidence" :key="item.id" class="evidence"><summary>初始巡检 · {{ taskTime(item.observedAt) }}</summary><pre>{{ JSON.stringify(item.report, null, 2) }}</pre></details>
    </template>
    <p class="report-note">诊断完成不等于故障恢复，本功能不会执行重启、部署或修复操作。</p>
  </div>
</template>

<script setup>
import { computed, onBeforeUpdate } from 'vue'
import { ACTION_NAMES, OUTCOMES, STOP_REASONS, TASK_STATES, taskTime } from './diagnosis-format'
const props = defineProps({ task: { type: Object, required: true } })
const report = computed(() => props.task.evidence?.find(e => e.evidenceType === 'DIAGNOSIS_REPORT')?.diagnosisReport)
const evidence = computed(() => report.value?.evidence || [])
const initialEvidence = computed(() => evidence.value.find(e => e.id === 'e0'))
const inspectionEvidence = computed(() => (props.task.evidence || []).filter(e => e.report))
const state = computed(() => TASK_STATES[props.task.status] || { label: props.task.status || '未知状态', type: 'info' })
const outcome = computed(() => OUTCOMES[props.task.outcome] || { label: props.task.outcome || '尚无结论', type: 'info' })
/**
 * 区分工具执行和数据完整性，不将证据不足显示成正常。
 * @param {object} step 当前取证步骤
 * @returns {{label:string,warning:boolean}} 步骤展示状态
 */
function stepResult(step) {
  if (step.status !== 'SUCCEEDED') return { label: step.status === 'FAILED' ? '取证失败' : step.status || '状态未知', warning: true }
  const data = evidence.value.find(item => item.id === step.evidenceId)?.data
  const statuses = [data?.status, data?.previous?.status, data?.current?.status].filter(Boolean)
  const incomplete = statuses.some(status => ['PARTIAL', 'UNAVAILABLE', 'TRUNCATED', 'INSUFFICIENT_EVIDENCE', 'INVALID'].includes(status))
  return { label: incomplete ? '取证已执行 · 证据不完整或不可用' : statuses.includes('ABNORMAL') ? '取证已执行 · 发现异常' : '取证完成', warning: incomplete || statuses.includes('ABNORMAL') }
}
const evidenceNodes = new Map()
onBeforeUpdate(() => evidenceNodes.clear())

/**
 * 登记当前报告证据节点，不使用全局同名 ID。
 * @param {string} id 报告内部证据标识
 * @param {HTMLElement|null} element 对应详情节点
 * @returns {void} 无返回值
 */
function bindEvidence(id, element) { if (element) evidenceNodes.set(id, element) }

/**
 * 展开引用证据并定位，未知引用不操作页面。
 * @param {string} id 当前报告内部证据标识
 * @returns {void} 无返回值
 */
function locate(id) {
  const node = evidenceNodes.get(id)
  if (!node) return
  node.open = true
  node.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
}

/**
 * 翻译已知证据类型，保留未知类型以便排查。
 * @param {string} type 证据类型
 * @returns {string} 展示名称
 */
function evidenceName(type) {
  return ({ INSPECTION_REPORT: '初始巡检', METRIC_WINDOW: '指标时间窗', LOGS: '绑定日志', BUSINESS_PROBE: '业务探针' })[type] || type
}
</script>

<style scoped>
.result-card,.summary-card{border:1px solid var(--border);border-radius:8px;padding:18px;background:var(--card-bg,#fff)}
.result-heading{display:flex;justify-content:space-between;align-items:center;gap:12px}
.task-id{font-size:12px;color:var(--text-muted);margin-top:10px;overflow-wrap:anywhere}
.result-meta{display:flex;flex-wrap:wrap;gap:24px;border-top:1px solid var(--border);padding-top:16px;margin-top:16px;font-size:13px}
.result-meta>div>span:first-child{display:block;font-size:12px;color:var(--text-muted);margin-bottom:8px}
h3{font-size:14px;margin:24px 0 12px}h3 small{font-size:12px;font-weight:400;color:var(--text-muted);margin-left:8px}
p{font-size:13px;line-height:1.8;margin:8px 0;white-space:pre-wrap;overflow-wrap:anywhere}.muted{color:var(--text-secondary)}
.summary-card{background:var(--bg-secondary,#f8fafc)}.citations{display:flex;gap:10px;flex-wrap:wrap}
.steps{list-style:none;padding:0;margin:0}.steps li{display:flex;gap:14px;padding:0 0 20px}.steps strong{font-size:13px}
.step-symbol{flex-shrink:0;display:grid;place-items:center;width:21px;height:21px;border-radius:50%;background:var(--success-bg,#ecfdf5);color:var(--success)}
.step-symbol.failed{color:var(--warning);background:var(--warning-bg,#fffbeb)}.steps p{margin:4px 0 0;font-size:12px}
.evidence{border:1px solid var(--border);border-radius:7px;margin:10px 0;overflow:hidden}.evidence summary{padding:14px;cursor:pointer;font-size:13px;overflow-wrap:anywhere}
.evidence pre{margin:0;padding:14px 18px;background:var(--bg-secondary,#f8fafc);white-space:pre-wrap;overflow-wrap:anywhere;font:12px/1.7 ui-monospace,monospace;max-height:420px;overflow:auto}
.report-note{margin-top:22px;color:var(--text-muted);font-size:12px}.el-alert{margin-top:16px}
</style>
