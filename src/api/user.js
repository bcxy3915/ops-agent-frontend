/**
 * 用户管理 API（Mock）
 *
 * P5-8 联调时：
 *   listUsers → request.get('/users')
 *   getUser → request.get(`/users/${id}`)
 */

let mockUsers = [
  {
    id: "u001",
    username: "admin",
    password: "******",
    phone: "138****5678",
    email: "a***@example.com",
    role: "ADMIN",
    enabled: true,
    createdAt: "2026-10-04T06:19:54.671398",
    updatedAt: "2026-10-04T06:19:54.671398",
  },
  {
    id: "u002",
    username: "operator",
    password: "******",
    phone: "138****5678",
    email: "a***@example.com",
    role: "OPERATOR",
    enabled: true,
    createdAt: "2026-10-04T06:19:54.671398",
    updatedAt: "2026-10-04T06:19:54.671398",
  },
  {
    id: "u003",
    username: "viewer",
    password: "******",
    phone: "138****5678",
    email: "a***@example.com",
    role: "VIEWER",
    enabled: true,
    createdAt: "2026-10-04T06:19:54.671398",
    updatedAt: "2026-10-04T06:19:54.671398",
  },
  {
    id: "u004",
    username: "test-disabled",
    password: "******",
    phone: "138****5678",
    email: "a***@example.com",
    role: "VIEWER",
    enabled: false,
    createdAt: "2026-10-04T06:19:54.671398",
    updatedAt: "2026-10-04T06:19:54.671398",
  },
];

function delay(ms = 300) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function listUsers(params = {}) {
  await delay();

  let result = [...mockUsers];

  if (params.keyword) {
    const kw = params.keyword.toLowerCase();
    result = result.filter(
      (u) =>
        u.username.toLowerCase().includes(kw) || u.id.toLowerCase().includes(kw)
    );
  }

  if (params.role) {
    result = result.filter((u) => u.role === params.role);
  }

  if (
    params.enabled !== undefined &&
    params.enabled !== null &&
    params.enabled !== ""
  ) {
    result = result.filter((u) => u.enabled === params.enabled);
  }

  return result;
}

export async function getUser(id) {
  await delay();
  const user = mockUsers.find((u) => u.id === id);
  if (!user) throw new Error("用户不存在");
  return user;
}

/**
 * 创建用户
 *
 * P5-8 联调时：
 *   return request.post('/users', data)
 */
export async function createUser(data) {
  await delay();

  // 校验用户名唯一
  if (mockUsers.some((u) => u.username === data.username)) {
    throw new Error(`用户名已存在: ${data.username}`);
  }

  // 脱敏处理（模拟后端返回）
  const newUser = {
    id: "u" + String(mockUsers.length + 1).padStart(3, "0"),
    username: data.username,
    password: "******",
    phone: data.phone ? maskPhone(data.phone) : "",
    email: data.email ? maskEmail(data.email) : "",
    role: data.role,
    enabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  mockUsers.push(newUser);
  return newUser;
}

/**
 * 手机号脱敏（模拟后端返回脱敏后的值）
 */
function maskPhone(phone) {
  if (phone.length !== 11) return "*".repeat(phone.length);
  return phone.substring(0, 3) + "****" + phone.substring(7);
}

/**
 * 邮箱脱敏
 */
function maskEmail(email) {
  const atIdx = email.indexOf("@");
  if (atIdx <= 0) return email;
  const local = email.substring(0, atIdx);
  const domain = email.substring(atIdx);
  if (local.length <= 1) return "*" + domain;
  return local.charAt(0) + "***" + domain;
}
