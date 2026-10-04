import axios from "axios";
import { ElMessage } from "element-plus";

// 创建 Axios 实例
const request = axios.create({
  baseURL: "/api",
  timeout: 60000, // LLM 调用可能较慢，设 60 秒
  headers: {
    "Content-Type": "application/json",
  },
});

// ========== 请求拦截器 ==========
request.interceptors.request.use(
  (config) => {
    // 从 localStorage 拿 Token，自动加上
    const token = localStorage.getItem("ops_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ========== 响应拦截器 ==========
request.interceptors.response.use(
  (response) => {
    const res = response.data;

    // 后端统一响应格式：{ code, message, data }
    if (res.code === 0) {
      return res.data;
    }

    // 业务错误
    ElMessage.error(res.message || "请求失败");
    return Promise.reject(new Error(res.message));
  },
  (error) => {
    // HTTP 错误
    const status = error.response?.status;

    switch (status) {
      case 401:
        ElMessage.error("未登录或登录已过期");
        localStorage.removeItem("ops_token");
        // 跳转到登录页
        window.location.href = "/login";
        break;
      case 403:
        ElMessage.error("权限不足");
        break;
      case 429:
        ElMessage.warning("请求过于频繁，请稍后重试");
        break;
      case 500:
        ElMessage.error("服务器内部错误");
        break;
      default:
        ElMessage.error(error.message || "网络错误");
    }

    return Promise.reject(error);
  }
);

export default request;
