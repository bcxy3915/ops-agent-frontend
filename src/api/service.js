/**
 * 服务管理 API（Mock 版本）
 *
 * P5-8 联调时，把每个 mock 方法换成 request.xxx 即可：
 *   listServices     → request.get('/services', { params })
 *   registerService  → request.post('/services', data)
 *   updateService    → request.put(`/services/${name}`, data)
 *   deleteService    → request.delete(`/services/${name}`)
 *   checkHealth      → request.post(`/services/${name}/check`)
 */

// ============ Mock 数据 ============
let mockServices = [
  {
    id: "s001",
    name: "todo-service",
    baseUrl: "http://localhost:8081",
    healthPath: "/actuator/health",
    metricsPath: "/actuator/metrics",
    owner: "开发者",
    env: "dev",
    tags: { team: "backend" },
    status: "UP",
    lastCheckedAt: new Date(Date.now() - 10 * 1000).toISOString(),
    registeredAt: new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 10 * 1000).toISOString(),
  },
  {
    id: "s002",
    name: "blog-service",
    baseUrl: "http://localhost:8082",
    healthPath: "/actuator/health",
    metricsPath: "/actuator/metrics",
    owner: "李四",
    env: "test",
    tags: { team: "content" },
    status: "DOWN",
    lastCheckedAt: new Date(Date.now() - 30 * 1000).toISOString(),
    registeredAt: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 30 * 1000).toISOString(),
  },
  {
    id: "s003",
    name: "api-test-service",
    baseUrl: "http://localhost:9999",
    healthPath: "/actuator/health",
    metricsPath: "/actuator/metrics",
    owner: "王五",
    env: "dev",
    tags: {},
    status: "UNKNOWN",
    lastCheckedAt: null,
    registeredAt: new Date(Date.now() - 3600 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 3600 * 1000).toISOString(),
  },
];

// 模拟网络延迟
function delay(ms = 300) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============ API 方法 ============

/**
 * 查询服务列表
 */
export async function listServices(params = {}) {
  await delay();

  let result = [...mockServices];

  // 关键词搜索
  if (params.keyword) {
    const kw = params.keyword.toLowerCase();
    result = result.filter(
      (s) =>
        s.name.toLowerCase().includes(kw) ||
        s.baseUrl.toLowerCase().includes(kw) ||
        (s.owner && s.owner.includes(kw))
    );
  }

  // 环境筛选
  if (params.env) {
    result = result.filter((s) => s.env === params.env);
  }

  // 状态筛选
  if (params.status) {
    result = result.filter((s) => s.status === params.status);
  }

  return result;
}

/**
 * 注册服务
 */
export async function registerService(data) {
  await delay();

  // 校验重名
  if (mockServices.some((s) => s.name === data.name)) {
    throw new Error(`服务已存在: ${data.name}`);
  }

  const newService = {
    id: "s" + Date.now(),
    ...data,
    status: "UNKNOWN",
    tags: data.tags || {},
    lastCheckedAt: null,
    registeredAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  mockServices.push(newService);
  return newService;
}

/**
 * 更新服务
 */
export async function updateService(name, data) {
  await delay();

  const index = mockServices.findIndex((s) => s.name === name);
  if (index === -1) {
    throw new Error(`服务不存在: ${name}`);
  }

  mockServices[index] = {
    ...mockServices[index],
    ...data,
    updatedAt: new Date().toISOString(),
  };

  return mockServices[index];
}

/**
 * 删除服务
 */
export async function deleteService(name) {
  await delay();

  const index = mockServices.findIndex((s) => s.name === name);
  if (index === -1) {
    throw new Error(`服务不存在: ${name}`);
  }

  mockServices.splice(index, 1);
  return { deleted: name };
}

/**
 * 触发健康检查
 */
export async function checkHealth(name) {
  await delay(800);

  const service = mockServices.find((s) => s.name === name);
  if (!service) {
    throw new Error(`服务不存在: ${name}`);
  }

  // Mock：80% 概率返回 UP，20% 返回 DOWN
  const newStatus = Math.random() > 0.2 ? "UP" : "DOWN";
  service.status = newStatus;
  service.lastCheckedAt = new Date().toISOString();

  return {
    name,
    status: newStatus,
    checkedAt: service.lastCheckedAt,
  };
}
