import { defineStore } from "pinia";
import { ref, computed } from "vue";
import * as authApi from "@/api/auth";

const KEYS = {
  token: "ops_token",
  username: "ops_username",
  role: "ops_role",
  userId: "ops_user_id",
  tenantId: "ops_tenant_id",
  deptId: "ops_dept_id",
  roles: "ops_roles",
  permissions: "ops_permissions",
  needBindEmail: "ops_need_bind_email",
};

const ROLE_LABELS = {
  PLATFORM_ADMIN: "平台管理员",
  TENANT_ADMIN: "企业管理员",
  DEPT_ADMIN: "部门管理员",
  CONTRIBUTOR: "运维工程师",
  VIEWER: "只读成员",
  ADMIN: "管理员",
  OPERATOR: "操作员",
};

function readArray(key) {
  try {
    const raw = localStorage.getItem(key);
    const value = raw ? JSON.parse(raw) : [];
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function readDeptId() {
  const raw = localStorage.getItem(KEYS.deptId);
  if (raw === null || raw === "") return null;
  const n = Number(raw);
  return Number.isNaN(n) ? null : n;
}

function removeAll() {
  Object.values(KEYS).forEach((key) => localStorage.removeItem(key));
}

export const useAuthStore = defineStore("auth", () => {
  // ========== State ==========
  const token = ref(localStorage.getItem(KEYS.token) || "");
  const username = ref(localStorage.getItem(KEYS.username) || "");
  const role = ref(localStorage.getItem(KEYS.role) || "");
  const userId = ref(localStorage.getItem(KEYS.userId) || "");
  const tenantId = ref(localStorage.getItem(KEYS.tenantId) || "");
  const deptId = ref(readDeptId());
  const storedRoles = readArray(KEYS.roles);
  const roles = ref(storedRoles.length ? storedRoles : role.value ? [role.value] : []);
  const permissions = ref(readArray(KEYS.permissions));
  const needBindEmail = ref(localStorage.getItem(KEYS.needBindEmail) === "true");
  const profileLoaded = ref(false);

  // ========== Getters ==========
  const isLoggedIn = computed(() => !!token.value);
  const isPlatformAdmin = computed(() => roles.value.includes("PLATFORM_ADMIN"));
  const isTenantAdmin = computed(() => roles.value.includes("TENANT_ADMIN"));
  const isAdmin = computed(
    () => role.value === "ADMIN" || isPlatformAdmin.value || isTenantAdmin.value
  );
  const isOperator = computed(
    () =>
      role.value === "ADMIN" ||
      role.value === "OPERATOR" ||
      isAdmin.value ||
      roles.value.some((r) => r === "DEPT_ADMIN" || r === "CONTRIBUTOR")
  );
  const userInitial = computed(() => (username.value || "A").charAt(0).toUpperCase());
  const roleLabel = computed(
    () => ROLE_LABELS[roles.value[0]] || ROLE_LABELS[role.value] || role.value || ""
  );

  /**
   * 是否拥有角色（兼容旧 role 字段）
   * @param {string} code 角色编码
   */
  function hasRole(code) {
    return !!code && (roles.value.includes(code) || role.value === code);
  }

  /**
   * 是否拥有权限点
   * @param {string} code 权限点编码，如 knowledge:review
   */
  function hasPermission(code) {
    return !!code && permissions.value.includes(code);
  }

  /**
   * 是否拥有任一权限点
   * @param {string|string[]} codes 权限点或数组
   */
  function hasAnyPermission(codes) {
    if (Array.isArray(codes)) return codes.some((code) => hasPermission(code));
    return hasPermission(codes);
  }

  // ========== 持久化 ==========
  function persist() {
    localStorage.setItem(KEYS.token, token.value || "");
    localStorage.setItem(KEYS.username, username.value || "");
    localStorage.setItem(KEYS.role, role.value || "");
    localStorage.setItem(KEYS.userId, userId.value || "");
    localStorage.setItem(KEYS.tenantId, tenantId.value || "");
    localStorage.setItem(KEYS.deptId, deptId.value === null ? "" : String(deptId.value));
    localStorage.setItem(KEYS.roles, JSON.stringify(roles.value || []));
    localStorage.setItem(KEYS.permissions, JSON.stringify(permissions.value || []));
    localStorage.setItem(KEYS.needBindEmail, needBindEmail.value ? "true" : "false");
  }

  /**
   * 应用登录/当前用户响应到状态
   * @param {object} res 登录或 /auth/me 响应
   */
  function applySession(res) {
    token.value = res.token || token.value || "";
    username.value = res.username || "";
    role.value = res.role || role.value || "";
    userId.value = res.userId || "";
    tenantId.value = res.tenantId || "";
    deptId.value = res.deptId ?? null;
    const list = Array.isArray(res.roles) ? res.roles : [];
    roles.value = list.length ? list : role.value ? [role.value] : [];
    permissions.value = Array.isArray(res.permissions) ? res.permissions : [];
    needBindEmail.value = !!res.needBindEmail;
    profileLoaded.value = true;
    persist();
  }

  // ========== Actions ==========

  /**
   * 登录
   * @param {string} identifier 邮箱或用户名
   * @param {string} password 密码
   */
  async function login(identifier, password) {
    const res = await authApi.login(identifier, password);
    applySession(res);
    return res;
  }

  /**
   * 重新拉取当前用户（刷新页面后补全 roles/permissions）
   */
  async function refreshProfile() {
    const me = await authApi.getCurrentUser();
    applySession(me);
    return me;
  }

  /**
   * 已登录但本地缺少角色/权限时，尝试补全一次
   */
  async function ensureProfile() {
    if (!token.value || profileLoaded.value) return;
    try {
      await refreshProfile();
    } catch {
      // 401 由 request 拦截器统一处理；其他错误忽略，保持本地状态
    }
  }

  /**
   * 退出登录
   */
  function logout() {
    token.value = "";
    username.value = "";
    role.value = "";
    userId.value = "";
    tenantId.value = "";
    deptId.value = null;
    roles.value = [];
    permissions.value = [];
    needBindEmail.value = false;
    profileLoaded.value = false;
    removeAll();
  }

  return {
    // state
    token,
    username,
    role,
    userId,
    tenantId,
    deptId,
    roles,
    permissions,
    needBindEmail,
    // getters
    isLoggedIn,
    isAdmin,
    isPlatformAdmin,
    isTenantAdmin,
    isOperator,
    userInitial,
    roleLabel,
    // actions
    hasRole,
    hasPermission,
    hasAnyPermission,
    login,
    refreshProfile,
    ensureProfile,
    logout,
  };
});
