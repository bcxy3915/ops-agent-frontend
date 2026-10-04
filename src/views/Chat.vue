<template>
  <div class="chat-page">
    <!-- 顶部栏 -->
    <header class="topbar">
      <div class="topbar-title">
        <span v-if="chatStore.messages.length > 0">对话进行中</span>
        <span v-else>新对话</span>
        <span class="session-id">session: {{ sessionId }}</span>
      </div>
      <div class="topbar-badge">
        <span class="badge-dot"></span>
        deepseek-chat
      </div>
      <div v-if="authStore.isLoggedIn" class="topbar-badge">
        多轮记忆 · {{ chatStore.messages.length }} 条
      </div>
      <el-button v-if="chatStore.messages.length > 0" text size="small" @click="clearChat">
        <el-icon>
          <Delete />
        </el-icon>
        清空
      </el-button>
    </header>

    <!-- 消息区 -->
    <div ref="messagesRef" class="messages">
      <!-- 空状态：欢迎页 -->
      <div v-if="chatStore.messages.length === 0" class="welcome">
        <div class="welcome-logo">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
        </div>
        <h2>你好，我是 Ops Agent</h2>
        <p class="welcome-sub">通用运维智能体，用自然语言诊断服务问题</p>

        <div class="quick-questions">
          <div v-for="q in quickQuestions" :key="q" class="quick-question" @click="handleQuickAsk(q)">
            {{ q }}
          </div>
        </div>
      </div>

      <!-- 消息列表 -->
      <div v-else class="messages-inner">
        <ChatMessage v-for="msg in chatStore.messages" :key="msg.id" :message="msg" />
      </div>
    </div>

    <!-- 输入区 -->
    <ChatInput :sending="chatStore.sending" @send="handleSend" @stop="chatStore.stopStream" />
  </div>
</template>

<script setup>
import { ref, nextTick, watch, computed } from 'vue'
import { Delete } from '@element-plus/icons-vue'
import { useChatStore } from '@/stores/chat'
import { useAuthStore } from '@/stores/auth'
import ChatMessage from '@/components/chat/ChatMessage.vue'
import ChatInput from '@/components/chat/ChatInput.vue'

const chatStore = useChatStore()
const authStore = useAuthStore()

const messagesRef = ref(null)

// 会话 ID（暂时随机生成）
const sessionId = computed(() => {
  return 'sess-' + Math.random().toString(36).slice(2, 10)
})

// 推荐问题
const quickQuestions = [
  'todo-service 健康吗',
  'todo-service 的 CPU 使用率是多少',
  'todo-service 响应慢怎么办',
  '内存泄漏排查思路'
]

// 发送消息
async function handleSend(question) {
  await chatStore.sendMessage(question)
  scrollToBottom()
}

// 点击推荐问题
function handleQuickAsk(question) {
  handleSend(question)
}

// 清空对话
function clearChat() {
  chatStore.clearMessages()
}

// 自动滚动到底部
function scrollToBottom() {
  nextTick(() => {
    if (messagesRef.value) {
      messagesRef.value.scrollTop = messagesRef.value.scrollHeight
    }
  })
}

// 监听消息变化，自动滚动
watch(
  () => chatStore.messages.length,
  () => scrollToBottom()
)

// 监听流式内容变化，持续滚动
watch(
  () => chatStore.messages[chatStore.messages.length - 1]?.answer,
  () => scrollToBottom()
)
</script>

<style scoped>
.chat-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

/* 顶部栏 */
.topbar {
  height: 60px;
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  border-bottom: 1px solid rgba(226, 232, 240, 0.6);
  display: flex;
  align-items: center;
  padding: 0 20px;
  gap: 12px;
  flex-shrink: 0;
}

.topbar-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
}

.session-id {
  font-size: 12px;
  color: var(--text-muted);
  font-weight: 400;
  font-family: ui-monospace, monospace;
}

.topbar-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  background: rgba(241, 245, 249, 0.8);
  border-radius: 20px;
  font-size: 12px;
  color: var(--text-secondary);
  border: 1px solid rgba(226, 232, 240, 0.6);
}

.badge-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--success);
  box-shadow: 0 0 0 3px rgba(5, 150, 105, 0.12);
}

/* 消息区 */
.messages {
  flex: 1;
  overflow-y: auto;
  padding: 24px 0;
}

.messages-inner {
  max-width: 820px;
  margin: 0 auto;
  padding: 0 24px;
}

/* 欢迎页 */
.welcome {
  max-width: 720px;
  margin: 0 auto;
  padding: 80px 24px 40px;
  text-align: center;
}

.welcome-logo {
  width: 72px;
  height: 72px;
  margin: 0 auto 24px;
  background: linear-gradient(135deg, #3B82F6 0%, #1E40AF 100%);
  border-radius: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  box-shadow: 0 12px 32px rgba(30, 64, 175, 0.25);
}

.welcome h2 {
  font-size: 24px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 10px;
}

.welcome-sub {
  font-size: 14px;
  color: var(--text-muted);
  margin-bottom: 40px;
}

.quick-questions {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  max-width: 560px;
  margin: 0 auto;
}

.quick-question {
  padding: 12px 18px;
  background: rgba(255, 255, 255, 0.75);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(226, 232, 240, 0.8);
  border-radius: 10px;
  font-size: 13.5px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s;
  text-align: left;
}

.quick-question:hover {
  background: rgba(255, 255, 255, 0.95);
  border-color: #93B4F5;
  color: var(--primary);
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(30, 64, 175, 0.1);
}

@media (max-width: 700px) {
  .quick-questions {
    grid-template-columns: 1fr;
  }
}
</style>