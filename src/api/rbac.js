/**
 * RBAC 管理 API：租户 / 部门 / 角色权限
 */
import request from "./request";

// ==================== 租户（平台管理员） ====================

export async function listTenants() {
  return request.get("/tenants");
}

export async function getTenant(id) {
  return request.get(`/tenants/${id}`);
}

export async function createTenant(data) {
  return request.post("/tenants", data);
}

export async function updateTenant(id, data) {
  return request.put(`/tenants/${id}`, data);
}

export async function updateTenantStatus(id, status) {
  return request.put(`/tenants/${id}/status`, { status });
}

// ==================== 部门 ====================

export async function listDepts(params = {}) {
  return request.get("/depts", { params });
}

export async function getDept(id, params = {}) {
  return request.get(`/depts/${id}`, { params });
}

export async function createDept(data, params = {}) {
  return request.post("/depts", data, { params });
}

export async function updateDept(id, data, params = {}) {
  return request.put(`/depts/${id}`, data, { params });
}

export async function deleteDept(id, params = {}) {
  return request.delete(`/depts/${id}`, { params });
}

// ==================== 角色权限 ====================

export async function listRoles() {
  return request.get("/roles");
}

export async function listPermissions() {
  return request.get("/roles/permissions");
}

export async function getRolePermissions(id) {
  return request.get(`/roles/${id}/permissions`);
}

export async function updateRolePermissions(id, permissionIds) {
  return request.put(`/roles/${id}/permissions`, { permissionIds });
}
