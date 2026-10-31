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
 * 流式问答（SSE）
 *
 * 后端事件格式：
 *   - 首个事件：event=citations, data=引用列表 JSON → 交给 onCitations
 *   - 默认事件：data=答案 token → 交给 onChunk 逐字追加
 *   - 结束事件：data=[DONE] → onDone
 */
export function askStream(sessionId, question, { onChunk, onDone, onError, onCitations }) {
  const authStore = useAuthStore();

  const controller = new AbortController();
  let stopped = false;

  // 长文本（如告警上下文）走 POST body：中文 URL 编码后膨胀 9 倍，拼 query 会撑爆请求头
  fetch("/api/ops/ask/stream", {
    method: "POST",
    headers: {
      Accept: "text/event-stream",
      "Content-Type": "application/json",
      Authorization: `Bearer ${authStore.token}`,
    },
    body: JSON.stringify({ question, sessionId }),
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
          // SSE 事件名：默认 message 事件（答案 token），首个事件为 citations
          let eventName = "";
          let dataStr = "";
          for (const line of lines) {
            if (line.startsWith("event:")) {
              eventName = line.slice(6).trim();
            } else if (line.startsWith("data:")) {
              dataStr += (dataStr ? "\n" : "") + line.slice(5).trim();
            }
          }

          if (!dataStr) continue;

          if (dataStr === "[DONE]") {
            stopped = true;
            onDone && onDone();
            return;
          }

          // citations 事件：结构化引用列表（JSON），交给 onCitations，不混入答案
          if (eventName === "citations") {
            try {
              const list = JSON.parse(dataStr);
              onCitations && onCitations(Array.isArray(list) ? list : []);
            } catch (e) {
              console.warn("citations 解析失败:", e);
            }
            continue;
          }

          // 默认事件：答案 token
          if (dataStr) {
            onChunk && onChunk(dataStr);
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
