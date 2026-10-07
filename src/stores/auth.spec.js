import { describe, it, expect, beforeEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useAuthStore } from "./auth";

// Mock API，避免真实网络请求
vi.mock("@/api/auth", () => ({
  login: vi.fn(async () => ({
    token: "mock-token-abc",
    username: "admin",
    role: "ADMIN",
  })),
}));

import * as authApi from "@/api/auth";

/**
 * auth store 单元测试
 * 覆盖：初始态 / login / logout / isLoggedIn / isAdmin / isOperator / userInitial / 持久化
 */
describe("auth store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
    vi.clearAllMocks();
  });

  // ==================== 初始态 ====================

  it("初始态：未登录时 token/username/role 都是空", () => {
    const auth = useAuthStore();
    expect(auth.token).toBe("");
    expect(auth.username).toBe("");
    expect(auth.role).toBe("");
    expect(auth.isLoggedIn).toBe(false);
  });

  it("初始态：从 localStorage 恢复登录态", () => {
    localStorage.setItem("ops_token", "restored-token");
    localStorage.setItem("ops_username", "operator");
    localStorage.setItem("ops_role", "OPERATOR");

    setActivePinia(createPinia());
    const auth = useAuthStore();

    expect(auth.token).toBe("restored-token");
    expect(auth.username).toBe("operator");
    expect(auth.role).toBe("OPERATOR");
    expect(auth.isLoggedIn).toBe(true);
  });

  // ==================== login ====================

  it("login：调用 API 并写入状态 + localStorage", async () => {
    const auth = useAuthStore();
    const res = await auth.login("admin", "admin123");

    expect(authApi.login).toHaveBeenCalledWith("admin", "admin123");
    expect(res.token).toBe("mock-token-abc");
    expect(auth.token).toBe("mock-token-abc");
    expect(auth.username).toBe("admin");
    expect(auth.role).toBe("ADMIN");
    expect(auth.isLoggedIn).toBe(true);

    expect(localStorage.getItem("ops_token")).toBe("mock-token-abc");
    expect(localStorage.getItem("ops_username")).toBe("admin");
    expect(localStorage.getItem("ops_role")).toBe("ADMIN");
  });

  // ==================== logout ====================

  it("logout：清空状态和 localStorage", async () => {
    const auth = useAuthStore();
    await auth.login("admin", "admin123");

    auth.logout();

    expect(auth.token).toBe("");
    expect(auth.username).toBe("");
    expect(auth.role).toBe("");
    expect(auth.isLoggedIn).toBe(false);
    expect(localStorage.getItem("ops_token")).toBeNull();
    expect(localStorage.getItem("ops_username")).toBeNull();
    expect(localStorage.getItem("ops_role")).toBeNull();
  });

  // ==================== getters ====================

  it("isAdmin：仅 ADMIN 返回 true", async () => {
    const auth = useAuthStore();
    await auth.login("admin", "admin123");
    expect(auth.isAdmin).toBe(true);

    auth.role = "OPERATOR";
    expect(auth.isAdmin).toBe(false);

    auth.role = "VIEWER";
    expect(auth.isAdmin).toBe(false);
  });

  it("isOperator：ADMIN 或 OPERATOR 返回 true，VIEWER 返回 false", async () => {
    const auth = useAuthStore();

    auth.role = "ADMIN";
    expect(auth.isOperator).toBe(true);

    auth.role = "OPERATOR";
    expect(auth.isOperator).toBe(true);

    auth.role = "VIEWER";
    expect(auth.isOperator).toBe(false);
  });

  it("userInitial：取用户名首字母并大写", async () => {
    const auth = useAuthStore();
    auth.username = "admin";
    expect(auth.userInitial).toBe("A");

    auth.username = "Operator";
    expect(auth.userInitial).toBe("O");
  });

  it("userInitial：用户名为空时默认返回 A", () => {
    const auth = useAuthStore();
    expect(auth.userInitial).toBe("A");
  });
});
