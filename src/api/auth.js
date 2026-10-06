import request from "./request";

/**
 * 登录
 */
export async function login(username, password) {
  return request.post("/auth/login", { username, password });
}

/**
 * 获取当前用户信息
 */
export async function getCurrentUser() {
  return request.get("/auth/me");
}

/**
 * 退出登录
 * 后端一般不需要，前端清 Token 即可
 */
export async function logout() {
  return Promise.resolve();
}
