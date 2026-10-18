import request from "./request";

// ============ 故障快照 ============
/** 查询故障快照列表（service/alertEventId/limit） */
export function listFailureSnapshots(params = {}) {
  return request.get("/snapshots", { params });
}

/** 查询单个故障快照详情（snapshot 为结构化 JSON 对象） */
export function getFailureSnapshot(id) {
  return request.get(`/snapshots/${id}`);
}
