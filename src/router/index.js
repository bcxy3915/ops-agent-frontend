import { createRouter, createWebHistory } from "vue-router";

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
        // 不需要登录
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
        meta: { title: "审计日志", requiresAuth: true },
      },
      {
        path: "users",
        name: "UserManage",
        component: () => import("@/views/UserManage.vue"),
        meta: { title: "用户管理", requiresAuth: true },
      },
    ],
  },
  // 404 兜底
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
  const token = localStorage.getItem("ops_token");
  const isLoggedIn = !!token;

  // 动态设置浏览器标题
  document.title = to.meta.title ? `${to.meta.title} · Ops Agent` : "Ops Agent";

  // 1. 需要登录但未登录 → 跳登录页（记住原路径）
  if (to.meta.requiresAuth && !isLoggedIn) {
    next(`/login?redirect=${encodeURIComponent(to.fullPath)}`);
    return;
  }

  // 2. 已登录访问登录页 → 跳主页
  if (to.path === "/login" && isLoggedIn) {
    next("/chat");
    return;
  }

  // 3. 其他情况放行
  next();
});

export default router;
