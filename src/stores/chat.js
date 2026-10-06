import { defineStore } from "pinia";
import { ref } from "vue";
import { askStream } from "@/api/chat";

export const useChatStore = defineStore("chat", () => {
  // ========== State ==========
  const messages = ref([]); // 消息列表
  const sending = ref(false); // 是否正在发送
  const currentStream = ref(null); // 当前流对象（用于取消）

  // ========== Actions ==========

  /**
   * 发送消息
   */
  async function sendMessage(question) {
    if (!question.trim() || sending.value) return;

    // 1. 添加用户消息
    messages.value.push({
      id: "u-" + Date.now(),
      role: "user",
      content: question,
    });

    // 2. 添加占位的助手消息
    messages.value.push({
      id: "a-" + Date.now(),
      role: "assistant",
      reasoning: "", // 真实后端不返回，留空
      tools: [], // 真实后端不返回，留空
      answer: "",
      streaming: true,
    });
    const msgRef = messages.value[messages.value.length - 1];

    sending.value = true;

    // 3. 调用真实 SSE
    currentStream.value = askStream(question, {
      onChunk: (chunk) => {
        msgRef.answer += chunk;
      },
      onDone: () => {
        msgRef.streaming = false;
        sending.value = false;
        currentStream.value = null;
      },
      onError: (err) => {
        msgRef.answer = "【错误】" + (err.message || "请求失败");
        msgRef.streaming = false;
        sending.value = false;
        currentStream.value = null;
      },
    });
  }

  /**
   * 停止流式输出
   */
  function stopStream() {
    if (currentStream.value) {
      currentStream.value.close();
      const last = messages.value[messages.value.length - 1];
      if (last && last.streaming) {
        last.streaming = false;
      }
      currentStream.value = null;
      sending.value = false;
    }
  }

  /**
   * 清空当前会话
   */
  function clearMessages() {
    stopStream();
    messages.value = [];
  }

  return {
    messages,
    sending,
    sendMessage,
    stopStream,
    clearMessages,
  };
});
