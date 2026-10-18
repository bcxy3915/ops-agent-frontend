import request from "./request";

// ============ 告警事件 ============
/** 查询告警事件列表（service/status/ruleId/limit） */
export function listAlertEvents(params = {}) {
  return request.get("/alerts/events", { params });
}

/** 确认告警事件（FIRING/SILENCED → ACKNOWLEDGED） */
export function acknowledgeAlertEvent(id) {
  return request.post(`/alerts/events/${id}/acknowledge`);
}

// ============ 告警规则 ============
/** 查询告警规则列表（service/enabled） */
export function listAlertRules(params = {}) {
  return request.get("/alerts/rules", { params });
}

/** 创建告警规则 */
export function createAlertRule(data) {
  return request.post("/alerts/rules", data);
}

/** 更新告警规则 */
export function updateAlertRule(id, data) {
  return request.put(`/alerts/rules/${id}`, data);
}

/** 启用 / 停用告警规则 */
export function setAlertRuleEnabled(id, enabled) {
  return request.put(`/alerts/rules/${id}/enabled`, { enabled });
}

/** 删除告警规则（仅 ADMIN） */
export function deleteAlertRule(id) {
  return request.delete(`/alerts/rules/${id}`);
}
