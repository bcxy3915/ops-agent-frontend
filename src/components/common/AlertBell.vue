<template>
  <div class="alert-bell-wrap">
    <!-- 铃铛按钮：点击弹出告警列表，不直接跳转（规格 1.1：无未读/有未读/脉冲/加载 四态） -->
    <el-popover
      v-model:visible="visible"
      placement="bottom-end"
      :width="420"
      trigger="click"
      popper-class="alert-bell-popover"
      @show="handleShow"
      @hide="handleHide"
    >
      <template #reference>
        <button
          class="bell-btn"
          :class="{
            active: visible,
            'has-pending': alertStore.hasPending,
            shaking: alertStore.hasPending && !alertStore.loading,
            loading: alertStore.loading,
          }"
          :disabled="alertStore.loading"
          :aria-label="`待处理告警 ${alertStore.pendingCount} 条`"
        >
          <el-icon :size="17">
            <Bell />
          </el-icon>
          <transition name="badge-pulse">
            <span v-if="alertStore.hasPending" class="bell-badge">
              {{ badgeText }}
            </span>
          </transition>
        </button>
      </template>

      <!-- ========== Popover 内容（规格 1.3：420px、5 条、严重度竖条、相对时间、状态徽标） ========== -->
      <div class="alert-panel">
        <!-- 标题栏 -->
        <div class="alert-panel-head">
          <span class="alert-panel-title">
            待处理告警
            <b v-if="alertStore.pendingCount > 0">· {{ alertStore.pendingCount }} 条未读</b>
          </span>
        </div>

        <!-- 告警列表（最多 5 条，超出滚动） -->
        <div v-if="alertStore.recentList.length > 0" class="alert-list">
          <div
            v-for="item in alertStore.recentList.slice(0, 5)"
            :key="item.id"
            class="alert-item"
            @click="goAlertDetail(item)"
          >
            <span class="alert-sev" :class="sevCls(item.status)"></span>
            <div class="alert-item-main">
              <div class="alert-item-title" :title="alertTitle(item)">
                {{ alertTitle(item) }}
              </div>
              <div class="alert-item-meta">
                {{ item.service }} · {{ relTime(item.firedAt) }}
              </div>
            </div>
            <span class="alert-status-tag" :class="tagCls(item.status)">
              {{ statusLabel(item.status) }}
            </span>
          </div>
        </div>

        <!-- 空态 -->
        <div v-else class="alert-empty">
          <el-icon :size="26"><CircleCheck /></el-icon>
          <span>✅ 无待处理告警</span>
          <span class="alert-empty-sub">当前系统运行良好</span>
        </div>

        <!-- 底部：查看全部告警（次要）+ 标记全部已读（空列表时 disabled，规格 1.4 无二次确认） -->
        <div class="alert-panel-foot">
          <el-button size="small" text @click="goAllAlerts">查看全部告警</el-button>
          <el-button
            v-if="authStore.isLoggedIn"
            size="small"
            type="primary"
            text
            :disabled="alertStore.pendingCount === 0 || alertStore.loading"
            :loading="alertStore.loading"
            @click="handleMarkAllRead"
          >
            标记全部已读
          </el-button>
        </div>
      </div>
    </el-popover>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import { Bell, CircleCheck } from "@element-plus/icons-vue";
import { useAlertStore } from "@/stores/alert";
import { useAuthStore } from "@/stores/auth";

const router = useRouter();
const alertStore = useAlertStore();
const authStore = useAuthStore();

const visible = ref(false);

// ============ 徽标 ============
const badgeText = computed(() => {
  const n = alertStore.pendingCount;
  return n > 99 ? "99+" : String(n);
});

// ============ 标题 ============
function alertTitle(item) {
  // 优先规则名/服务+指标组成标题，超出省略
  return (
    item.ruleName ||
    `${item.service} ${item.metric} 告警`
  );
}

// ============ 状态样式（规格 1.3：状态徽标文字 + 色块） ============
const STATUS_LABEL = { FIRING: "待处理", SILENCED: "已静默", ACKNOWLEDGED: "已确认", RESOLVED: "已恢复" };
const SEV_CLS = { FIRING: "sev-danger", SILENCED: "sev-warning", ACKNOWLEDGED: "sev-info", RESOLVED: "sev-muted" };
const TAG_CLS = { FIRING: "tag-danger", SILENCED: "tag-warning", ACKNOWLEDGED: "tag-info", RESOLVED: "tag-muted" };
function statusLabel(s) { return STATUS_LABEL[s] || s || "-"; }
function sevCls(s) { return SEV_CLS[s] || "sev-muted"; }
function tagCls(s) { return TAG_CLS[s] || "tag-muted"; }

// ============ 相对时间 ============
function relTime(t) {
  if (!t) return "";
  const diff = Date.now() - new Date(t).getTime();
  if (diff < 60 * 1000) return "刚刚";
  if (diff < 3600 * 1000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 24 * 3600 * 1000) return `${Math.floor(diff / 3600000)} 小时前`;
  return `${Math.floor(diff / 86400000)} 天前`;
}

// ============ 交互 ============
function handleShow() {
  alertStore.fetchPending();
  // 打开时暂停轮询，避免列表刷新抖动
  stopPolling();
}
function handleHide() {
  startPolling();
}
function goAlertDetail(item) {
  visible.value = false;
  router.push(`/admin/alerts/${item.id}`);
}
function goAllAlerts() {
  visible.value = false;
  router.push("/admin/alerts");
}
async function handleMarkAllRead() {
  try {
    await alertStore.markAllRead();
    visible.value = false;
    ElMessage.success("已标记全部已读");
  } catch (e) {
    ElMessage.error(e.message || "标记已读失败");
  }
}

// ============ 轮询（页面可见时 30s 一次） ============
let timer = null;
function startPolling() {
  stopPolling();
  if (document.visibilityState !== "visible") return;
  timer = setInterval(() => alertStore.fetchPending(), 30000);
}
function stopPolling() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
function onVisibilityChange() {
  if (document.visibilityState === "visible") {
    alertStore.fetchPending();
    startPolling();
  } else {
    stopPolling();
  }
}

// 登录态变化：登录后立即拉一次
watch(
  () => authStore.isLoggedIn,
  (v) => {
    if (v) alertStore.fetchPending();
  }
);

onMounted(() => {
  if (authStore.isLoggedIn) alertStore.fetchPending();
  startPolling();
  document.addEventListener("visibilitychange", onVisibilityChange);
});
onUnmounted(() => {
  stopPolling();
  document.removeEventListener("visibilitychange", onVisibilityChange);
});
</script>

<style scoped>
.alert-bell-wrap {
  display: inline-flex;
  align-items: center;
}

.bell-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: 1px solid rgba(226, 232, 240, 0.6);
  background: rgba(241, 245, 249, 0.8);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s;
  outline: none;
}

.bell-btn:hover {
  background: rgba(219, 234, 254, 0.6);
  color: var(--primary);
  border-color: rgba(37, 99, 235, 0.25);
}

.bell-btn.active {
  background: rgba(37, 99, 235, 0.1);
  color: var(--primary);
  border-color: rgba(37, 99, 235, 0.3);
}

/* 加载态（规格 1.1）：禁用 + 灰色 */
.bell-btn.loading {
  opacity: 0.55;
  cursor: default;
  pointer-events: none;
}

/* 有未读时的 1s 摇动脉冲（规格 1.1） */
.bell-btn.shaking .el-icon {
  display: inline-block;
  animation: bellShake 1s ease-in-out infinite;
}
@keyframes bellShake {
  0%, 100% { transform: rotate(0); }
  10% { transform: rotate(-15deg); }
  20% { transform: rotate(12deg); }
  30% { transform: rotate(-10deg); }
  40% { transform: rotate(8deg); }
  50% { transform: rotate(-5deg); }
  60%, 90% { transform: rotate(0); }
}

.bell-btn.has-pending::after {
  content: "";
  position: absolute;
  top: 6px;
  right: 6px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #dc2626;
  box-shadow: 0 0 0 2px rgba(220, 38, 38, 0.15);
}

.bell-badge {
  position: absolute;
  top: -5px;
  right: -5px;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 10px;
  background: #dc2626;
  color: #fff;
  font-size: 10.5px;
  line-height: 18px;
  text-align: center;
  font-weight: 600;
  box-shadow: 0 2px 6px rgba(220, 38, 38, 0.35);
}

.badge-pulse-enter-active {
  animation: badgePulse 0.35s ease-out;
}
@keyframes badgePulse {
  0% { transform: scale(0.5); }
  60% { transform: scale(1.25); }
  100% { transform: scale(1); }
}

/* ============ Popover 内容 ============ */
.alert-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px 8px;
}

.alert-panel-title {
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
}

.alert-panel-title b {
  font-weight: 600;
  color: var(--primary);
}

.alert-list {
  max-height: 420px;
  overflow-y: auto;
  padding: 4px 8px 8px;
}

.alert-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s;
}

.alert-item:hover {
  background: #f8faff;
}

.alert-sev {
  width: 3px;
  height: 32px;
  border-radius: 2px;
  flex-shrink: 0;
}
.sev-danger { background: #dc2626; }
.sev-warning { background: #d97706; }
.sev-info { background: #0d9488; }
.sev-muted { background: #cbd5e1; }

.alert-item-main {
  flex: 1;
  min-width: 0;
}

.alert-item-title {
  font-size: 14px;
  color: #1f2937;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.alert-item-meta {
  font-size: 12.5px;
  color: #6b7280;
  margin-top: 2px;
}

/* 状态文字徽标（规格 1.3） */
.alert-status-tag {
  flex-shrink: 0;
  font-size: 11.5px;
  line-height: 1;
  padding: 4px 8px;
  border-radius: 10px;
  font-weight: 500;
}
.tag-danger { background: rgba(220, 38, 38, 0.1); color: #dc2626; }
.tag-warning { background: rgba(217, 119, 6, 0.12); color: #d97706; }
.tag-info { background: rgba(13, 148, 136, 0.1); color: #0d9488; }
.tag-muted { background: rgba(148, 163, 184, 0.14); color: #64748b; }

.alert-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 36px 0 32px;
  color: #94a3b8;
  font-size: 13px;
}
.alert-empty-sub {
  color: #b6c2d0;
  font-size: 12px;
}

.alert-panel-foot {
  border-top: 1px solid rgba(226, 232, 240, 0.6);
  padding: 8px 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
