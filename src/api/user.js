/**
 * 用户管理 API
 */
import request from "./request";

/**
 * 查询用户列表
 */
export async function listUsers(params = {}) {
  const query = {};

  if (params.keyword) query.keyword = params.keyword;
  if (params.role) query.role = params.role;

  // ★ enabled 是 Boolean，false 也要传，不能用 truthy 判断
  if (
    params.enabled !== "" &&
    params.enabled !== null &&
    params.enabled !== undefined
  ) {
    query.enabled = params.enabled;
  }

  return request.get("/users", { params: query });
}

/**
 * 查询单个用户
 */
export async function getUser(id) {
  return request.get(`/users/${id}`);
}

/**
 * 创建用户
 */
export async function createUser(data) {
  return request.post("/users", data);
}

/**
 * 更新用户（角色/启停/密码/手机/邮箱）
 */
export async function updateUser(id, data) {
  return request.put(`/users/${id}`, data);
}

/**
 * 删除用户
 */
export async function deleteUser(id) {
  return request.delete(`/users/${id}`);
}
