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
    const assistantMsg = {
      id: "a-" + Date.now(),
      role: "assistant",
      reasoning: "",
      tools: [],
      answer: "",
      streaming: true,
    };
    messages.value.push(assistantMsg);
    const msgRef = messages.value[messages.value.length - 1];

    sending.value = true;

    // 3. 调用流式接口
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

    // 4. 设置 reasoning 和 tools（同步展示，模拟实际场景）
    const mock = currentStream.value.mockResponse;
    msgRef.reasoning = mock.reasoning;
    msgRef.tools = mock.tools;

    // 模拟思考延迟后开始展示（与 mock 里的 delay 一致）
    return new Promise((resolve) => {
      setTimeout(() => resolve(), 800);
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
