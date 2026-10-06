/**
 * 对话 API（SSE 版本）
 *
 * 使用 EventSource 连接后端 SSE 接口。
 * 注意：EventSource 不支持自定义 Header，
 *       Token 要通过 URL 参数传递（后端需支持）或者用 fetch + ReadableStream。
 *
 * 由于 Spring Security 需要 Authorization Header，
 * 这里用 fetch + ReadableStream 手写 SSE 解析。
 */

import { useAuthStore } from "@/stores/auth";

/**
 * 流式问答
 *
 * @param {string} question  用户问题
 * @param {object} callbacks
 *   - onChunk(chunk)  收到文本片段
 *   - onDone()        完成
 *   - onError(err)    出错
 * @returns {{ close: Function }}
 */
export function askStream(question, { onChunk, onDone, onError }) {
  const authStore = useAuthStore();
  const sessionId =
    "sess-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);

  const url = `/api/ops/ask/stream?question=${encodeURIComponent(
    question
  )}&sessionId=${encodeURIComponent(sessionId)}`;

  const controller = new AbortController();
  let stopped = false;

  fetch(url, {
    method: "GET",
    headers: {
      Accept: "text/event-stream",
      Authorization: `Bearer ${authStore.token}`,
    },
    signal: controller.signal,
  })
    .then(async (response) => {
      if (!response.ok) {
        // 401 / 403 / 429 等
        if (response.status === 401) {
          throw new Error("未登录或登录已过期");
        }
        if (response.status === 403) {
          throw new Error("权限不足");
        }
        if (response.status === 429) {
          throw new Error("请求过于频繁，请稍后重试");
        }
        throw new Error(`请求失败: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      while (true) {
        if (stopped) break;

        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // SSE 格式：每个事件以 "\n\n" 分隔
        // 每个事件里可能有多行 "data: xxx"
        const events = buffer.split("\n\n");
        // 最后一段可能不完整，保留在 buffer
        buffer = events.pop() || "";

        for (const event of events) {
          const lines = event.split("\n");
          for (const line of lines) {
            if (line.startsWith("data:")) {
              const data = line.slice(5).trim(); // 去掉 "data:" 前缀

              if (data === "[DONE]") {
                stopped = true;
                onDone && onDone();
                return;
              }

              if (data) {
                onChunk && onChunk(data);
              }
            }
          }
        }
      }

      // 流结束（没收到 [DONE]）
      if (!stopped) {
        onDone && onDone();
      }
    })
    .catch((err) => {
      if (stopped) return; // 主动取消不算错误
      if (err.name === "AbortError") return;
      onError && onError(err);
    });

  return {
    close() {
      stopped = true;
      controller.abort();
    },
  };
}
