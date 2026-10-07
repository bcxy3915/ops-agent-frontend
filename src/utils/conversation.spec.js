import { describe, it, expect, vi, afterEach } from "vitest";
import { groupConversations, formatConversationTime } from "./conversation";

/**
 * conversation 工具测试
 * 覆盖：groupConversations（分组）、formatConversationTime（时间格式化）
 */
describe("groupConversations", () => {
  // 固定当前时间 = 2026-10-06 15:00:00（本地时区）
  // 这样所有"今天/7天内/年月"的判定都可预测
  const NOW = new Date(2026, 9, 6, 15, 0, 0);

  function mockNow() {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  }

  afterEach(() => {
    vi.useRealTimers();
  });

  function conv(id, isoTime) {
    return { sessionId: id, title: id, lastActiveAt: isoTime };
  }

  // ==================== 边界 ====================

  it("空/null/undefined 返回空数组", () => {
    expect(groupConversations([])).toEqual([]);
    expect(groupConversations(null)).toEqual([]);
    expect(groupConversations(undefined)).toEqual([]);
  });

  // ==================== 今天 ====================

  it("今天的会话归入「今天」组", () => {
    mockNow();
    const list = [conv("s1", new Date(2026, 9, 6, 10, 0).toISOString())];
    const groups = groupConversations(list);

    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe("今天");
    expect(groups[0].items).toHaveLength(1);
    expect(groups[0].items[0].sessionId).toBe("s1");
  });

  // ==================== 7天内 ====================

  it("3 天前的会话归入「7天内」组", () => {
    mockNow();
    const list = [conv("s2", new Date(2026, 9, 3, 10, 0).toISOString())];
    const groups = groupConversations(list);

    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe("7天内");
  });

  // ==================== 年月 ====================

  it("更早的会话按「YYYY-MM」分组", () => {
    mockNow();
    const list = [conv("s3", new Date(2026, 8, 15).toISOString())]; // 2026-09
    const groups = groupConversations(list);

    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe("2026-09");
  });

  it("不同月份的会话分到不同组，且按月倒序", () => {
    mockNow();
    const list = [
      conv("aug", new Date(2026, 7, 15).toISOString()), // 2026-08
      conv("sep", new Date(2026, 8, 15).toISOString()), // 2026-09
      conv("jul", new Date(2026, 6, 15).toISOString()), // 2026-07
    ];
    const groups = groupConversations(list);

    const labels = groups.map((g) => g.label);
    expect(labels).toEqual(["2026-09", "2026-08", "2026-07"]);
  });

  // ==================== 混合 ====================

  it("混合场景：今天 + 7天内 + 多个年月，顺序正确", () => {
    mockNow();
    const list = [
      conv("today", new Date(2026, 9, 6, 10, 0).toISOString()),
      conv("week", new Date(2026, 9, 3, 10, 0).toISOString()),
      conv("sep", new Date(2026, 8, 20).toISOString()),
      conv("aug", new Date(2026, 7, 20).toISOString()),
    ];
    const groups = groupConversations(list);

    expect(groups.map((g) => g.label)).toEqual([
      "今天",
      "7天内",
      "2026-09",
      "2026-08",
    ]);
  });

  it("空分组会被过滤（只有今天时不出现其他组）", () => {
    mockNow();
    const list = [conv("s1", new Date(2026, 9, 6, 10, 0).toISOString())];
    const groups = groupConversations(list);

    const labels = groups.map((g) => g.label);
    expect(labels).not.toContain("7天内");
    expect(labels.length).toBe(1);
  });
});

// ============================================================
// formatConversationTime
// ============================================================

describe("formatConversationTime", () => {
  const NOW = new Date(2026, 9, 6, 15, 30, 0); // 2026-10-06 15:30

  function mockNow() {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  }

  afterEach(() => {
    vi.useRealTimers();
  });

  it("空/null 输入返回空串", () => {
    expect(formatConversationTime(null)).toBe("");
    expect(formatConversationTime("")).toBe("");
    expect(formatConversationTime(undefined)).toBe("");
  });

  it("今天：返回 HH:mm", () => {
    mockNow();
    const result = formatConversationTime(
      new Date(2026, 9, 6, 9, 5).toISOString()
    );
    expect(result).toBe("09:05");
  });

  it("昨天：返回「昨天」", () => {
    mockNow();
    const result = formatConversationTime(
      new Date(2026, 9, 5, 20, 0).toISOString()
    );
    expect(result).toBe("昨天");
  });

  it("更早：返回 MM-DD", () => {
    mockNow();
    const result = formatConversationTime(new Date(2026, 8, 15).toISOString()); // 2026-09-15
    expect(result).toBe("09-15");
  });
});
