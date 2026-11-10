<template>
  <div class="app">
    <SidebarFrame v-slot="{ collapsed }"><Sidebar :collapsed="collapsed" @new-chat="handleNewChat" /></SidebarFrame>
    <main class="main">
      <router-view v-slot="{ Component }"><component :is="Component" ref="pageRef" /></router-view>
    </main>
    <LoginDialog v-model="loginVisible" :send-after-login="false" @success="handleLoginSuccess" @closed="handleLoginClosed" />
  </div>
</template>

<script setup>
import { nextTick, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useChatStore } from '@/stores/chat'
import LoginDialog from '@/components/auth/LoginDialog.vue'
import Sidebar from './Sidebar.vue'
import SidebarFrame from './SidebarFrame.vue'

const router = useRouter()
const authStore = useAuthStore()
const chatStore = useChatStore()
const loginVisible = ref(false)
const pageRef = ref(null)
let focusAfterLogin = false

/**
 * 未登录时仅打开登录框，不修改会话和输入内容。
 * 无入参。
 * @returns {Promise<void>} 完成登录引导或新建对话，无返回数据。
 */
async function handleNewChat() {
  if (!authStore.isLoggedIn) {
    loginVisible.value = true
    return
  }
  await startNewConversation()
}

/**
 * 登录完成后新建空对话，不自动发送任何问题。
 * 无入参。
 * @returns {Promise<void>} 等待新对话页面就绪，无返回数据。
 */
async function handleLoginSuccess() {
  focusAfterLogin = true
  await startNewConversation()
}

/**
 * 延用现有会话创建逻辑，并将焦点移至问题输入框。
 * 无入参。
 * @returns {Promise<void>} 等待导航及视图更新，无返回数据。
 */
async function startNewConversation() {
  chatStore.newConversation()
  await router.push('/chat')
  await nextTick()
  pageRef.value?.focusInput?.()
}

/**
 * 登录成功后的弹窗动画结束时恢复输入焦点，取消登录时不触发新建。
 * 无入参。
 * @returns {void} 无返回数据。
 */
function handleLoginClosed() {
  if (focusAfterLogin) {
    focusAfterLogin = false
    pageRef.value?.focusInput?.()
  }
}
</script>

<style scoped>
.app { height: 100dvh; }
@media (max-width: 767px) { .app { flex-direction: column; } }
.main {
  min-height: 0;
  background: rgba(255, 255, 255, 0.35);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}
</style>
