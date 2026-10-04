/**
 * 假的 SSE 流式接口
 *
 * 用法：
 *   const stream = askStream('todo-service 健康吗', onChunk, onDone, onError)
 *   stream.close()  // 中途取消
 *
 * P5-8 联调时替换成真实 SSE：
 *   const es = new EventSource(`/api/ops/ask/stream?question=${...}&sessionId=${...}`)
 *   es.onmessage = (e) => onChunk(e.data)
 */
export function askStream(question, { onChunk, onDone, onError }) {
  // ========== 模拟场景数据 ==========
  const mockResponse = buildMockResponse(question);

  let index = 0;
  let stopped = false;

  // 模拟"思考中"延迟
  const thinkingDelay = 800;

  const timer = setTimeout(() => {
    if (stopped) return;

    // 逐字输出
    const interval = setInterval(() => {
      if (stopped) {
        clearInterval(interval);
        return;
      }

      if (index >= mockResponse.answer.length) {
        clearInterval(interval);
        onDone && onDone();
        return;
      }

      // 每次输出 1-3 个字符
      const chunkSize = Math.floor(Math.random() * 3) + 1;
      const chunk = mockResponse.answer.slice(index, index + chunkSize);
      index += chunkSize;

      onChunk && onChunk(chunk);
    }, 30); // 30ms 输出一批，约 30-50 字/秒
  }, thinkingDelay);

  return {
    close() {
      stopped = true;
      clearTimeout(timer);
    },
    // 供组件渲染思考块和工具调用
    mockResponse,
  };
}

/**
 * 根据问题构造假的响应
 * 覆盖三种典型场景
 */
function buildMockResponse(question) {
  // 场景 1：健康检查
  if (question.includes("健康") && question.includes("todo-service")) {
    return {
      reasoning:
        "用户询问 todo-service 的健康状态。这是一个实时数据查询，我需要调用 queryServiceHealth 工具。先确认该服务是否在注册中心。",
      tools: [
        {
          type: "health",
          name: "queryServiceHealth",
          params: { serviceName: "todo-service" },
          result:
            '{"status":"UP","components":{"diskSpace":"UP","livenessState":"UP","readinessState":"UP","ping":"UP","ssl":"UP"}}',
          duration: 840,
          status: "success",
        },
      ],
      answer: `todo-service 当前是**健康的**，整体状态为 UP。
  
  各组件明细：
  - **diskSpace**：UP，磁盘剩余约 297 GB
  - **livenessState**：UP，存活探针正常
  - **readinessState**：UP，就绪探针正常
  - **ping**：UP，基础连通性正常
  - **ssl**：UP，证书链有效
  
  > 📄 来源：08-常见问题FAQ.md
  > 判定依据：访问 \`/actuator/health\` 返回 UP 即表示健康。
  
  如需进一步确认运行质量，可以帮你查询 CPU、JVM 内存或 GC 暂停时间。`,
    };
  }

  // 场景 2：CPU 查询
  if (question.includes("CPU") || question.includes("cpu")) {
    return {
      reasoning:
        "用户询问 CPU 使用率。从上下文看目标是 todo-service。CPU 指标名是 system.cpu.usage。",
      tools: [
        {
          type: "metric",
          name: "queryMetric",
          params: {
            serviceName: "todo-service",
            metricName: "system.cpu.usage",
          },
          result: "0.0435 (约 4.35%)",
          duration: 620,
          status: "success",
        },
      ],
      answer: `todo-service 当前的 \`system.cpu.usage\` 为 **4.35%**。
  
  根据监控指标说明：
  - 正常范围：< 60%
  - 警告阈值：60% - 80%
  - 严重阈值：> 80%
  
  当前值远低于正常上限，**CPU 压力很小，无需处理**。
  
  > 📄 来源：05-监控指标说明.md`,
    };
  }

  // 场景 3：响应慢排查（RAG + Tool 融合）
  if (question.includes("慢") || question.includes("响应")) {
    return {
      reasoning:
        "用户问 todo-service 响应慢怎么办。这是一个 RAG + Tool 融合场景：先查故障手册的排查步骤，再查实时指标。",
      tools: [
        {
          type: "health",
          name: "queryServiceHealth",
          params: { serviceName: "todo-service" },
          result: '{"status":"UP"}',
          duration: 680,
          status: "success",
        },
        {
          type: "metric",
          name: "queryMetric",
          params: {
            serviceName: "todo-service",
            metricName: "system.cpu.usage",
          },
          result: "0.13 (约 13%)",
          duration: 540,
          status: "success",
        },
        {
          type: "metric",
          name: "queryMetric",
          params: {
            serviceName: "todo-service",
            metricName: "jvm.memory.used",
          },
          result: "约 126.8 MB",
          duration: 590,
          status: "success",
        },
        {
          type: "metric",
          name: "queryMetric",
          params: {
            serviceName: "todo-service",
            metricName: "http.server.requests",
          },
          result: "COUNT=9, TOTAL_TIME=1.058s, MAX=0.978s",
          duration: 710,
          status: "success",
        },
      ],
      answer: `## 一、实时数据体检
  
  | 指标 | 值 | 判断 |
  |------|-----|------|
  | 服务健康状态 | UP | ✅ 进程正常 |
  | system.cpu.usage | 13% | ✅ CPU 不高 |
  | jvm.memory.used | 126.8 MB | ✅ 内存正常 |
  | http.server.requests | MAX=978ms | ⚠️ 关键线索 |
  
  **结论**：服务本身健康，CPU 和内存都不紧张，但 **HTTP 请求的最大耗时接近 1 秒**，说明慢请求集中在个别接口上——典型的"单点慢"，而非整体资源瓶颈。
  
  ## 二、排查方向
  
  根据故障处理手册，"接口响应慢"常见根因：
  
  1. **CPU 高 → 死循环**：❌ 已排除（CPU 仅 13%）
  2. **内存不足**：❌ 基本排除
  3. **慢查询**：🔍 **高度可疑**（单接口慢、资源不高的典型特征）
  4. **下游超时**：🔍 **高度可疑**
  5. **线程池满**：🔍 可排查
  
  ## 三、建议下一步
  
  1. **定位是哪个接口慢**：
     \`\`\`
     /actuator/metrics/http.server.requests?tag=uri:/orders/slow
     \`\`\`
  2. **如果是数据库慢查询**：开启慢查询日志，用 EXPLAIN 分析
  3. **如果是下游调用慢**：检查下游状态、网络延迟
  
  > 📄 来源：02-故障处理手册.md、08-常见问题FAQ.md`,
    };
  }

  // 默认：通用回复
  return {
    reasoning: "用户的问题不在已知场景内，给出通用回复。",
    tools: [],
    answer: `你好，我是运维智能体。可以帮你：
  
  - **查服务健康**：如「todo-service 健康吗」
  - **查监控指标**：如「todo-service 的 CPU 使用率是多少」
  - **故障排查**：如「todo-service 响应慢怎么办」
  - **运维知识**：如「内存泄漏排查思路」
  
  请告诉我你想做什么，我来帮你处理。`,
  };
}
