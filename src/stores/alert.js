import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { listAlertEvents, getUnreadAlertCount, markAllAlertEventsRead } from "@/api/alerts";

/**
 * 告警铃铛数据源（P0：已读持久化）
 * - pendingCount：当前用户未读告警数（后端 /unread-count，口径 FIRING/ACK/SILENCED 且未读，规格 1.2）
 * - recentList：最近待处理告警（默认 20 条），用于 popover 列表
 * - 轮询：页面可见时 30s 一次；不可见时停止（由 AlertBell 组件驱动）
 */
export const useAlertStore = defineStore("alert", () => {
  const pendingCount = ref(0);
  const recentList = ref([]);
  const loading = ref(false);
  const lastFetchedAt = ref(0);

  const hasPending = computed(() => pendingCount.value > 0);

  /** 拉取待处理告警（FIRING/ACK/SILENCED，按触发时间倒序取前 20）+ 未读数 */
  async function fetchPending() {
    // 距上次请求 <3s 直接跳过，避免 popover 打开瞬间重复请求
    const now = Date.now();
    if (now - lastFetchedAt.value < 3000) return;
    lastFetchedAt.value = now;

    loading.value = true;
    try {
      const list = (await listAlertEvents({ limit: 50 })) || [];
      const pending = list.filter(
        (e) =>
          e.status === "FIRING" ||
          e.status === "ACKNOWLEDGED" ||
          e.status === "SILENCED"
      );
      // 按触发时间倒序
      pending.sort((a, b) => {
        const ta = new Date(a.firedAt || 0).getTime();
        const tb = new Date(b.firedAt || 0).getTime();
        return tb - ta;
      });
      recentList.value = pending.slice(0, 20);

      // 未读数走后端持久化已读集合计算
      const unread = await getUnreadAlertCount();
      pendingCount.value = (unread && unread.count) || 0;
    } catch (e) {
      // 轮询失败静默，保持旧数据，避免弹错误打扰
    } finally {
      loading.value = false;
    }
  }

  /** 标记全部已读（调后端持久化，刷新后保持已读） */
  async function markAllRead() {
    await markAllAlertEventsRead([]);
    pendingCount.value = 0;
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
