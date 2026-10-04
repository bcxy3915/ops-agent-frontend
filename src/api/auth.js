import request from "./request";

/**
 * 登录
 *
 * 当前用 Mock 实现，等 P5-8 联调时切换成真实 API：
 *   return request.post('/auth/login', { username, password })
 */
export async function login(username, password) {
  // ========== Mock 实现（P5-8 会删除）==========
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (!username || !password) {
        reject(new Error("用户名和密码不能为空"));
        return;
      }

      // 根据用户名返回不同角色，方便测试权限
      let role = "ADMIN";
      if (username === "operator") role = "OPERATOR";
      if (username === "viewer") role = "VIEWER";

      resolve({
        token: "mock-jwt-token-" + Date.now(),
        type: "Bearer",
        username,
        role,
        expiresIn: 7200,
      });
    }, 600);
  });

  // ========== 真实实现（P5-8 启用）==========
  // return request.post('/auth/login', { username, password })
}

/**
 * 获取当前用户信息
 */
export async function getCurrentUser() {
  // Mock
  return {
    username: "admin",
    role: "ADMIN",
  };
  // 真实实现：
  // return request.get('/auth/me')
}

/**
 * 退出登录
 * 后端一般不需要，前端清 Token 即可
 */
export async function logout() {
  return Promise.resolve();
  // 真实实现（如果后端需要清 Session）：
  // return request.post('/auth/logout')
}
