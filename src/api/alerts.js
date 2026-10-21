import request from "./request";

// ============ 告警事件 ============
/** 查询告警事件列表（service/status/ruleId/limit） */
export function listAlertEvents(params = {}) {
  return request.get("/alerts/events", { params });
}

/** 查询告警事件详情 */
export function getAlertEvent(id) {
  return request.get(`/alerts/events/${id}`);
}

/** 确认告警事件（FIRING/SILENCED → ACKNOWLEDGED，记录认领人） */
export function acknowledgeAlertEvent(id) {
  return request.post(`/alerts/events/${id}/acknowledge`);
}

/** 批量确认告警事件 */
export function batchAcknowledgeAlertEvents(ids) {
  return request.post("/alerts/events/batch-acknowledge", { ids });
}

/** 手动恢复告警事件（任意非 RESOLVED → RESOLVED） */
export function resolveAlertEvent(id) {
  return request.post(`/alerts/events/${id}/resolve`);
}

/** 手动静默告警事件（任意非 RESOLVED → SILENCED，带原因+到期时间） */
export function silenceAlertEvent(id, data) {
  return request.post(`/alerts/events/${id}/silence`, data);
}

// ============ 已读（已读 ≠ 已处理，持久化到后端） ============
/** 标记单条告警已读 */
export function markAlertEventRead(id) {
  return request.post(`/alerts/events/${id}/read`);
}

/** 批量标记已读（ids 为空 = 全部待处理事件） */
export function markAllAlertEventsRead(ids = []) {
  return request.post("/alerts/events/read-all", { ids });
}

/** 当前用户未读告警数（铃铛 badge） */
export function getUnreadAlertCount() {
  return request.get("/alerts/events/unread-count");
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

/** 独立认领 / 接管告警（规格 3.2，FIRING/SILENCED 自动转 ACK） */
export function claimAlertEvent(id) {
  return request.post(`/alerts/events/${id}/claim`);
}

/** 解除静默（规格 2.2，SILENCED → 静默前状态） */
export function unsilenceAlertEvent(id) {
  return request.post(`/alerts/events/${id}/unsilence`);
}

/** 查询告警升级记录（详情处置时间线，规格 4.2） */
export function getAlertEscalations(id) {
  return request.get(`/alerts/events/${id}/escalations`);
}

// ============ P1 新增：告警汇总 + 批量静默 ============
/** 告警汇总统计（首页统计卡 / 告警中心页顶部汇总卡共用） */
export function getAlertSummary() {
  return request.get("/alerts/events/summary");
}

/** 批量静默告警（P1：一次调用后端批量处理，返回 { count, skipped }，跳过已恢复等不可静默项） */
export function batchSilenceAlertEvents(ids, data) {
  return request.post("/alerts/events/batch-silence", { ids, ...data });
}
