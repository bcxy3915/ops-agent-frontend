/**
 * 知识库 API 模块
 * 后端统一前缀 /api，request.js 已设置 baseURL=/api
 * 所有接口返回 { code, message, data }，code=0 时 request.js 直接返回 data
 */
import request from "./request";

// ==================== 统计与健康（只读，所有角色） ====================

/** 知识库总览统计 */
export async function getKnowledgeStats() {
  return request.get("/knowledge/stats");
}

/** 知识覆盖度（按服务） */
export async function getKnowledgeCoverage() {
  return request.get("/knowledge/coverage");
}

/** 知识库待办聚合（待审核文档/待沉淀案例/冲突待裁定/超期文档） */
export async function getKnowledgeTodos() {
  return request.get("/knowledge/todos");
}

/** 知识库健康度明细（超期/零命中/孤儿文档） */
export async function getKnowledgeHealth() {
  return request.get("/knowledge/health");
}

/** 单篇文档命中流水（分页） */
export async function listDocumentHits(docId, params = {}) {
  return request.get(`/knowledge/documents/${docId}/hits`, { params });
}

/** 故障案例引用统计 */
export async function getCaseReferences(caseId) {
  return request.get(`/knowledge/cases/${caseId}/references`);
}

// ==================== 文档管理（写操作需 ADMIN/OPERATOR） ====================

/** 查询文档列表（keyword/layer/trustStatus/service/page/size） */
export async function listKnowledgeDocuments(params = {}) {
  return request.get("/knowledge/documents", { params });
}

/** 查询文档详情 */
export async function getKnowledgeDocument(id) {
  return request.get(`/knowledge/documents/${id}`);
}

/**
 * 上传知识文档（multipart）
 * 注意：传 FormData，不要手动设置 Content-Type，由浏览器自动带 boundary
 */
export async function uploadKnowledgeDocument(formData) {
  return request.post("/knowledge/documents/upload", formData);
}

/** 在线编写知识文档 */
export async function createKnowledgeOnline(data) {
  return request.post("/knowledge/documents/online-create", data);
}

/** 编辑知识文档 */
export async function updateKnowledgeDocument(id, data) {
  return request.put(`/knowledge/documents/${id}`, data);
}

/** 删除知识文档（连带清向量，不可逆） */
export async function deleteKnowledgeDocument(id) {
  return request.delete(`/knowledge/documents/${id}`);
}

/** 提交审核（作者将草稿/已驳回文档提交部门审核） */
export async function submitKnowledgeDocument(id) {
  return request.post(`/knowledge/documents/${id}/submit`);
}

/** 发布审核（{ approved: true/false }）；仅处理待审核文档 */
export async function publishKnowledgeDocument(id, data) {
  return request.post(`/knowledge/documents/${id}/publish`, data);
}

/**
 * 直接发布（管理员上传后跳过审核，立即置为已通过并进入后台入库）
 * 仅对草稿/已驳回文档有效，需要 knowledge:publish 或 knowledge:admin
 */
export async function publishDirectKnowledgeDocument(id) {
  return request.post(`/knowledge/documents/${id}/publish-direct`);
}

/** 分级审核（{ level: 'DEPT'|'TENANT', approved, comment }） */
export async function reviewKnowledgeDocument(id, data) {
  return request.post(`/knowledge/documents/${id}/review`, data);
}

/** 自动超期判定 */
export async function scanExpiredDocuments() {
  return request.post("/knowledge/documents/expire-scan");
}

/** 查询单篇文档索引状态（供前端轮询入库进度） */
export async function getKnowledgeIndexStatus(id) {
  return request.get(`/knowledge/documents/${id}/index-status`);
}

/** 重建单篇文档索引（仅已发布/入库失败的文档可重试，不改变审核结论） */
export async function reindexKnowledgeDocument(id) {
  return request.post(`/knowledge/documents/${id}/reindex`);
}

// ==================== 版本（只读查询所有角色；回滚需 ADMIN/OPERATOR） ====================

/** 文档版本历史 */
export async function listDocumentVersions(docId) {
  return request.get(`/knowledge/documents/${docId}/versions`);
}

/** 回滚文档到指定历史版本 */
export async function rollbackKnowledgeDocument(docId, versionId) {
  return request.post(`/knowledge/documents/${docId}/versions/${versionId}/rollback`);
}

// ==================== 质检（写操作需 ADMIN/OPERATOR） ====================

/** 上传质检（冲突/过时/脱敏预览）；空内容返回业务错误码 1003 */
export async function checkKnowledgeQuality(data) {
  return request.post("/knowledge/quality/check", data);
}

/** 冲突三态裁定（KEEP_NEW / KEEP_OLD / MANUAL） */
export async function resolveKnowledgeConflict(conflictId, data) {
  return request.post(`/knowledge/quality/conflicts/${conflictId}/resolve`, data);
}

// ==================== 案例（写操作需 ADMIN/OPERATOR） ====================

/** 案例列表（status=PENDING|CONFIRMED|DISCARDED & page & size） */
export async function listKnowledgeCases(params = {}) {
  return request.get("/knowledge/cases", { params });
}

/** 案例详情（五步闭环链路） */
export async function getKnowledgeCase(id) {
  return request.get(`/knowledge/cases/${id}`);
}

/** 自动生成案例候选 */
export async function generateKnowledgeCases(limit = 20) {
  return request.post("/knowledge/cases/generate", null, { params: { limit } });
}

/** 确认沉淀案例 */
export async function confirmKnowledgeCase(id) {
  return request.post(`/knowledge/cases/${id}/confirm`);
}

/** 修正并沉淀案例 */
export async function reviseKnowledgeCase(id, data) {
  return request.post(`/knowledge/cases/${id}/revise`, data);
}

/** 丢弃候选案例 */
export async function discardKnowledgeCase(id) {
  return request.post(`/knowledge/cases/${id}/discard`);
}

// ==================== 检索（所有角色，限流 60/min） ====================

/** 检索测试（BM25+向量+Rerank） */
export async function testKnowledgeRetrieval(data) {
  return request.post("/knowledge/retrieval/test", data);
}

// ==================== 系统 ====================

/** 重建知识库索引 */
export async function reloadKnowledgeBase() {
  return request.post("/ops/knowledge/reload");
}
