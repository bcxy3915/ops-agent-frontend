/**
 * 指标监控 API（真实实现）
 */
import request from "./request";

/**
 * 获取服务列表
 *
 * 复用服务管理的接口
 */
export async function getServiceList() {
  return request.get("/services");
}

/**
 * 获取服务的实时指标快照 + 历史数据
 *
 * @param {string} serviceName 服务名
 * @param {string} range 时间范围：5m / 15m / 1h / 6h
 */
export async function getMetrics(serviceName, range = "5m") {
  // 并行请求快照和历史
  const [snapshotRes, historyRes] = await Promise.all([
    request.get(`/services/${serviceName}/metrics/snapshot`),
    request.get(`/services/${serviceName}/metrics/history`, {
      params: { range },
    }),
  ]);

  return {
    service: serviceName,
    timestamp: snapshotRes.timestamp,
    snapshot: snapshotRes.snapshot,
    series: historyRes.series,
  };
}

/**
 * 获取所有可用指标列表（本地维护，用于展示）
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
