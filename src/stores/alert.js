import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { listAlertEvents } from "@/api/alerts";

/**
 * 告警铃铛数据源
 * - pendingCount：待处理告警数（FIRING / SILENCED），用于铃铛红点
 * - recentList：最近待处理告警（默认 5 条），用于 popover 列表
 * - 轮询：页面可见时 30s 一次；不可见时停止（由 AlertBell 组件驱动）
 */
export const useAlertStore = defineStore("alert", () => {
  const pendingCount = ref(0);
  const recentList = ref([]);
  const loading = ref(false);
  const lastFetchedAt = ref(0);

  const hasPending = computed(() => pendingCount.value > 0);

  /** 拉取待处理告警（FIRING + SILENCED，按触发时间倒序取前 20） */
  async function fetchPending() {
    // 距上次请求 <3s 直接跳过，避免 popover 打开瞬间重复请求
    const now = Date.now();
    if (now - lastFetchedAt.value < 3000) return;
    lastFetchedAt.value = now;

    loading.value = true;
    try {
      const res = await listAlertEvents({ limit: 50 });
      const list = (res || []).filter(
        (e) => e.status === "FIRING" || e.status === "SILENCED"
      );
      // 按触发时间倒序
      list.sort((a, b) => {
        const ta = new Date(a.firedAt || 0).getTime();
        const tb = new Date(b.firedAt || 0).getTime();
        return tb - ta;
      });
      recentList.value = list.slice(0, 20);
      pendingCount.value = list.length;
    } catch (e) {
      // 轮询失败静默，保持旧数据，避免弹错误打扰
    } finally {
      loading.value = false;
    }
  }

  /** 标记全部已读（清空红点与列表） */
  function markAllRead() {
    pendingCount.value = 0;
    recentList.value = [];
  }

  return {
    pendingCount,
    recentList,
    loading,
    hasPending,
    fetchPending,
    markAllRead,
  };
});
