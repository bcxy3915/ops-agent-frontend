import request from "./request";

// ==================== 维护窗口（P1 规格 5） ====================
/** 查询维护窗口列表；activeOnly=true 只返回未结束且未到期的窗口 */
export function listMaintenanceWindows(activeOnly = false) {
  return request.get("/maintenance/windows", { params: { activeOnly } });
}

/** 创建维护窗口（多选服务 + 原因 + 到期时间；ADMIN / OPERATOR） */
export function createMaintenanceWindow(data) {
  return request.post("/maintenance/windows", data);
}

/** 提前结束维护窗口（ADMIN / OPERATOR） */
export function endMaintenanceWindow(id) {
  return request.delete(`/maintenance/windows/${id}`);
}
