import { createRouter, createWebHistory } from "vue-router";
import { ElMessage } from "element-plus";
import { useAuthStore } from "@/stores/auth";

const routes = [
  { path: "/", redirect: "/chat" },
  {
    path: "/login",
    name: "Login",
    component: () => import("@/views/Login.vue"),
    meta: { title: "登录" },
  },
  // ========== 对话工作台壳（左栏：新建对话 + 会话历史 + 管理后台入口） ==========
  {
    path: "/",
    component: () => import("@/components/layout/AppLayout.vue"),
    children: [
      {
        path: "chat",
        name: "Chat",
        component: () => import("@/views/Chat.vue"),
        meta: { title: "对话" },
      },
      {
        path: "chat/history",
        name: "ChatHistory",
        component: () => import("@/views/HistoryChat.vue"),
        meta: { title: "历史对话" },
      },
    ],
  },
  // ========== 管理控制台壳（分组导航：监控运维 / 知识库 / 系统设置） ==========
  {
    path: "/admin",
    component: () => import("@/components/layout/AdminLayout.vue"),
    children: [
      {
        path: "home",
        name: "AdminHome",
        component: () => import("@/views/admin/AdminHome.vue"),
        meta: { title: "管理后台", requiresAuth: true },
      },
      {
        path: "services",
        name: "Services",
        component: () => import("@/views/ServiceManage.vue"),
        meta: { title: "服务管理", requiresAuth: true, permission: "service:read" },
      },
      {
        path: "metrics",
        name: "Metrics",
        component: () => import("@/views/Metrics.vue"),
        meta: { title: "指标监控", requiresAuth: true, permission: "service:read" },
      },
      {
        path: "alerts",
        name: "AlertEvents",
        component: () => import("@/views/admin/alerts/AlertEvents.vue"),
        meta: { title: "告警中心", requiresAuth: true, permission: "alert:read" },
      },
      {
        path: "alerts/:id",
        name: "AlertDetail",
        component: () => import("@/views/admin/alerts/AlertDetail.vue"),
        meta: { title: "告警详情", requiresAuth: true, permission: "alert:read" },
      },
      {
        path: "oncall",
        name: "OncallManage",
        component: () => import("@/views/admin/oncall/OncallManage.vue"),
        meta: { title: "值班管理", requiresAuth: true, permission: "oncall:manage" },
      },
      {
        path: "alert-rules",
        name: "AlertRules",
        component: () => import("@/views/admin/alerts/AlertRules.vue"),
        meta: { title: "告警规则", requiresAuth: true, permission: "alert:manage" },
      },
      {
        path: "knowledge",
        name: "Knowledge",
        component: () => import("@/views/knowledge/Knowledge.vue"),
        meta: { title: "知识库", requiresAuth: true, permission: "knowledge:read" },
      },
      {
        path: "review",
        name: "KnowledgeReview",
        component: () => import("@/views/knowledge/ReviewWorkbench.vue"),
        meta: { title: "审核工作台", requiresAuth: true, permission: "knowledge:review" },
      },
      {
        path: "channels",
        name: "NotificationChannels",
        component: () => import("@/views/admin/alerts/NotificationChannels.vue"),
        meta: { title: "通知渠道", requiresAuth: true, permission: "notification:manage" },
      },
      {
        path: "audit",
        name: "AuditLog",
        component: () => import("@/views/AuditLog.vue"),
        meta: { title: "审计日志", requiresAuth: true, permission: "audit:read" },
      },
      {
        path: "users",
        name: "UserManage",
        component: () => import("@/views/UserManage.vue"),
        meta: { title: "用户管理", requiresAuth: true, permission: "user:read" },
      },
      {
        path: "tenants",
        name: "TenantManage",
        component: () => import("@/views/rbac/Tenants.vue"),
        meta: { title: "租户管理", requiresAuth: true, permission: "tenant:manage" },
      },
      {
        path: "depts",
        name: "DeptManage",
        component: () => import("@/views/rbac/Depts.vue"),
        meta: { title: "部门管理", requiresAuth: true, permission: "dept:read" },
      },
      {
        path: "roles",
        name: "RoleManage",
        component: () => import("@/views/rbac/Roles.vue"),
        meta: { title: "角色权限", requiresAuth: true, permission: "role:manage", platformOnly: true },
      },
    ],
  },
  // ========== 旧路径兼容重定向（迁移到 /admin/*） ==========
  { path: "/services", redirect: "/admin/services" },
  { path: "/metrics", redirect: "/admin/metrics" },
  { path: "/knowledge", redirect: "/admin/knowledge" },
  { path: "/audit", redirect: "/admin/audit" },
  { path: "/users", redirect: "/admin/users" },
  {
    path: "/:pathMatch(.*)*",
    redirect: "/chat",
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

// ========== 路由守卫 ==========
router.beforeEach(async (to, from, next) => {
  // ★ 必须在函数内部调用，保证 Pinia 已初始化（避免循环依赖）
  const authStore = useAuthStore();
  const isLoggedIn = authStore.isLoggedIn;

  document.title = to.meta.title ? `${to.meta.title} · Ops Agent` : "Ops Agent";

  // 1. 需要登录但未登录 → 跳登录页
  if (to.meta.requiresAuth && !isLoggedIn) {
    next(`/login?redirect=${encodeURIComponent(to.fullPath)}`);
    return;
  }

  // 2. 已登录访问登录页 → 跳主页
  if (to.path === "/login" && isLoggedIn) {
    next("/chat");
    return;
  }

  // 3. 刷新页面后补全 roles/permissions（旧 Token 或本地缓存缺失时）
  if (isLoggedIn) {
    await authStore.ensureProfile();
  }

  // 4. 权限点校验（meta.permission 支持字符串或数组）
  if (to.meta.permission && !authStore.hasAnyPermission(to.meta.permission)) {
    ElMessage.warning("无访问权限");
    next("/admin/home");
    return;
  }

  // 5. 仅平台管理员可访问
  if (to.meta.platformOnly && !authStore.isPlatformAdmin) {
    ElMessage.warning("仅平台管理员可访问");
    next("/admin/home");
    return;
  }

  // 6. 兼容旧角色校验（meta.roles）
  if (to.meta.roles && isLoggedIn) {
    if (!to.meta.roles.some((r) => authStore.hasRole(r))) {
      ElMessage.warning("无访问权限");
      next("/chat");
      return;
    }
  }

  next();
});

export default router;
