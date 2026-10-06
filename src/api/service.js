/**
 * 服务管理 API
 */
import request from "./request";

/**
 * 查询服务列表
 */
export async function listServices(params = {}) {
  return request.get("/services", { params });
}

/**
 * 注册服务
 */
export async function registerService(data) {
  return request.post("/services", data);
}

/**
 * 更新服务
 */
export async function updateService(name, data) {
  return request.put(`/services/${name}`, data);
}

/**
 * 删除服务
 */
export async function deleteService(name) {
  return request.delete(`/services/${name}`);
}

/**
 * 触发健康检查
 */
export async function checkHealth(name) {
  return request.post(`/services/${name}/check`);
}
