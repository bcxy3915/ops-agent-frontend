import { afterEach, describe, expect, it, vi } from "vitest";
import { askStream } from "./chat";
import MarkdownIt from "markdown-it";

vi.mock("./request", () => ({ default: {} }));
vi.mock("@/stores/auth", () => ({ useAuthStore: () => ({ token: "test-token" }) }));

/**
 * 创建仅在内存中读取的 SSE 响应，不访问真实后端。
 * @param {string[]} chunks 分片数据
 * @returns {object} 模拟 fetch 响应
 */
function responseFor(chunks) {
  let index = 0;
  return {
    ok: true,
    body: {
      getReader: () => ({
        read: async () => index < chunks.length
          ? { done: false, value: new TextEncoder().encode(chunks[index++]) }
          : { done: true },
      }),
    },
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("对话 SSE 契约", () => {
  it("逐 token 保留列表空格、代码缩进和命令空格，并能渲染 Markdown", async () => {
    const tokens = ["**故障告警**\n", "-", " ", "集群异常\n", "  ", "- 子项\n\n",
      "```sh\n", "  echo hello\n", "```\n", "行内 `GET", " ", "/_health`\n\n"];
    // HTTP 层为每行 data 字段添加一个分隔空格，正文空格不能被当成协议字符丢弃。
    const wire = tokens.map(token => token.split("\n").map(line => `data: ${line}`).join("\n") + "\n\n")
      .join("") + "event: citations\ndata: []\n\ndata: [DONE]\n\n";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(responseFor(
      Array.from({ length: Math.ceil(wire.length / 7) }, (_, i) => wire.slice(i * 7, i * 7 + 7))
    )));
    let answer = "";
    await new Promise((resolve, reject) => askStream("session", "问题", {
      onChunk: text => { answer += text; }, onDone: resolve, onError: reject,
    }));
    expect(answer).toBe(tokens.join(""));
    const html = new MarkdownIt({ html: false, linkify: true, breaks: true }).render(answer);
    const rendered = document.createElement("div");
    rendered.innerHTML = html;
    expect(rendered.querySelectorAll("ul")).toHaveLength(2);
    expect(rendered.querySelector("ul > li > ul > li").textContent).toBe("子项");
    expect(rendered.querySelector("pre code").textContent).toBe("  echo hello\n");
    expect(rendered.querySelector("p code").textContent).toBe("GET /_health");
  });

  it("分片和多行答案后输出引用，只有 DONE 才正常结束", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(responseFor([
      "data: 第一行\ndata: 第二行\n\nevent: cita",
      "tions\ndata: [{\"docId\":1}]\n\ndata: [DO",
      "NE]\n\n",
    ])));
    const calls = [];
    const onError = vi.fn();
    await new Promise((resolve) => askStream("session", "问题", {
      onChunk: text => calls.push(text),
      onCitations: citations => calls.push(citations),
      onDone: () => { calls.push("完成"); resolve(); },
      onError: error => { onError(error); resolve(); },
    }));
    expect(calls).toEqual(["第一行\n第二行", [{ docId: 1 }], "完成"]);
    expect(onError).not.toHaveBeenCalled();
  });

  it("提前断流保留部分答案并报错，不触发成功回调", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(responseFor(["data: 部分答案\n\n"])));
    const onChunk = vi.fn();
    const onDone = vi.fn();
    const error = await new Promise((resolve) => askStream("session", "问题", {
      onChunk, onDone, onError: resolve,
    }));
    expect(onChunk).toHaveBeenCalledWith("部分答案");
    expect(onDone).not.toHaveBeenCalled();
    expect(error.message).toContain("未收到完成标记");
  });
});

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
