/**
 * 审计日志 API（Mock）
 *
 * P5-8 联调时：
 *   listAuditLogs → request.get('/audit', { params })
 *   getAuditDetail → request.get(`/audit/${id}`)
 */

// ============ Mock 数据 ============
const operationTypes = [
  { value: "LOGIN", label: "登录" },
  { value: "REGISTER_SERVICE", label: "注册服务" },
  { value: "UPDATE_SERVICE", label: "更新服务" },
  { value: "DELETE_SERVICE", label: "删除服务" },
  { value: "CHECK_HEALTH", label: "健康检查" },
  { value: "RELOAD_KNOWLEDGE", label: "重载知识库" },
];

const usernames = ["admin", "operator", "viewer"];

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// 生成 200 条假日志
let mockLogs = Array.from({ length: 200 }, (_, i) => {
  const operation = randomItem(operationTypes);
  const username = randomItem(usernames);
  const success = Math.random() > 0.15;
  const date = new Date(
    Date.now() - i * 15 * 60 * 1000 - Math.random() * 3600 * 1000
  );

  return {
    id: 200 - i,
    username,
    operation: operation.value,
    operationLabel: operation.label,
    target: ["LOGIN"].includes(operation.value) ? username : "todo-service",
    method: ["LOGIN"].includes(operation.value) ? "POST" : "POST",
    uri: getUri(operation.value),
    params: getParams(operation.value, username),
    result: success ? "SUCCESS" : "FAILURE",
    errorMessage: success ? null : "用户名或密码错误",
    ip: "127.0.0.1",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    durationMs: 50 + Math.floor(Math.random() * 800),
    createdAt: date.toISOString(),
  };
});

function getUri(op) {
  const map = {
    LOGIN: "/api/auth/login",
    REGISTER_SERVICE: "/api/services",
    UPDATE_SERVICE: "/api/services/todo-service",
    DELETE_SERVICE: "/api/services/todo-service",
    CHECK_HEALTH: "/api/services/todo-service/check",
    RELOAD_KNOWLEDGE: "/api/ops/knowledge/load",
  };
  return map[op] || "/api/xxx";
}

function getParams(op, username) {
  if (op === "LOGIN") {
    return JSON.stringify({ request: { username, password: "***" } });
  }
  if (op === "REGISTER_SERVICE") {
    return JSON.stringify({
      request: {
        name: "todo-service",
        baseUrl: "http://localhost:8081",
        owner: "开发者",
      },
    });
  }
  return JSON.stringify({ name: "todo-service" });
}

function delay(ms = 300) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============ API 方法 ============

/**
 * 分页查询审计日志
 */
export async function listAuditLogs(params = {}) {
  await delay();

  let result = [...mockLogs];

  if (params.username) {
    result = result.filter((l) => l.username === params.username);
  }
  if (params.operation) {
    result = result.filter((l) => l.operation === params.operation);
  }
  if (params.result) {
    result = result.filter((l) => l.result === params.result);
  }
  if (params.startTime) {
    result = result.filter(
      (l) => new Date(l.createdAt) >= new Date(params.startTime)
    );
  }
  if (params.endTime) {
    result = result.filter(
      (l) => new Date(l.createdAt) <= new Date(params.endTime)
    );
  }

  result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const page = params.page || 1;
  const size = params.size || 20;
  const total = result.length;
  const records = result.slice((page - 1) * size, page * size);

  return { records, total, current: page, size };
}

/**
 * 操作类型选项
 */
export function getOperationTypes() {
  return operationTypes;
}

/**
 * 用户列表（用于筛选下拉）
 */
export function getUsernames() {
  return usernames;
}
