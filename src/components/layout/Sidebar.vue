<template>
  <aside class="sidebar">
    <!-- ========== 顶部 Logo + 新建对话 ========== -->
    <div class="sidebar-header">
      <div class="logo">
        <div class="logo-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
            stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
        </div>
        Ops Agent
      </div>
      <button class="new-chat-btn" @click="handleNewChat">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
          stroke-linecap="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        新建对话
      </button>
    </div>

    <!-- ========== 导航 ========== -->
    <nav class="nav">
      <router-link v-for="item in navItems" :key="item.path" :to="item.path" class="nav-item"
        :class="{ active: isActive(item.path) }">
        <el-icon class="nav-icon">
          <component :is="item.icon" />
        </el-icon>
        {{ item.label }}
      </router-link>
    </nav>

    <!-- ========== 会话历史 ========== -->
    <div class="history">
      <div v-if="!authStore.isLoggedIn" class="history-empty">
        <el-icon>
          <Lock />
        </el-icon>
        <span>登录后查看历史会话</span>
      </div>

      <div v-else-if="groupedConversations.length === 0" class="history-empty">
        <el-icon>
          <ChatLineSquare />
        </el-icon>
        <span>暂无历史会话</span>
      </div>

      <template v-else>
        <!-- "查看全部"入口 -->
        <div class="history-view-all" @click="goToHistory">
          <el-icon>
            <Expand />
          </el-icon>
          <span>查看全部对话</span>
        </div>

        <div v-for="group in groupedConversations" :key="group.label" class="history-group">
          <div class="history-label">{{ group.label }}</div>

          <!-- ★ 每一项：标题 + 三个点下拉菜单 -->
          <div v-for="item in group.items" :key="item.sessionId" class="history-item"
            :class="{ active: chatStore.sessionId === item.sessionId }" @click="selectSession(item.sessionId)">
            <span class="history-title">{{ item.title || '新对话' }}</span>

            <!-- ★ 三个点下拉菜单 -->
            <el-dropdown trigger="click" placement="bottom-end" @command="(cmd) => handleItemCommand(cmd, item)"
              @click.stop>
              <div class="item-more" @click.stop>
                <el-icon>
                  <MoreFilled />
                </el-icon>
              </div>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="rename">
                    <el-icon>
                      <Edit />
                    </el-icon>
                    重命名
                  </el-dropdown-item>
                  <el-dropdown-item command="delete" divided>
                    <el-icon>
                      <Delete />
                    </el-icon>
                    删除
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </div>
      </template>
    </div>

    <!-- ========== 底部用户区 ========== -->
    <div v-if="authStore.isLoggedIn" class="user-area-wrapper">
      <el-dropdown popper-class="sidebar-user-dropdown" trigger="click" placement="top-start" @command="handleCommand">
        <div class="user-area">
          <div class="avatar">{{ authStore.userInitial }}</div>
          <div class="user-info">
            <div class="user-name">{{ authStore.username }}</div>
            <div class="user-role">{{ roleLabel }}</div>
          </div>
          <el-icon color="#94A3B8">
            <MoreFilled />
          </el-icon>
        </div>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="profile">
              <el-icon>
                <User />
              </el-icon>个人信息
            </el-dropdown-item>
            <el-dropdown-item command="logout" divided>
              <el-icon>
                <SwitchButton />
              </el-icon>退出登录
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>

    <div v-else class="user-area login-area" @click="goToLogin">
      <div class="avatar guest">
        <el-icon>
          <UserFilled />
        </el-icon>
      </div>
      <div class="user-info">
        <div class="user-name">未登录</div>
        <div class="user-role">点击登录以使用全部功能</div>
      </div>
      <el-icon color="#94A3B8">
        <ArrowRight />
      </el-icon>
    </div>
  </aside>
</template>

<script setup>
import { computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  MoreFilled, UserFilled, ArrowRight, User, SwitchButton,
  Lock, ChatLineSquare, Expand, Edit, Delete
} from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'
import { useChatStore } from '@/stores/chat'
import { groupConversations } from '@/utils/conversation'
import { renameConversation as renameConversationApi } from '@/api/chat'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const chatStore = useChatStore()

// ============ 导航配置 ============
const ALL_NAV_ITEMS = [
  { path: '/chat', label: '对话', icon: 'ChatDotRound' },
  { path: '/services', label: '服务管理', icon: 'Monitor', roles: ['ADMIN', 'OPERATOR', 'VIEWER'] },
  { path: '/metrics', label: '指标监控', icon: 'TrendCharts', roles: ['ADMIN', 'OPERATOR', 'VIEWER'] },
  { path: '/audit', label: '审计日志', icon: 'Document', roles: ['ADMIN'] },
  { path: '/users', label: '用户管理', icon: 'User', roles: ['ADMIN'] }
]

const navItems = computed(() => {
  const role = authStore.role
  return ALL_NAV_ITEMS.filter((item) => {
    if (!item.roles) return true
    if (!authStore.isLoggedIn) return false
    return item.roles.includes(role)
  })
})

function goToHistory() {
  router.push('/chat/history')
}

function isActive(path) {
  return route.path === path || route.path.startsWith(path + '/')
}

// ============ 会话列表分组 ============
const groupedConversations = computed(() => {
  return groupConversations(chatStore.conversations)
})

async function loadConversations() {
  if (!authStore.isLoggedIn) {
    chatStore.conversations = []
    return
  }
  await chatStore.refreshConversations()
}

onMounted(() => {
  loadConversations()
})

watch(
  () => authStore.isLoggedIn,
  (loggedIn) => {
    if (loggedIn) {
      loadConversations()
    } else {
      chatStore.conversations = []
    }
  }
)

// ============ 事件处理 ============
function handleNewChat() {
  chatStore.newConversation()
  router.push('/chat')
}

function goToLogin() {
  router.push('/login')
}

async function selectSession(sessionId) {
  await chatStore.loadConversation(sessionId)
  if (route.path !== '/chat') {
    router.push('/chat')
  }
}

// ★ 处理会话项的下拉菜单命令
async function handleItemCommand(command, item) {
  if (command === 'rename') {
    await renameItem(item)
  } else if (command === 'delete') {
    await deleteItem(item)
  }
}

// ★ 重命名会话
async function renameItem(item) {
  try {
    const { value } = await ElMessageBox.prompt('请输入新的会话标题', '重命名会话', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      inputValue: item.title || '',
      inputValidator: (val) => (!val || !val.trim()) ? '标题不能为空' : true
    })
    if (value && value.trim()) {
      const newTitle = value.trim()
      // 调用后端接口
      await renameConversationApi(item.sessionId, newTitle)
      // 更新本地状态（触发响应式）
      item.title = newTitle
      ElMessage.success('重命名成功')
    }
  } catch (e) {
    // 用户取消
  }
}

// ★ 删除单个会话
async function deleteItem(item) {
  try {
    await ElMessageBox.confirm(`确定要删除会话"${item.title || '未命名'}"吗？`, '提示', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消'
    })
    await chatStore.removeConversation(item.sessionId)
    ElMessage.success('已删除')
  } catch (e) {
    // 用户取消
  }
}

async function handleCommand(command) {
  if (command === 'logout') {
    try {
      await ElMessageBox.confirm('确定要退出登录吗？', '提示', {
        type: 'warning',
        confirmButtonText: '退出',
        cancelButtonText: '取消'
      })
      authStore.logout()
      chatStore.conversations = []
      chatStore.newConversation()
      ElMessage.success('已退出登录')
      router.push('/chat')
    } catch {
      // 用户取消
    }
  } else if (command === 'profile') {
    ElMessage.info('个人信息页面待实现')
  }
}

// ============ 角色标签 ============
const roleLabel = computed(() => {
  const labels = { ADMIN: '管理员', OPERATOR: '操作员', VIEWER: '查看者' }
  return labels[authStore.role] || ''
})
</script>

<style scoped>
/* ============ 侧边栏容器 ============ */
.sidebar {
  width: 260px;
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  border-right: 1px solid rgba(226, 232, 240, 0.6);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

/* ============ 顶部 ============ */
.sidebar-header {
  padding: 16px;
  border-bottom: 1px solid rgba(226, 232, 240, 0.5);
}

.logo {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
  font-weight: 600;
  font-size: 16px;
}

.logo-icon {
  width: 32px;
  height: 32px;
  background: linear-gradient(135deg, #3B82F6 0%, #1E40AF 100%);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  box-shadow: 0 2px 8px rgba(30, 64, 175, 0.25);
}

.new-chat-btn {
  width: 100%;
  padding: 10px 14px;
  background: linear-gradient(135deg, #2563EB 0%, #1E40AF 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: all 0.2s;
  box-shadow: 0 2px 8px rgba(30, 64, 175, 0.2);
}

.new-chat-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(30, 64, 175, 0.3);
}

/* ============ 导航 ============ */
.nav {
  padding: 8px;
  border-bottom: 1px solid rgba(226, 232, 240, 0.5);
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border-radius: 6px;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 13.5px;
  transition: all 0.15s;
  text-decoration: none;
  margin-bottom: 1px;
}

.nav-item:hover {
  background: rgba(30, 64, 175, 0.06);
  color: var(--text-primary);
}

.nav-item.active {
  background: linear-gradient(135deg, rgba(219, 234, 254, 0.9) 0%, rgba(224, 231, 255, 0.7) 100%);
  color: var(--primary);
  font-weight: 500;
  box-shadow: inset 0 0 0 1px rgba(30, 64, 175, 0.1);
}

.nav-icon {
  width: 18px;
  font-size: 16px;
}

/* ============ 会话历史 ============ */
.history {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.history-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 40px 16px;
  color: var(--text-muted);
  font-size: 12.5px;
  text-align: center;
}

.history-empty .el-icon {
  font-size: 24px;
  color: #CBD5E1;
}

.history-view-all {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  margin-bottom: 8px;
  border-radius: 6px;
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}

.history-view-all:hover {
  background: rgba(30, 64, 175, 0.06);
  color: var(--primary);
}

.history-group {
  margin-bottom: 14px;
}

.history-label {
  font-size: 11px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 6px 12px 4px;
  font-weight: 600;
}

/* ★ 修改：history-item 使用 flex 布局，标题占满剩余空间，右侧三个点 */
.history-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 8px 8px 12px;
  border-radius: 6px;
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
  margin-bottom: 1px;
}

.history-item:hover {
  background: rgba(30, 64, 175, 0.05);
  color: var(--text-primary);
}

.history-item.active {
  background: rgba(255, 255, 255, 0.9);
  color: var(--primary);
  font-weight: 500;
  box-shadow: 0 1px 4px rgba(30, 64, 175, 0.08);
}

.history-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ★ 新增：三个点按钮 */
.item-more {
  display: none;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 4px;
  color: #8F959E;
  cursor: pointer;
  flex-shrink: 0;
  font-size: 14px;
  transition: all 0.15s;
}

/* 悬浮在会话项上时显示三个点 */
.history-item:hover .item-more {
  display: flex;
}

.item-more:hover {
  background: rgba(0, 0, 0, 0.08);
  color: #1F2329;
}

/* ============ 底部用户区 ============ */
.user-area-wrapper {
  border-top: 1px solid rgba(226, 232, 240, 0.5);
}

.user-area-wrapper :deep(.el-dropdown) {
  display: block;
  width: 100%;
}

.user-area {
  width: 100%;
  box-sizing: border-box;
  padding: 12px;
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  transition: background 0.15s;
}

.user-area:hover {
  background: rgba(30, 64, 175, 0.04);
}

.avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: linear-gradient(135deg, #818CF8 0%, #6366F1 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 600;
  font-size: 13px;
  flex-shrink: 0;
  box-shadow: 0 2px 6px rgba(99, 102, 241, 0.25);
}

.avatar.guest {
  background: #CBD5E1;
  color: #64748B;
  box-shadow: none;
}

.avatar.guest .el-icon {
  font-size: 16px;
}

.user-info {
  flex: 1;
  min-width: 0;
}

.user-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
}

.user-role {
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.login-area {
  cursor: pointer;
}

.login-area:hover {
  background: rgba(30, 64, 175, 0.06);
}
</style>