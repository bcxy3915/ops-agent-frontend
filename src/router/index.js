import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "@/stores/auth";

const routes = [
  { path: "/", redirect: "/chat" },
  {
    path: "/login",
    name: "Login",
    component: () => import("@/views/Login.vue"),
    meta: { title: "登录" },
  },
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
      {
        path: "services",
        name: "Services",
        component: () => import("@/views/ServiceManage.vue"),
        meta: { title: "服务管理", requiresAuth: true },
      },
      {
        path: "metrics",
        name: "Metrics",
        component: () => import("@/views/Metrics.vue"),
        meta: { title: "指标监控", requiresAuth: true },
      },
      {
        path: "audit",
        name: "AuditLog",
        component: () => import("@/views/AuditLog.vue"),
        meta: { title: "审计日志", requiresAuth: true, roles: ["ADMIN"] },
      },
      {
        path: "users",
        name: "UserManage",
        component: () => import("@/views/UserManage.vue"),
        meta: { title: "用户管理", requiresAuth: true, roles: ["ADMIN"] },
      },
    ],
  },
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
router.beforeEach((to, from, next) => {
  // ★ 必须在函数内部调用，保证 Pinia 已初始化（避免循环依赖）
  const authStore = useAuthStore();
  const isLoggedIn = authStore.isLoggedIn;
  const role = authStore.role;

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

  // 3. 角色权限检查
  if (to.meta.roles && isLoggedIn) {
    if (!to.meta.roles.includes(role)) {
      next("/chat");
      return;
    }
  }

  next();
});

export default router;
