import { describe, it, expect, beforeEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useChatStore } from "./chat";

// Mock API
vi.mock("@/api/chat", () => ({
  askStream: vi.fn(() => ({ close: vi.fn() })),
  listConversations: vi.fn(async () => []),
  listMessages: vi.fn(async () => []),
  deleteConversation: vi.fn(async () => {}),
}));

import * as chatApi from "@/api/chat";

/**
 * chat store 单元测试
 * 覆盖：sessionId、newConversation、loadConversation、refreshConversations、
 *       removeConversation、clearMessages、sendMessage（含流式回调）
 */
describe("chat store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
    vi.clearAllMocks();
  });

  // ==================== sessionId ====================

  it("初始态：sessionId 从 localStorage 读取", () => {
    localStorage.setItem("ops_current_session", "sess-abc");
    setActivePinia(createPinia());

    const chat = useChatStore();
    expect(chat.sessionId).toBe("sess-abc");
  });

  it("初始态：localStorage 无值时 sessionId 为空串", () => {
    const chat = useChatStore();
    expect(chat.sessionId).toBe("");
  });

  // ==================== newConversation ====================

  it("newConversation：生成新 sessionId、写入 localStorage、清空消息", () => {
    const chat = useChatStore();
    chat.messages = [{ id: "1", role: "user", content: "hi" }];

    chat.newConversation();

    expect(chat.sessionId).toMatch(/^sess-/);
    expect(localStorage.getItem("ops_current_session")).toBe(chat.sessionId);
    expect(chat.messages).toEqual([]);
  });

  // ==================== loadConversation ====================

  it("loadConversation：拉取消息并映射为前端结构", async () => {
    chatApi.listMessages.mockResolvedValueOnce([
      { id: 1, role: "user", content: "你好" },
      {
        id: 2,
        role: "assistant",
        content: "你好，我是 Ops Agent",
        reasoning: "思考中",
        tools: [],
      },
    ]);

    const chat = useChatStore();
    await chat.loadConversation("sess-xyz");

    expect(chat.sessionId).toBe("sess-xyz");
    expect(localStorage.getItem("ops_current_session")).toBe("sess-xyz");
    expect(chat.messages).toHaveLength(2);

    // ★ 关键：content 必须同步映射为 answer（AI 消息渲染依赖此字段）
    expect(chat.messages[0].answer).toBe("你好");
    expect(chat.messages[0].role).toBe("user");
    expect(chat.messages[1].answer).toBe("你好，我是 Ops Agent");
    expect(chat.messages[1].reasoning).toBe("思考中");
    expect(chat.messages[1].tools).toEqual([]);
    expect(chat.messages[1].streaming).toBe(false);
  });

  it("loadConversation：reasoning 为 null 时兜底为空串，tools 为 null 时兜底为空数组", async () => {
    chatApi.listMessages.mockResolvedValueOnce([
      { id: 1, role: "assistant", content: "x", reasoning: null, tools: null },
    ]);

    const chat = useChatStore();
    await chat.loadConversation("sess-null");

    expect(chat.messages[0].reasoning).toBe("");
    expect(chat.messages[0].tools).toEqual([]);
  });

  it("loadConversation：返回不是数组时抛错并清空消息", async () => {
    chatApi.listMessages.mockResolvedValueOnce({ notArray: true });

    const chat = useChatStore();
    await chat.loadConversation("sess-bad");

    expect(chat.messages).toEqual([]);
  });

  it("loadConversation：API 抛异常时清空消息，不冒泡", async () => {
    chatApi.listMessages.mockRejectedValueOnce(new Error("network"));

    const chat = useChatStore();
    await expect(chat.loadConversation("sess-err")).resolves.not.toThrow();

    expect(chat.messages).toEqual([]);
  });

  // ==================== refreshConversations ====================

  it("refreshConversations：更新会话列表", async () => {
    const mockList = [
      { sessionId: "s1", title: "会话1" },
      { sessionId: "s2", title: "会话2" },
    ];
    chatApi.listConversations.mockResolvedValueOnce(mockList);

    const chat = useChatStore();
    await chat.refreshConversations();

    expect(chat.conversations).toEqual(mockList);
  });

  it("refreshConversations：API 异常时保持原值不清空", async () => {
    chatApi.listConversations.mockRejectedValueOnce(new Error("fail"));

    const chat = useChatStore();
    chat.conversations = [{ sessionId: "old" }];

    await chat.refreshConversations();

    expect(chat.conversations).toEqual([{ sessionId: "old" }]);
  });

  // ==================== removeConversation ====================

  it("removeConversation：调用 API 并从本地列表移除", async () => {
    const chat = useChatStore();
    chat.conversations = [{ sessionId: "s1" }, { sessionId: "s2" }];

    await chat.removeConversation("s1");

    expect(chatApi.deleteConversation).toHaveBeenCalledWith("s1");
    expect(chat.conversations).toHaveLength(1);
    expect(chat.conversations[0].sessionId).toBe("s2");
  });

  it("removeConversation：删除的是当前会话时自动新建", async () => {
    const chat = useChatStore();
    chat.sessionId = "s1";
    chat.conversations = [{ sessionId: "s1" }];
    const oldSessionId = chat.sessionId;

    await chat.removeConversation("s1");

    expect(chat.sessionId).not.toBe(oldSessionId);
    expect(chat.sessionId).toMatch(/^sess-/);
    expect(chat.messages).toEqual([]);
  });

  it("removeConversation：删除非当前会话不影响 sessionId", async () => {
    const chat = useChatStore();
    chat.sessionId = "current";
    chat.conversations = [{ sessionId: "current" }, { sessionId: "other" }];

    await chat.removeConversation("other");

    expect(chat.sessionId).toBe("current");
  });

  // ==================== clearMessages ====================

  it("clearMessages：清空消息但不影响 sessionId", () => {
    const chat = useChatStore();
    chat.sessionId = "sess-keep";
    chat.messages = [{ id: "1" }, { id: "2" }];

    chat.clearMessages();

    expect(chat.messages).toEqual([]);
    expect(chat.sessionId).toBe("sess-keep");
  });

  // ==================== sendMessage（含流式回调）====================

  it("sendMessage：空问题不发送", async () => {
    const chat = useChatStore();
    await chat.sendMessage("   ");

    expect(chat.messages).toEqual([]);
    expect(chatApi.askStream).not.toHaveBeenCalled();
  });

  it("sendMessage：添加用户消息 + AI 占位，调用 askStream", async () => {
    const chat = useChatStore();
    await chat.sendMessage("你好");

    expect(chat.messages).toHaveLength(2);
    expect(chat.messages[0].role).toBe("user");
    expect(chat.messages[0].content).toBe("你好");
    expect(chat.messages[1].role).toBe("assistant");
    expect(chat.messages[1].streaming).toBe(true);

    expect(chatApi.askStream).toHaveBeenCalledTimes(1);
    // 第一次发消息时自动生成 sessionId
    expect(chat.sessionId).toMatch(/^sess-/);
    expect(chat.sending).toBe(true);
  });

  it("sendMessage：onChunk 逐字追加到 answer", async () => {
    let capturedCallbacks;
    chatApi.askStream.mockImplementationOnce((sid, q, callbacks) => {
      capturedCallbacks = callbacks;
      return { close: vi.fn() };
    });

    const chat = useChatStore();
    await chat.sendMessage("hi");

    // 模拟流式片段
    capturedCallbacks.onChunk("Hello");
    capturedCallbacks.onChunk(" World");

    expect(chat.messages[1].answer).toBe("Hello World");
  });

  it("sendMessage：onDone 结束 streaming 并刷新会话列表", async () => {
    let capturedCallbacks;
    chatApi.askStream.mockImplementationOnce((sid, q, callbacks) => {
      capturedCallbacks = callbacks;
      return { close: vi.fn() };
    });
    chatApi.listConversations.mockResolvedValueOnce([{ sessionId: "x" }]);

    const chat = useChatStore();
    await chat.sendMessage("hi");

    capturedCallbacks.onChunk("done");
    await capturedCallbacks.onDone();

    expect(chat.messages[1].streaming).toBe(false);
    expect(chat.sending).toBe(false);
    expect(chatApi.listConversations).toHaveBeenCalled();
  });

  it("sendMessage：onError 追加中断提示并结束 streaming", async () => {
    let capturedCallbacks;
    chatApi.askStream.mockImplementationOnce((sid, q, callbacks) => {
      capturedCallbacks = callbacks;
      return { close: vi.fn() };
    });

    const chat = useChatStore();
    await chat.sendMessage("hi");

    capturedCallbacks.onChunk("部分答案");
    capturedCallbacks.onError(new Error("超时"));

    const answer = chat.messages[1].answer;
    expect(answer).toContain("部分答案");
    expect(answer).toContain("⚠️");
    expect(answer).toContain("超时");
    expect(chat.messages[1].streaming).toBe(false);
    expect(chat.sending).toBe(false);
  });

  it("sendMessage：onError 且无任何答案时显示纯错误", async () => {
    let capturedCallbacks;
    chatApi.askStream.mockImplementationOnce((sid, q, callbacks) => {
      capturedCallbacks = callbacks;
      return { close: vi.fn() };
    });

    const chat = useChatStore();
    await chat.sendMessage("hi");

    capturedCallbacks.onError(new Error("服务器 500"));

    expect(chat.messages[1].answer).toBe("⚠️ 服务器 500");
  });

  it("sendMessage：sending 为 true 时拒绝重入", async () => {
    const chat = useChatStore();
    chat.sending = true;

    await chat.sendMessage("hi");

    expect(chatApi.askStream).not.toHaveBeenCalled();
  });
});
