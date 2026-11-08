<template>
  <div class="navigation-frame" :class="{ 'is-collapsed': collapsed, 'is-mobile': isMobile }" @transitionend="onWidthTransition">
    <div class="navigation-controls">
      <span v-if="isMobile" class="navigation-mobile-brand">Ops Agent</span>
      <button ref="toggleButton" class="navigation-toggle" type="button" :aria-label="toggleLabel" :title="toggleLabel"
        :aria-expanded="isMobile ? drawerOpen : !collapsed" @click="toggle">
        <el-icon :size="19"><Expand v-if="isMobile || collapsed" /><Fold v-else /></el-icon>
      </button>
    </div>
    <div v-if="!isMobile" class="navigation-content"><slot :collapsed="collapsed" /></div>
    <el-drawer v-if="isMobile" v-model="drawerOpen" direction="ltr" size="min(280px, 86vw)" :with-header="false"
      append-to-body class="navigation-drawer" aria-label="侧栏导航" @closed="restoreFocus">
      <div class="drawer-navigation">
        <div class="navigation-controls"><span class="navigation-mobile-brand">导航</span>
          <button class="navigation-toggle" type="button" aria-label="关闭侧栏" title="关闭侧栏" @click="drawerOpen = false"><el-icon :size="19"><Close /></el-icon></button>
        </div>
        <div class="navigation-content" @click="handleNavigation"><slot :collapsed="false" /></div>
      </div>
    </el-drawer>
  </div>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Expand, Fold, Close } from '@element-plus/icons-vue'
import { useSidebarLayout } from './useSidebarLayout'

const route = useRoute()
const { isMobile, collapsed, drawerOpen, toggle } = useSidebarLayout()
const toggleButton = ref(null)
const toggleLabel = computed(() => isMobile.value ? '打开侧栏' : (collapsed.value ? '展开侧栏' : '收起侧栏'))
watch(() => route.fullPath, () => { drawerOpen.value = false })
watch(collapsed, async () => {
  await nextTick()
  window.dispatchEvent(new Event('resize'))
})

/**
 * 侧栏宽度动画结束后通知现有图表重新计算内容区尺寸。
 * @param {TransitionEvent} event 侧栏上的过渡事件。
 * @returns {void} 无返回数据。
 */
function onWidthTransition(event) {
  if (event.target === event.currentTarget && event.propertyName === 'width') window.dispatchEvent(new Event('resize'))
}

/**
 * 手机选中导航后关闭抽屉，同一路由的重复点击也生效。
 * @param {MouseEvent} event 抽屉中的点击事件。
 * @returns {void} 无返回数据。
 */
function handleNavigation(event) {
  if (event.target.closest('a[href], [data-sidebar-navigation]')) drawerOpen.value = false
}

/**
 * 关闭抽屉后将键盘焦点还给入口按钮。
 * @returns {void} 无入参，无返回数据。
 */
function restoreFocus() {
  toggleButton.value?.focus()
}
</script>

<style scoped>
.navigation-frame { width: 260px; flex-shrink: 0; display: flex; flex-direction: column; min-height: 0; background: rgba(255,255,255,.72); border-right: 1px solid var(--border); transition: width .18s ease; }
.navigation-frame.is-collapsed { width: 64px; }
.navigation-controls { display: flex; align-items: center; justify-content: flex-end; flex-shrink: 0; gap: 12px; padding: 6px 12px; min-height: 44px; }
.is-collapsed .navigation-controls { justify-content: center; padding-inline: 8px; }
.navigation-toggle { width: 32px; height: 32px; display: inline-flex; align-items: center; justify-content: center; border: 0; border-radius: 7px; background: transparent; color: var(--text-secondary); cursor: pointer; flex-shrink: 0; }
.navigation-toggle:hover { background: var(--bg-hover); color: var(--primary); }
.navigation-toggle:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
.navigation-content { display: flex; flex: 1; min-height: 0; overflow: hidden; }
.navigation-content :deep(> aside) { width: 100%; min-width: 0; height: 100%; border-right: 0; }
.navigation-frame.is-mobile { width: 100%; border-right: 0; border-bottom: 1px solid var(--border); }
.is-mobile .navigation-controls { flex-direction: row-reverse; justify-content: flex-end; }
.navigation-mobile-brand { font-weight: 600; font-size: 14px; color: var(--text-primary); margin-right: auto; }
.is-mobile .navigation-mobile-brand { margin-right: 0; }
.drawer-navigation { height: 100%; display: flex; flex-direction: column; background: #f8fafd; }
:global(.navigation-drawer > .el-drawer__body) { padding: 0; overflow: hidden; }
@media (prefers-reduced-motion: reduce) { .navigation-frame { transition: none; } }
</style>
