import request from "./request";

// ============ 通知渠道 ============
/** 查询通知渠道列表（type/enabled） */
export function listNotificationChannels(params = {}) {
  return request.get("/notifications/channels", { params });
}

/** 创建通知渠道 */
export function createNotificationChannel(data) {
  return request.post("/notifications/channels", data);
}

/** 更新通知渠道 */
export function updateNotificationChannel(id, data) {
  return request.put(`/notifications/channels/${id}`, data);
}

/** 启用 / 停用通知渠道 */
export function setNotificationChannelEnabled(id, enabled) {
  return request.put(`/notifications/channels/${id}/enabled`, { enabled });
}

/** 删除通知渠道（仅 ADMIN） */
export function deleteNotificationChannel(id) {
  return request.delete(`/notifications/channels/${id}`);
}

/** 测试发送（返回发送记录） */
export function testNotificationChannel(id) {
  return request.post(`/notifications/channels/${id}/test`);
}

// ============ 通知记录 ============
/** 查询通知发送记录（status/channelId/alertEventId/limit） */
export function listNotificationRecords(params = {}) {
  return request.get("/notifications/records", { params });
}
