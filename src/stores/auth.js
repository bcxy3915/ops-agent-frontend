import { defineStore } from "pinia";
import { ref, computed } from "vue";
import * as authApi from "@/api/auth";

const TOKEN_KEY = "ops_token";
const USERNAME_KEY = "ops_username";
const ROLE_KEY = "ops_role";

export const useAuthStore = defineStore("auth", () => {
  // ========== State ==========
  const token = ref(localStorage.getItem(TOKEN_KEY) || "");
  const username = ref(localStorage.getItem(USERNAME_KEY) || "");
  const role = ref(localStorage.getItem(ROLE_KEY) || "");

  // ========== Getters ==========
  const isLoggedIn = computed(() => !!token.value);
  const isAdmin = computed(() => role.value === "ADMIN");
  const isOperator = computed(
    () => role.value === "ADMIN" || role.value === "OPERATOR"
  );
  const userInitial = computed(() => {
    return (username.value || "A").charAt(0).toUpperCase();
  });

  // ========== Actions ==========

  /**
   * 登录
   */
  async function login(user, pass) {
    const res = await authApi.login(user, pass);

    token.value = res.token;
    username.value = res.username;
    role.value = res.role;

    // 持久化到 localStorage
    localStorage.setItem(TOKEN_KEY, res.token);
    localStorage.setItem(USERNAME_KEY, res.username);
    localStorage.setItem(ROLE_KEY, res.role);

    return res;
  }

  /**
   * 退出登录
   */
  function logout() {
    token.value = "";
    username.value = "";
    role.value = "";

    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USERNAME_KEY);
    localStorage.removeItem(ROLE_KEY);
  }

  return {
    // state
    token,
    username,
    role,
    // getters
    isLoggedIn,
    isAdmin,
    isOperator,
    userInitial,
    // actions
    login,
    logout,
  };
});
