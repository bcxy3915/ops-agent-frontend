<template>
  <div class="admin-shell">
    <!-- ========== 管理壳侧边栏 ========== -->
    <aside class="admin-sidebar">
      <!-- 返回对话 -->
      <div class="adm-back" @click="goChat">
        <el-icon>
          <ArrowLeft />
        </el-icon>
        <span>返回对话</span>
      </div>

      <!-- 品牌 -->
      <div class="adm-brand">
        <div class="adm-brand-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
            stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
        </div>
        <div class="adm-brand-text">
          <div class="adm-brand-title">Ops Agent</div>
          <div class="adm-brand-sub">管理控制台</div>
        </div>
      </div>

      <!-- 分组导航 -->
      <nav class="adm-nav">
        <template v-for="group in navGroups" :key="group.key">
          <div v-if="group.visible" class="adm-nav-group">
            <div class="adm-nav-label">{{ group.label }}</div>
            <router-link v-for="item in group.items.filter((i) => i.visible !== false)" :key="item.path" :to="item.path" class="adm-nav-item"
              :class="{ active: isActive(item.path) }">
              <el-icon class="adm-nav-icon">
                <component :is="item.icon" />
              </el-icon>
              {{ item.label }}
            </router-link>
          </div>
        </template>
      </nav>

      <!-- 底部用户区 -->
      <div v-if="authStore.isLoggedIn" class="adm-user-wrapper">
        <el-dropdown popper-class="admin-user-dropdown" trigger="click" placement="top-start" @command="handleCommand">
          <div class="adm-user">
            <div class="avatar">{{ authStore.userInitial }}</div>
            <div class="adm-user-info">
              <div class="adm-user-name">{{ authStore.username }}</div>
              <div class="adm-user-role">{{ roleLabel }}</div>
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
    </aside>

    <!-- ========== 内容区 ========== -->
    <main class="admin-main">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  ArrowLeft, MoreFilled, User, SwitchButton,
  Monitor, TrendCharts, Bell, SetUp, Collection, Document, User as UserIcon,
  ChatDotRound, UserFilled, OfficeBuilding, Connection, Key, DocumentChecked
} from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'
import { useChatStore } from '@/stores/chat'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const chatStore = useChatStore()

// ============ 分组导航（按权限点显隐） ============
const navGroups = computed(() => {
  const can = (code) => authStore.hasPermission(code)
  const groups = [
    {
      key: 'monitor',
      label: '监控运维',
      items: [
        { path: '/admin/services', label: '服务管理', icon: Monitor, visible: can('service:read') },
        { path: '/admin/metrics', label: '指标监控', icon: TrendCharts, visible: can('service:read') },
        { path: '/admin/alerts', label: '告警中心', icon: Bell, visible: can('alert:read') },
        { path: '/admin/oncall', label: '值班管理', icon: UserFilled, visible: can('oncall:manage') },
        { path: '/admin/alert-rules', label: '告警规则', icon: SetUp, visible: can('alert:manage') },
      ],
    },
    {
      key: 'knowledge',
      label: '知识库',
      items: [
        { path: '/admin/knowledge', label: '知识库', icon: Collection, visible: can('knowledge:read') },
        { path: '/admin/review', label: '审核工作台', icon: DocumentChecked, visible: can('knowledge:review') },
      ],
    },
    {
      key: 'system',
      label: '系统设置',
      items: [
        { path: '/admin/tenants', label: '租户管理', icon: OfficeBuilding, visible: can('tenant:manage') },
        { path: '/admin/depts', label: '部门管理', icon: Connection, visible: can('dept:read') },
        { path: '/admin/roles', label: '角色权限', icon: Key, visible: can('role:manage') },
        { path: '/admin/users', label: '用户管理', icon: UserIcon, visible: can('user:read') },
        { path: '/admin/channels', label: '通知渠道', icon: ChatDotRound, visible: can('notification:manage') },
        { path: '/admin/audit', label: '审计日志', icon: Document, visible: can('audit:read') },
      ],
    },
  ]
  return groups
    .map((group) => ({ ...group, visible: group.items.some((item) => item.visible) }))
})

function isActive(path) {
  return route.path === path || route.path.startsWith(path + '/')
}

function goChat() {
  router.push('/chat')
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
const roleLabel = computed(() => authStore.roleLabel)
</script>

<style scoped>
/* ============ 管理壳容器 ============ */
.admin-shell {
  display: flex;
  height: 100vh;
  overflow: hidden;
}

/* ============ 管理壳侧边栏 ============ */
.admin-sidebar {
  width: 260px;
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  border-right: 1px solid rgba(226, 232, 240, 0.6);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.adm-back {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 14px 12px 6px;
  padding: 8px 12px;
  border-radius: 8px;
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}

.adm-back:hover {
  background: rgba(30, 64, 175, 0.06);
  color: var(--primary);
}

.adm-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 16px 16px;
  border-bottom: 1px solid rgba(226, 232, 240, 0.5);
}

.adm-brand-icon {
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

.adm-brand-title {
  font-weight: 600;
  font-size: 15px;
  color: var(--text-primary);
}

.adm-brand-sub {
  font-size: 11px;
  color: var(--text-muted);
}

/* ============ 分组导航 ============ */
.adm-nav {
  flex: 1;
  overflow-y: auto;
  padding: 12px 8px;
}

.adm-nav-group {
  margin-bottom: 16px;
}

.adm-nav-label {
  font-size: 11px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 6px 12px 6px;
  font-weight: 600;
}

.adm-nav-item {
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

.adm-nav-item:hover {
  background: rgba(30, 64, 175, 0.06);
  color: var(--text-primary);
}

.adm-nav-item.active {
  background: linear-gradient(135deg, rgba(219, 234, 254, 0.9) 0%, rgba(224, 231, 255, 0.7) 100%);
  color: var(--primary);
  font-weight: 500;
  box-shadow: inset 0 0 0 1px rgba(30, 64, 175, 0.1);
}

.adm-nav-icon {
  width: 18px;
  font-size: 16px;
}

/* ============ 底部用户区 ============ */
.adm-user-wrapper {
  border-top: 1px solid rgba(226, 232, 240, 0.5);
}

.adm-user-wrapper :deep(.el-dropdown) {
  display: block;
  width: 100%;
}

.adm-user {
  width: 100%;
  box-sizing: border-box;
  padding: 12px;
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  transition: background 0.15s;
}

.adm-user:hover {
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

.adm-user-info {
  flex: 1;
  min-width: 0;
}

.adm-user-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
}

.adm-user-role {
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ============ 内容区 ============ */
.admin-main {
  flex: 1;
  overflow-y: auto;
  background: rgba(255, 255, 255, 0.35);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}
</style>
