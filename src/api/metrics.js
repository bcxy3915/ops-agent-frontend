/**
 * 指标监控 API（Mock）
 *
 * P5-8 联调时：
 *   getServiceList   → request.get('/services')
 *   getMetrics       → request.get(`/services/${name}/metrics`)
 *   getMetricHistory → request.get(`/services/${name}/metrics/${metric}?range=xxx`)
 */

function delay(ms = 300) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 服务列表（复用 services 的 mock）
 */
export async function getServiceList() {
  await delay(100);
  return [
    { name: "todo-service", baseUrl: "http://localhost:8081", status: "UP" },
    { name: "blog-service", baseUrl: "http://localhost:8082", status: "DOWN" },
    {
      name: "api-test-service",
      baseUrl: "http://localhost:9999",
      status: "UNKNOWN",
    },
  ];
}

/**
 * 获取服务的实时指标快照
 */
export async function getMetrics(serviceName, range = "5m") {
  await delay();

  // 按 range 决定生成多少数据点
  const pointsByRange = { "5m": 30, "15m": 90, "1h": 60, "6h": 72 };
  const points = pointsByRange[range] || 30;
  const intervalByRange = { "5m": 10, "15m": 10, "1h": 60, "6h": 5 * 60 };
  const interval = intervalByRange[range] || 10;

  return {
    service: serviceName,
    timestamp: Date.now(),
    // 关键指标快照
    snapshot: {
      cpu: genValue(0.02, 0.15),
      memoryUsed: genValue(80 * 1024 * 1024, 150 * 1024 * 1024),
      memoryMax: 1024 * 1024 * 1024,
      httpCount: Math.floor(genValue(50, 500)),
      httpErrorRate: genValue(0, 0.02),
      httpAvgDuration: genValue(0.005, 0.05),
      threadCount: Math.floor(genValue(20, 50)),
      gcPause: genValue(0.001, 0.01),
      hikariActive: Math.floor(genValue(1, 8)),
      hikariPending: 0,
    },
    // 时序数据（用于折线图）
    series: {
      cpu: genSeries(points, interval, 0.05, 0.15),
      memory: genSeries(points, interval, 100, 200), // MB
      httpCount: genSeries(points, interval, 10, 60), // 每分钟
      gcPause: genSeries(points, interval, 1, 15), // ms
      hikariActive: genSeries(points, interval, 1, 8), // 连接数
    },
  };
}

function genValue(min, max) {
  return min + Math.random() * (max - min);
}

function genSeries(points, intervalSeconds, min, max) {
  const now = Date.now();
  const result = [];
  let value = (min + max) / 2;

  for (let i = points - 1; i >= 0; i--) {
    // 随机游走
    value += (Math.random() - 0.5) * (max - min) * 0.15;
    value = Math.max(min, Math.min(max, value));

    result.push({
      time: new Date(now - i * intervalSeconds * 1000).toISOString(),
      value: Number(value.toFixed(4)),
    });
  }
  return result;
}

/**
 * 获取所有可用指标列表
 */
export async function getAvailableMetrics() {
  return [
    { name: "system.cpu.usage", label: "CPU 使用率", unit: "%", type: "gauge" },
    { name: "jvm.memory.used", label: "JVM 内存", unit: "MB", type: "line" },
    {
      name: "http.server.requests",
      label: "HTTP 请求数",
      unit: "req/min",
      type: "line",
    },
    { name: "jvm.gc.pause", label: "GC 暂停", unit: "ms", type: "line" },
    {
      name: "hikaricp.connections.active",
      label: "数据库活跃连接",
      unit: "",
      type: "line",
    },
    { name: "jvm.threads.live", label: "活跃线程数", unit: "", type: "gauge" },
  ];
}
