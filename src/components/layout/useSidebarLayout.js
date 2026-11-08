import { computed, onBeforeUnmount, ref } from 'vue'

const STORAGE_KEY = 'ops_sidebar_collapsed'

/**
 * 管理侧栏响应式状态：桌面记住选择，中等宽度默认收起，手机使用抽屉。
 * @returns {Object} 无入参；返回当前模式、收起状态、抽屉状态及切换方法。
 */
export function useSidebarLayout() {
  const mobileQuery = window.matchMedia('(max-width: 767px)')
  const compactQuery = window.matchMedia('(max-width: 1199px)')
  const isMobile = ref(mobileQuery.matches)
  const isCompact = ref(compactQuery.matches)
  const desktopCollapsed = ref(false)
  try {
    desktopCollapsed.value = localStorage.getItem(STORAGE_KEY) === 'true'
  } catch {
    // 浏览器禁用本地存储时，侧栏仍可正常切换。
  }
  const compactOverride = ref(null)
  const drawerOpen = ref(false)
  const collapsed = computed(() => !isMobile.value && (isCompact.value ? (compactOverride.value ?? true) : desktopCollapsed.value))

  /**
   * 更新窗口分档，进入较窄尺寸时重新应用自动收起规则。
   * @returns {void} 无入参，无返回数据。
   */
  function updateViewport() {
    const mobile = mobileQuery.matches
    const compact = compactQuery.matches
    if (mobile !== isMobile.value || compact !== isCompact.value) {
      compactOverride.value = null
      drawerOpen.value = false
    }
    isMobile.value = mobile
    isCompact.value = compact
  }

  /**
   * 手动展开或收起侧栏，桌面选择持久化，手机只切换抽屉。
   * @returns {void} 无入参，无返回数据。
   */
  function toggle() {
    if (isMobile.value) {
      drawerOpen.value = !drawerOpen.value
    } else if (isCompact.value) {
      compactOverride.value = !collapsed.value
    } else {
      desktopCollapsed.value = !desktopCollapsed.value
      try {
        localStorage.setItem(STORAGE_KEY, String(desktopCollapsed.value))
      } catch {
        // 存储不可用时保留当前页面内的手动选择。
      }
    }
  }

  mobileQuery.addEventListener('change', updateViewport)
  compactQuery.addEventListener('change', updateViewport)
  onBeforeUnmount(() => {
    mobileQuery.removeEventListener('change', updateViewport)
    compactQuery.removeEventListener('change', updateViewport)
  })
  return { isMobile, collapsed, drawerOpen, toggle }
}
