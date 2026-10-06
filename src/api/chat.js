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
import request from "./request";
import { useAuthStore } from "@/stores/auth";

/**
 * 统一的 401 处理：清空凭证 + 跳登录页
 *
 * 因为 askStream 用原生 fetch，不走 axios 拦截器，
 * 所以 401 需要手动处理（复用 request.js 里的逻辑）
 */
function handle401() {
  localStorage.removeItem("ops_token");
  localStorage.removeItem("ops_username");
  localStorage.removeItem("ops_role");

  // 动态 import router 避免循环依赖
  import("@/router").then(({ default: router }) => {
    const current = router.currentRoute.value.fullPath;
    router.push(`/login?redirect=${encodeURIComponent(current)}`);
  });
}

/**
 * 流式问答
 */
export function askStream(sessionId, question, { onChunk, onDone, onError }) {
  const authStore = useAuthStore();

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
      // ★ 非 2xx 响应
      if (!response.ok) {
        if (response.status === 401) {
          handle401();
          throw new Error("登录已过期，请重新登录");
        }
        if (response.status === 403) throw new Error("权限不足");
        if (response.status === 429)
          throw new Error("请求过于频繁，请稍后重试");
        if (response.status === 500) throw new Error("服务器内部错误");
        throw new Error(`请求失败 (${response.status})`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      while (true) {
        if (stopped) break;

        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const events = buffer.split("\n\n");
        buffer = events.pop() || "";

        for (const event of events) {
          const lines = event.split("\n");
          for (const line of lines) {
            if (line.startsWith("data:")) {
              const data = line.slice(5).trim();

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

      if (!stopped) {
        onDone && onDone();
      }
    })
    .catch((err) => {
      if (stopped) return;
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

// ============================================================
// 会话历史 API
// ============================================================

export async function listConversations() {
  return request.get("/chat/sessions");
}

export async function listMessages(sessionId) {
  return request.get(`/chat/sessions/${sessionId}/messages`);
}

export async function deleteConversation(sessionId) {
  return request.delete(`/chat/sessions/${sessionId}`);
}

export async function renameConversation(sessionId, title) {
  return request.patch(`/chat/sessions/${sessionId}/title`, { title });
}
