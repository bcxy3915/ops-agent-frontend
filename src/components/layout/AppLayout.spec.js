import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, reactive } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AppLayout from './AppLayout.vue'
import LoginDialog from '@/components/auth/LoginDialog.vue'

const mocks = vi.hoisted(() => ({ push: vi.fn(), newConversation: vi.fn() }))
let auth
vi.mock('vue-router', () => ({ useRouter: () => ({ push: mocks.push }) }))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => auth }))
vi.mock('@/stores/chat', () => ({ useChatStore: () => ({ newConversation: mocks.newConversation }) }))

const Page = defineComponent({
  template: '<textarea value="尚未发送的问题" />',
  setup(_, { expose }) {
    expose({ focusInput: mocks.focusInput = vi.fn() })
  }
})

/**
 * 挂载真实工作台和登录弹窗，替换路由与登录请求以避免外部调用。
 * 无入参。
 * @returns {Object} 可验证交互的组件包装器。
 */
function mountLayout() {
  return mount(AppLayout, {
    global: {
      stubs: {
        SidebarFrame: { template: '<div><slot :collapsed="false" /></div>' },
        Sidebar: { emits: ['new-chat'], template: '<button @click="$emit(\'new-chat\')">新建对话</button>' },
        RouterView: { setup: () => ({ Page }), template: '<slot :Component="Page" />' },
        LoginForm: { emits: ['success'], template: '<button class="login-success" @click="$emit(\'success\')">模拟登录成功</button>' },
        ElDialog: { props: ['modelValue'], template: '<div v-if="modelValue" class="dialog"><slot name="header" /><slot /></div>' },
        ElIcon: true
      }
    }
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  auth = reactive({ isLoggedIn: false })
  mocks.push.mockResolvedValue(undefined)
})

describe('新建对话登录引导', () => {
  it('未登录点击后打开已有登录框，不新建会话、不跳转，提示不包含自动发送', async () => {
    const wrapper = mountLayout()
    await wrapper.get('button').trigger('click')
    expect(wrapper.get('.dialog').text()).toContain('登录后即可开始对话，并保存对话历史')
    expect(wrapper.get('.dialog').text()).not.toContain('自动发送')
    expect(mocks.newConversation).not.toHaveBeenCalled()
    expect(mocks.push).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('取消登录保留当前页面与输入内容，不触发新建', async () => {
    const wrapper = mountLayout()
    await wrapper.get('button').trigger('click')
    wrapper.getComponent(LoginDialog).vm.$emit('update:modelValue', false)
    await flushPromises()
    expect(wrapper.find('.dialog').exists()).toBe(false)
    expect(wrapper.get('textarea').element.value).toBe('尚未发送的问题')
    expect(mocks.newConversation).not.toHaveBeenCalled()
    expect(mocks.push).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('登录成功后仅新建一次对话，关闭弹窗并聚焦输入框', async () => {
    const wrapper = mountLayout()
    await wrapper.get('button').trigger('click')
    auth.isLoggedIn = true
    await wrapper.get('.login-success').trigger('click')
    await flushPromises()
    expect(wrapper.find('.dialog').exists()).toBe(false)
    expect(mocks.newConversation).toHaveBeenCalledTimes(1)
    expect(mocks.push).toHaveBeenCalledWith('/chat')
    wrapper.getComponent(LoginDialog).vm.$emit('closed')
    expect(mocks.focusInput).toHaveBeenCalled()
    wrapper.unmount()
  })

  it('已登录时沿用新建逻辑，不弹出登录框', async () => {
    auth.isLoggedIn = true
    const wrapper = mountLayout()
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(wrapper.find('.dialog').exists()).toBe(false)
    expect(mocks.newConversation).toHaveBeenCalledTimes(1)
    expect(mocks.focusInput).toHaveBeenCalled()
    wrapper.unmount()
  })

  it('发送问题使用的登录弹窗仍默认提示自动发送', () => {
    const wrapper = mount(LoginDialog, {
      props: { modelValue: true },
      global: { stubs: {
        ElDialog: { template: '<div><slot /></div>' }, ElIcon: true, LoginForm: true
      } }
    })
    expect(wrapper.text()).toContain('登录成功后会自动发送你刚才输入的内容')
    wrapper.unmount()
  })
})
