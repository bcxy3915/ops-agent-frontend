/**
 * 审计日志 API
 */
import request from "./request";

/**
 * 操作类型映射（前端本地维护）
 *
 * 后端返回的是英文枚举值，前端负责映射成中文标签。
 */
const OPERATION_LABELS = {
  LOGIN: "登录",
  REGISTER_SERVICE: "注册服务",
  UPDATE_SERVICE: "更新服务",
  DELETE_SERVICE: "删除服务",
  CHECK_HEALTH: "健康检查",
  RELOAD_KNOWLEDGE: "重载知识库",
  CREATE_USER: "创建用户",
};

/**
 * 操作类型下拉选项
 */
export function getOperationTypes() {
  return Object.entries(OPERATION_LABELS).map(([value, label]) => ({
    value,
    label,
  }));
}

/**
 * 操作类型 → 中文标签
 */
export function getOperationLabel(operation) {
  return OPERATION_LABELS[operation] || operation;
}

/**
 * 用户列表（用于筛选下拉）
 *
 * 暂时写死，P5-8-5 做用户管理联调时可以改成从 /api/users 拉取
 */
export function getUsernames() {
  return ["admin", "operator", "viewer"];
}

/**
 * 分页查询审计日志
 *
 * @param {object} params
 *   - username: 用户名
 *   - operation: 操作类型
 *   - result: SUCCESS / FAILURE
 *   - page: 页码（默认 1）
 *   - size: 每页条数（默认 20）
 */
export async function listAuditLogs(params = {}) {
  // 只传有值的参数
  const query = {};
  if (params.username) query.username = params.username;
  if (params.operation) query.operation = params.operation;
  if (params.result) query.result = params.result;
  query.page = params.page || 1;
  query.size = params.size || 20;

  // 后端返回 MyBatis-Plus Page 结构：{ records, total, size, current, pages }
  // 响应拦截器已经解包了 data 层
  return request.get("/audit", { params: query });
}
