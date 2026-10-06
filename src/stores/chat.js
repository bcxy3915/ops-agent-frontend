import { defineStore } from "pinia";
import { ref } from "vue";
import {
  askStream,
  listConversations,
  listMessages,
  deleteConversation,
} from "@/api/chat";

/** localStorage 中保存"当前会话 ID"的 key */
const SESSION_KEY = "ops_current_session";

export const useChatStore = defineStore("chat", () => {
  // ============================================================
  // State
  // ============================================================

  /** 当前会话的消息列表 */
  const messages = ref([]);

  /** 是否正在发送（控制"停止"按钮） */
  const sending = ref(false);

  /** 当前流对象，用于中途取消 */
  const currentStream = ref(null);

  /**
   * ★ 当前会话 ID
   *   - 优先从 localStorage 读（刷新后不变）
   *   - 登录后首次发消息时才会生成（未登录时不生成）
   */
  const sessionId = ref(localStorage.getItem(SESSION_KEY) || "");

  /** 会话列表（原始，未分组；由侧边栏 computed 分组） */
  const conversations = ref([]);

  // ============================================================
  // 工具方法
  // ============================================================

  /** 生成新的会话 ID */
  function generateSessionId() {
    return "sess-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
  }

  /**
   * 确保有 sessionId（没有则生成）
   *   ★ 只有真正发消息时才调用，避免未登录时就生成一堆无效 ID
   */
  function ensureSessionId() {
    if (!sessionId.value) {
      sessionId.value = generateSessionId();
      localStorage.setItem(SESSION_KEY, sessionId.value);
    }
    return sessionId.value;
  }

  // ============================================================
  // 会话操作
  // ============================================================

  /**
   * 新建对话
   *   - 停止当前流（如果有）
   *   - 生成新 sessionId 并持久化
   *   - 清空消息列表
   */
  function newConversation() {
    stopStream();
    const newId = generateSessionId();
    sessionId.value = newId;
    localStorage.setItem(SESSION_KEY, newId);
    messages.value = [];
  }

  /**
   * 加载指定会话的消息
   */
  async function loadConversation(targetSessionId) {
    stopStream();
    sessionId.value = targetSessionId;
    localStorage.setItem(SESSION_KEY, targetSessionId);

    try {
      const msgs = await listMessages(targetSessionId);
      // ★ 确保 msgs 一定是数组
      if (!Array.isArray(msgs)) {
        throw new Error("数据格式错误");
      }

      messages.value = msgs.map((m) => ({
        id: "m-" + (m.id || Date.now()), // 兜底 id
        role: m.role,
        content: m.content,
        answer: m.content,
        reasoning: m.reasoning || "",
        tools: m.tools || [],
        streaming: false,
      }));
    } catch (e) {
      console.error("加载会话消息失败", e);
      messages.value = []; // 失败时清空，避免 undefined 导致渲染崩溃
    }
  }

  /**
   * 刷新会话列表（侧边栏用）
   */
  async function refreshConversations() {
    try {
      conversations.value = await listConversations();
    } catch (e) {
      console.error("加载会话列表失败", e);
    }
  }

  /**
   * 删除会话
   */
  async function removeConversation(targetSessionId) {
    await deleteConversation(targetSessionId);

    // 本地列表同步
    conversations.value = conversations.value.filter(
      (c) => c.sessionId !== targetSessionId
    );

    // 如果删除的是当前会话，自动新建一个
    if (sessionId.value === targetSessionId) {
      newConversation();
    }
  }

  // ============================================================
  // 发送消息（核心）
  // ============================================================

  /**
   * 发送消息
   *   1. 添加用户消息到本地
   *   2. 添加空的助手消息占位
   *   3. 调用 askStream，逐字更新助手消息内容
   *   4. 完成后刷新会话列表（更新标题/计数）
   */
  async function sendMessage(question) {
    if (!question.trim() || sending.value) return;

    // ★ 确保有 sessionId（首次发消息时才会真正生成）
    const sid = ensureSessionId();

    // 1. 添加用户消息
    messages.value.push({
      id: "u-" + Date.now(),
      role: "user",
      content: question,
    });

    // 2. 添加助手消息占位（内容会通过 onChunk 逐字追加）
    messages.value.push({
      id: "a-" + Date.now(),
      role: "assistant",
      reasoning: "",
      tools: [],
      answer: "",
      streaming: true,
    });
    const msgRef = messages.value[messages.value.length - 1];

    sending.value = true;

    // 3. 调 SSE
    currentStream.value = askStream(sid, question, {
      onChunk: (chunk) => {
        msgRef.answer = (msgRef.answer || "") + chunk;
      },
      onDone: async () => {
        // ★ 关键：流式结束后，强制触发一次完整的 Markdown 渲染
        // 因为流式过程中片段不完整，Markdown 可能解析错误，这里重新赋值一次让 computed 重新计算
        msgRef.answer = msgRef.answer + "";

        msgRef.streaming = false;
        sending.value = false;
        currentStream.value = null;
        await refreshConversations();
      },
      onError: (err) => {
        // ★ 保留已经收到的内容，追加错误提示
        const errorText = err.message || "请求失败";

        if (msgRef.answer && msgRef.answer.trim()) {
          // 已有部分答案，追加错误提示
          msgRef.answer += `\n\n> ⚠️ **中断**：${errorText}`;
        } else {
          // 完全没有答案，直接显示错误
          msgRef.answer = `⚠️ ${errorText}`;
        }

        // ★ 关键：无论哪种情况，都要结束 streaming 状态
        msgRef.streaming = false;
        sending.value = false;
        currentStream.value = null;
      },
    });
  }

  /** 停止当前流 */
  function stopStream() {
    if (currentStream.value) {
      currentStream.value.close();
      const last = messages.value[messages.value.length - 1];
      if (last && last.streaming) last.streaming = false;
      currentStream.value = null;
      sending.value = false;
    }
  }

  /** 清空当前会话的消息（不删后端数据） */
  function clearMessages() {
    stopStream();
    messages.value = [];
  }

  return {
    messages,
    sending,
    sessionId,
    conversations,
    sendMessage,
    stopStream,
    clearMessages,
    newConversation,
    loadConversation,
    refreshConversations,
    removeConversation,
  };
});
