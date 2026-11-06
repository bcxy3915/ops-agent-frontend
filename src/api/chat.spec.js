import { askStream } from "./chat";

vi.mock("@/stores/auth", () => ({
  useAuthStore: () => ({ token: "test-token" }),
}));

describe("askStream", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("preserves whitespace in streamed Markdown and parses citations", async () => {
    const encoder = new TextEncoder();
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(
          "event: citations\ndata: [{\"source\":\"runbook.md\"}]\n\n" +
            "data: 各组件检查结果均正常：\n\n" +
            "data: \ndata: - 数据库（PostgreSQL）：UP\n\n" +
            "data: \ndata:   - 磁盘空间：UP\n\n" +
            "data: [DONE]\n\n"
        ));
        controller.close();
      },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, body }));

    const chunks = [];
    const citations = [];
    let resolveDone;
    let rejectDone;
    const done = new Promise((resolve, reject) => {
      resolveDone = resolve;
      rejectDone = reject;
    });

    askStream("session-1", "question", {
      onChunk: (chunk) => chunks.push(chunk),
      onCitations: (items) => citations.push(...items),
      onDone: resolveDone,
      onError: rejectDone,
    });

    await done;

    expect(chunks.join(""))
      .toBe("各组件检查结果均正常：\n- 数据库（PostgreSQL）：UP\n  - 磁盘空间：UP");
    expect(citations).toEqual([{ source: "runbook.md" }]);
  });
});
