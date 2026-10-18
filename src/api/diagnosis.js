import request from "./request";

// ============ LLM 智能诊断 ============
/** 查询诊断记录（service/alertEventId/ruleId/limit） */
export function listDiagnoses(params = {}) {
  return request.get("/diagnoses", { params });
}

/** 查询诊断详情 */
export function getDiagnosis(id) {
  return request.get(`/diagnoses/${id}`);
}

/** 基于故障快照手动触发诊断 */
export function triggerDiagnosis(snapshotId) {
  return request.post(`/diagnoses/snapshot/${snapshotId}`);
}

/** 追问诊断 */
export function followUpDiagnosis(id, question) {
  return request.post(`/diagnoses/${id}/follow-up`, { question });
}
