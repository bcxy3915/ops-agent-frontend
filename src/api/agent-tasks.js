import request from './request'

/**
 * 发起同步只读诊断，仅对本接口延长等待时间，不改变其他请求。
 * @param {string} serviceId 已登记服务标识
 * @returns {Promise<object>} 完成后的任务及报告
 */
export async function diagnoseService(serviceId) {
  return request.post(`/agent-tasks/services/${encodeURIComponent(serviceId)}/diagnosis`, null, { timeout: 360000 })
}

/**
 * 查询服务最近任务，列表包含巡检和自主诊断两类任务。
 * @param {string} serviceId 已登记服务标识
 * @returns {Promise<Array>} 最新优先的任务摘要
 */
export async function listServiceTasks(serviceId) {
  return request.get(`/agent-tasks/services/${encodeURIComponent(serviceId)}`, { params: { limit: 20 } })
}

/**
 * 读取已保存的任务，不重新运行诊断。
 * @param {string} taskId 任务标识
 * @returns {Promise<object>} 任务详情
 */
export async function getAgentTask(taskId) {
  return request.get(`/agent-tasks/${encodeURIComponent(taskId)}`)
}
