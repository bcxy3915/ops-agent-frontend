import { defineComponent, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { useSidebarLayout } from './useSidebarLayout'

let viewportWidth
let queries
let wrappers

beforeEach(() => {
  viewportWidth = 1440
  queries = []
  wrappers = []
  localStorage.clear()
  vi.stubGlobal('matchMedia', query => {
    const max = Number(query.match(/\d+/)[0])
    const listeners = new Set()
    const media = {
      get matches() { return viewportWidth <= max },
      addEventListener: (_, callback) => listeners.add(callback),
      removeEventListener: (_, callback) => listeners.delete(callback),
      listeners
    }
    queries.push(media)
    return media
  })
})
afterEach(() => {
  wrappers.forEach(wrapper => wrapper.unmount())
  vi.unstubAllGlobals()
})

/**
 * 挂载带生命周期的侧栏状态，避免测试绕过监听清理。
 * @returns {Object} 无入参，返回侧栏状态引用。
 */
function setup() {
  let state
  wrappers.push(mount(defineComponent({ setup() { state = useSidebarLayout(); return () => null } })))
  return state
}

/**
 * 模拟窗口跨越媒体查询断点。
 * @param {number} width 新窗口宽度。
 * @returns {Promise<void>} 等待视图状态更新，无返回数据。
 */
async function resize(width) {
  viewportWidth = width
  queries.forEach(query => query.listeners.forEach(callback => callback()))
  await nextTick()
}

describe('响应式侧栏状态', () => {
  it('宽屏默认展开，手动选择持久化并在重新挂载后恢复', () => {
    const state = setup()
    expect(state.collapsed.value).toBe(false)
    state.toggle()
    expect(state.collapsed.value).toBe(true)
    expect(localStorage.getItem('ops_sidebar_collapsed')).toBe('true')
    expect(setup().collapsed.value).toBe(true)
  })

  it('缩窄自动收起，允许手动展开，恢复宽屏时还原桌面选择', async () => {
    const state = setup()
    await resize(1000)
    expect(state.collapsed.value).toBe(true)
    state.toggle()
    expect(state.collapsed.value).toBe(false)
    await resize(1440)
    expect(state.collapsed.value).toBe(false)
    await resize(1000)
    expect(state.collapsed.value).toBe(true)
  })

  it('手机默认隐藏抽屉，切换横竖屏时关闭抽屉并应用对应布局', async () => {
    viewportWidth = 390
    const state = setup()
    expect(state.isMobile.value).toBe(true)
    expect(state.drawerOpen.value).toBe(false)
    state.toggle()
    expect(state.drawerOpen.value).toBe(true)
    await resize(844)
    expect(state.drawerOpen.value).toBe(false)
    expect(state.collapsed.value).toBe(true)
    await resize(390)
    expect(state.drawerOpen.value).toBe(false)
  })

  it('自动收起不覆盖桌面手动偏好', async () => {
    const state = setup()
    state.toggle()
    await resize(1000)
    state.toggle()
    await resize(1440)
    expect(state.collapsed.value).toBe(true)
    expect(localStorage.getItem('ops_sidebar_collapsed')).toBe('true')
  })

  it('禁用存储时仍可正常手动切换', () => {
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('禁用存储') })
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('禁用存储') })
    try {
      const state = setup()
      expect(() => state.toggle()).not.toThrow()
      expect(state.collapsed.value).toBe(true)
    } finally {
      get.mockRestore()
      set.mockRestore()
    }
  })

  it('卸载后移除媒体查询监听', () => {
    setup()
    wrappers[0].unmount()
    expect(queries.every(query => query.listeners.size === 0)).toBe(true)
    wrappers = []
  })
})
