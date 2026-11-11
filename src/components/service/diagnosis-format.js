export const TASK_STATES = {
  RUNNING: { label: '执行中', type: 'primary' },
  SUCCEEDED: { label: '执行完成', type: 'success' },
  NEEDS_MANUAL: { label: '需人工处理', type: 'warning' },
  FAILED: { label: '执行失败', type: 'danger' },
}
export const OUTCOMES = {
  HEALTHY: { label: '未发现规则异常', type: 'success' },
  ABNORMAL: { label: '发现异常', type: 'warning' },
  INSUFFICIENT_EVIDENCE: { label: '证据不足', type: 'warning' },
}
export const ACTION_NAMES = {
  INSPECT_SERVICE: '初始服务巡检', METRIC_WINDOW: '查询指标时间窗',
  LOGS: '读取绑定日志', BUSINESS_PROBE: '执行只读业务探针',
}
export const STOP_REASONS = {
  NO_ANOMALY: '未发现规则异常', AGENT_FINISHED: '诊断结束',
  TIME_BUDGET_EXHAUSTED: '达到时间预算', ROUND_BUDGET_EXHAUSTED: '达到决策轮数上限',
  CONTEXT_BUDGET_EXHAUSTED: '达到上下文预算', CONTEXT_INVALID: '证据上下文无效',
  MODEL_UNAVAILABLE: '模型暂不可用', NO_NEW_EVIDENCE: '没有新的取证动作',
  INVALID_DECISION: '模型决策无效', INVALID_EVIDENCE_REFERENCE: '结论引用无效', TOOL_NOT_ALLOWED: '工具或参数未授权',
}

/**
 * 格式化后端 UTC 时间；毫秒时间戳直接按绝对时间处理。
 * @param {string|number} value UTC 日期或毫秒时间戳
 * @returns {string} 本地时间，缺失或无效时返回占位符
 */
export function taskTime(value) {
  if (value === null || value === undefined || value === '') return '—'
  const text = typeof value === 'string' && !/(Z|[+-]\d{2}:?\d{2})$/i.test(value) ? `${value}Z` : value
  const date = new Date(text)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('zh-CN', { hour12: false })
}
