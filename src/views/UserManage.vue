<template>
  <div class="page">
    <!-- 顶部栏 -->
    <header class="page-header">
      <h2>用户管理</h2>
      <div class="header-actions">
        <el-input v-model="filters.keyword" placeholder="搜索用户名 / ID" :prefix-icon="Search" clearable
          style="width: 220px" @input="handleSearch" />
        <el-select v-model="filters.role" placeholder="角色" clearable style="width: 130px" @change="handleSearch">
          <el-option label="管理员" value="ADMIN" />
          <el-option label="操作员" value="OPERATOR" />
          <el-option label="查看者" value="VIEWER" />
        </el-select>
        <el-select v-model="filters.enabled" placeholder="状态" clearable style="width: 110px" @change="handleSearch">
          <el-option label="启用" :value="true" />
          <el-option label="禁用" :value="false" />
        </el-select>
        <!-- ★ 新增：新增用户按钮（仅 ADMIN 可见） -->
        <el-button v-if="canCreate" type="primary" :icon="Plus" @click="handleCreate">
          新增用户
        </el-button>
      </div>
    </header>

    <!-- 表格 -->
    <div class="page-body" v-loading="loading">
      <el-table :data="users" stripe style="width: 100%">
        <el-table-column prop="id" label="ID" width="100">
          <template #default="{ row }">
            <span class="mono">{{ row.id }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="username" label="用户名" width="160">
          <template #default="{ row }">
            <div class="user-cell">
              <div class="avatar">{{ row.username.charAt(0).toUpperCase() }}</div>
              <span>{{ row.username }}</span>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="角色" width="140">
          <template #default="{ row }">
            <span class="role-badge" :class="row.role.toLowerCase()">
              {{ roleLabel(row.role) }}
            </span>
          </template>
        </el-table-column>

        <el-table-column prop="phone" label="手机号" width="160">
          <template #default="{ row }">
            <span class="mono">{{ row.phone }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="email" label="邮箱" min-width="200">
          <template #default="{ row }">
            <span class="mono">{{ row.email }}</span>
          </template>
        </el-table-column>

        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <span class="status-badge" :class="row.enabled ? 'enabled' : 'disabled'">
              <span class="dot"></span>
              {{ row.enabled ? '启用' : '禁用' }}
            </span>
          </template>
        </el-table-column>

        <el-table-column label="创建时间" width="180">
          <template #default="{ row }">
            <span class="mono">{{ formatTime(row.createdAt) }}</span>
          </template>
        </el-table-column>
      </el-table>

      <!-- 说明 -->
      <div class="table-hint">
        <el-icon>
          <InfoFilled />
        </el-icon>
        敏感字段（密码、手机号、邮箱）由后端自动脱敏，前端显示的是脱敏后的值
      </div>
    </div>
    <!-- ★ 新增：用户创建弹窗 -->
    <UserFormDialog v-model="dialogVisible" @success="handleCreateSuccess" />
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Search, InfoFilled, Plus } from '@element-plus/icons-vue'
import { listUsers, createUser } from '@/api/user'
import { useAuthStore } from '@/stores/auth'
import UserFormDialog from '@/components/user/UserFormDialog.vue'

const authStore = useAuthStore()
const canCreate = computed(() => authStore.isAdmin)

const users = ref([])
const loading = ref(false)
const dialogVisible = ref(false)

const filters = reactive({
  keyword: '',
  role: '',
  enabled: ''
})

onMounted(() => {
  loadUsers()
})

async function loadUsers() {
  loading.value = true
  try {
    users.value = await listUsers({
      keyword: filters.keyword,
      role: filters.role,
      enabled: filters.enabled
    })
  } catch (error) {
    ElMessage.error(error.message || '加载失败')
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  loadUsers()
}

function handleCreate() {
  dialogVisible.value = true
}

async function handleCreateSuccess(data) {
  try {
    await createUser(data)
    ElMessage.success(`用户 "${data.username}" 创建成功`)
    loadUsers()
  } catch (error) {
    ElMessage.error(error.message || '创建失败')
  }
}

function roleLabel(role) {
  const map = { ADMIN: '管理员', OPERATOR: '操作员', VIEWER: '查看者' }
  return map[role] || role
}

function formatTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
</script>

<style scoped>
.page {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.page-header {
  height: 64px;
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  border-bottom: 1px solid rgba(226, 232, 240, 0.6);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  gap: 12px;
  flex-shrink: 0;
}

.page-header h2 {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.page-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px 24px;
}

.mono {
  font-family: ui-monospace, monospace;
  font-size: 12.5px;
}

/* 用户单元格 */
.user-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.avatar {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: linear-gradient(135deg, #818CF8 0%, #6366F1 100%);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  flex-shrink: 0;
}

/* 角色标签 */
.role-badge {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 500;
}

.role-badge.admin {
  background: #DBEAFE;
  color: #1E40AF;
}

.role-badge.operator {
  background: #FEF3C7;
  color: #B45309;
}

.role-badge.viewer {
  background: #E5E7EB;
  color: #4B5563;
}

/* 状态标签 */
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 10px;
  border-radius: 10px;
  font-size: 12px;
}

.status-badge .dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

.status-badge.enabled {
  background: var(--success-bg);
  color: var(--success);
}

.status-badge.disabled {
  background: var(--danger-bg);
  color: var(--danger);
}

/* 提示 */
.table-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 16px;
  padding: 10px 14px;
  background: rgba(219, 234, 254, 0.4);
  border-radius: 8px;
  font-size: 12.5px;
  color: var(--primary);
}
</style>