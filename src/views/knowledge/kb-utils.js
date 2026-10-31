/**
 * 知识库页面共享工具
 * 枚举映射（后端枚举 → 中文文案 / tag 样式类）、时间格式化
 */

/** 知识层级：BUILTIN=官方内置 / PRIVATE=企业私有 / CASE=故障案例 */
export const LAYER_MAP = {
  BUILTIN: { label: '官方内置', cls: 'kb-tag-primary' },
  PRIVATE: { label: '企业私有', cls: 'kb-tag-teal' },
  CASE: { label: '故障案例', cls: 'kb-tag-warning' }
}

/** 信任状态：VERIFIED=已验证 / PENDING=待审核 / AI_DRAFT=AI待校对 / EXPIRED=已失效 */
export const STATUS_MAP = {
  VERIFIED: { label: '已验证', cls: 'kb-tag-success' },
  PENDING: { label: '待审核', cls: 'kb-tag-warning' },
  AI_DRAFT: { label: 'AI待校对', cls: 'kb-tag-info' },
  EXPIRED: { label: '已失效风险', cls: 'kb-tag-danger' }
}

/**
 * 索引发布状态：审核结论之外独立流转
 * UNPUBLISHED=未入库 / BUILDING=入库中 / FAILED=入库失败 / PUBLISHED=已入库
 */
export const PUBLISH_STATUS_MAP = {
  UNPUBLISHED: { label: '未入库', cls: 'kb-tag-info' },
  BUILDING: { label: '入库中', cls: 'kb-tag-warning' },
  FAILED: { label: '入库失败', cls: 'kb-tag-danger' },
  PUBLISHED: { label: '已入库', cls: 'kb-tag-success' }
}

/** 索引发布状态文案 */
export function publishLabel(v) {
  return PUBLISH_STATUS_MAP[v]?.label || v || '-'
}

/** 索引发布状态 tag 样式 */
export function publishCls(v) {
  return PUBLISH_STATUS_MAP[v]?.cls || 'kb-tag-info'
}

/** 文档类型（文件格式） */
export const DOCTYPE_MAP = {
  MARKDOWN: 'Markdown',
  DOCX: 'Word',
  PDF: 'PDF',
  TEXT: '文本'
}

/** 案例五步闭环链路 */
export const FLOW_STEPS = [
  { key: 'ALERT', label: '告警' },
  { key: 'SNAPSHOT', label: '快照' },
  { key: 'DIAGNOSIS', label: '诊断' },
  { key: 'ACTION', label: '处置' },
  { key: 'RECOVERY', label: '恢复' }
]

/** 脱敏状态 */
export const MASKED_MAP = {
  NONE: '未检测到敏感信息',
  PARTIAL: '部分脱敏，可直接沉淀',
  FULL: '已完全脱敏'
}

/**
 * 格式化时间：YYYY-MM-DD HH:mm
 */
export function formatDate(iso) {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '-'
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/**
 * 只显示日期：YYYY-MM-DD
 */
export function formatDay(iso) {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '-'
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** 千分位 */
export function fmtNumber(n) {
  if (n === null || n === undefined) return '0'
  return Number(n).toLocaleString('zh-CN')
}
