<template>
  <div class="page">
    <!-- 顶部栏 -->
    <header class="page-header">
      <h2>用户管理</h2>
      <div class="header-actions">
        <el-input v-model="filters.keyword" placeholder="搜索用户名 / 姓名 / ID" :prefix-icon="Search" clearable
          style="width: 220px" @input="handleSearch" />
        <!-- ★ 规格 5.4：角色 / 状态筛选 -->
        <div class="seg-group">
          <span class="seg-title">角色</span>
          <div class="seg-btns">
            <button v-for="o in ROLE_FILTERS" :key="o.value" class="seg-btn"
              :class="{ active: filters.role === o.value }" @click="pickRole(o.value)">{{ o.label }}</button>
          </div>
        </div>
        <div class="seg-group">
          <span class="seg-title">状态</span>
          <div class="seg-btns">
            <button v-for="o in ENABLED_FILTERS" :key="o.value" class="seg-btn"
              :class="{ active: filters.enabled === o.value }" @click="pickEnabled(o.value)">{{ o.label }}</button>
          </div>
        </div>
        <el-button v-if="canCreate" type="primary" :icon="Plus" @click="handleCreate">
          新增用户
        </el-button>
      </div>
    </header>

    <!-- 表格 -->
    <div class="page-body" v-loading="loading">
      <el-table :data="users" stripe style="width: 100%" :row-class-name="tableRowClass">
        <el-table-column prop="id" label="ID" width="250">
          <template #default="{ row }">
            <span class="mono">{{ row.id }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="username" label="用户名 / 姓名" width="200">
          <template #default="{ row }">
            <div class="user-cell">
              <div class="avatar">{{ (row.displayName || row.username || '?').charAt(0).toUpperCase() }}</div>
              <div>
                <div class="user-name">{{ row.username }}</div>
                <div class="user-display">{{ row.displayName || '-' }}</div>
              </div>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="角色" width="220">
          <template #default="{ row }">
            <el-tag v-for="r in (row.roles && row.roles.length ? row.roles : [row.role])" :key="r" size="small"
              style="margin-right: 4px; margin-bottom: 2px">
              {{ roleLabel(r) }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="部门" width="140">
          <template #default="{ row }">
            {{ deptMap[row.deptId] || '-' }}
          </template>
        </el-table-column>

        <el-table-column prop="phone" label="手机号" width="150">
          <template #default="{ row }">
            <span class="mono">{{ row.phone }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="email" label="邮箱" min-width="180">
          <template #default="{ row }">
            <span class="mono">{{ row.email }}</span>
          </template>
        </el-table-column>

        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <span class="status-badge" :class="row.enabled ? 'enabled' : 'disabled'">
              <span class="dot"></span>
              {{ row.enabled ? '启用' : '禁用' }}
            </span>
          </template>
        </el-table-column>

        <el-table-column label="创建时间" width="170">
          <template #default="{ row }">
            <span class="mono">{{ formatTime(row.createdAt) }}</span>
          </template>
        </el-table-column>

        <!-- ★ P0：操作列（编辑 / 启停 / 删除，仅 ADMIN；自己不可删/禁用） -->
        <el-table-column v-if="canCreate" label="操作" width="170" align="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="handleEdit(row)">编辑</el-button>
            <el-button v-if="row.username !== authStore.username" link :type="row.enabled ? 'warning' : 'success'" @click="handleToggleEnabled(row)">
              {{ row.enabled ? '禁用' : '启用' }}
            </el-button>
            <el-button v-else link disabled title="不能禁用当前登录账号">禁用</el-button>
            <el-button v-if="row.username !== authStore.username" link type="danger" @click="handleDelete(row)">删除</el-button>
            <el-button v-else link disabled title="不能删除当前登录账号">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 说明 -->
      <div class="table-hint">
        <el-icon>
          <InfoFilled />
        </el-icon>
        敏感字段由后端自动脱敏；不能删除 / 禁用当前登录账号、内置 admin 与最后一个管理员；删除用户必须输入账号确认（规格 5.2）
      </div>
    </div>

    <!-- 创建 / 编辑弹窗 -->
    <UserFormDialog v-model="dialogVisible" :mode="dialogMode" :user="editingUser" @success="handleSave" />

    <!-- ★ 规格 5.2：删除必须输入账号 -->
    <el-dialog v-model="deleteVisible" title="删除用户" width="440px" :close-on-click-modal="false">
      <div class="delete-confirm">
        即将删除用户 <b>{{ deleteTarget ? deleteTarget.username : '' }}</b>。该账号将无法登录，操作不可恢复。
        <div class="delete-warn">
          <el-icon><WarningFilled /></el-icon>
          为防止误删，请完整输入账号以确认：
        </div>
        <el-input v-model="deleteInput" :placeholder="`输入账号 ${deleteTarget ? deleteTarget.username : ''}`"
          @keyup.enter="doDelete" />
      </div>
      <template #footer>
        <el-button @click="deleteVisible = false">取消</el-button>
        <el-button type="danger" :disabled="deleteInput !== (deleteTarget ? deleteTarget.username : '')"
          :loading="deleting" @click="doDelete">确认删除</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, InfoFilled, Plus, WarningFilled } from '@element-plus/icons-vue'
import { listUsers, createUser, updateUser, deleteUser } from '@/api/user'
import { listDepts } from '@/api/rbac'
import { useAuthStore } from '@/stores/auth'
import UserFormDialog from '@/components/user/UserFormDialog.vue'

const authStore = useAuthStore()
const canCreate = computed(() => authStore.hasPermission('user:manage'))

const deptMap = ref({})
const users = ref([])
const loading = ref(false)
const dialogVisible = ref(false)
const dialogMode = ref('create')
const editingUser = ref(null)

// 删除二次确认（输入账号）
const deleteVisible = ref(false)
const deleteTarget = ref(null)
const deleteInput = ref('')
const deleting = ref(false)

const ROLE_FILTERS = [
  { label: '全部', value: '' },
  { label: '管理员', value: 'ADMIN' },
  { label: '操作员', value: 'OPERATOR' },
  { label: '查看者', value: 'VIEWER' },
]
const ENABLED_FILTERS = [
  { label: '全部', value: '' },
  { label: '启用', value: '1' },
  { label: '禁用', value: '0' },
]

const filters = reactive({
  keyword: '',
  role: '',
  enabled: ''
})

onMounted(() => {
  loadUsers()
  loadDeptOptions()
})

async function loadDeptOptions() {
  try {
    const list = await listDepts()
    deptMap.value = Object.fromEntries((list || []).map((d) => [d.id, d.name]))
  } catch {
    deptMap.value = {}
  }
}

function pickRole(v) {
  filters.role = v
  loadUsers()
}

function pickEnabled(v) {
  filters.enabled = v
  loadUsers()
}

async function loadUsers() {
  loading.value = true
  try {
    users.value = await listUsers({
      keyword: filters.keyword,
      role: filters.role,
      enabled: filters.enabled === '' ? '' : filters.enabled === '1'
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

// 禁用用户整行降透明度（规格 5.3）
function tableRowClass({ row }) {
  return row.enabled === false ? 'row-disabled' : ''
}

// ---- 创建 ----
function handleCreate() {
  dialogMode.value = 'create'
  editingUser.value = null
  dialogVisible.value = true
}

// ---- 编辑 ----
function handleEdit(row) {
  dialogMode.value = 'edit'
  editingUser.value = row
  dialogVisible.value = true
}

async function handleSave(data) {
  try {
    if (data.mode === 'edit') {
      const payload = {
        displayName: data.displayName,
        deptId: data.deptId ?? null,
        roleIds: data.roleIds || [],
        enabled: data.enabled,
        phone: data.phone || null,
        email: data.email || null,
      }
      if (data.password) payload.password = data.password
      await updateUser(editingUser.value.id, payload)
      ElMessage.success(`用户 "${data.username}" 已更新`)
    } else {
      await createUser({
        username: data.username,
        displayName: data.displayName,
        password: data.password,
        tenantId: data.tenantId || undefined,
        deptId: data.deptId ?? null,
        roleIds: data.roleIds || [],
        phone: data.phone || null,
        email: data.email || null,
      })
      ElMessage.success(`用户 "${data.username}" 创建成功`)
    }
    loadUsers()
  } catch (error) {
    ElMessage.error(error.message || '保存失败')
  }
}

// ---- 启停 ----
async function handleToggleEnabled(row) {
  try {
    await ElMessageBox.confirm(
      `确定${row.enabled ? '禁用' : '启用'}用户 "${row.username}"？`,
      `${row.enabled ? '禁用' : '启用'}用户`,
      { type: 'warning', confirmButtonText: '确定', cancelButtonText: '取消' }
    )
    await updateUser(row.id, { enabled: !row.enabled })
    ElMessage.success(row.enabled ? '已禁用' : '已启用')
    loadUsers()
  } catch (error) {
    if (error && error.message) ElMessage.error(error.message)
  }
}

// ---- 删除（规格 5.2：必须输入账号）----
function handleDelete(row) {
  deleteTarget.value = row
  deleteInput.value = ''
  deleteVisible.value = true
}

async function doDelete() {
  if (!deleteTarget.value || deleteInput.value !== deleteTarget.value.username) {
    ElMessage.warning('请输入正确的账号后再删除')
    return
  }
  deleting.value = true
  try {
    await deleteUser(deleteTarget.value.id)
    ElMessage.success(`用户 "${deleteTarget.value.username}" 已删除`)
    deleteVisible.value = false
    loadUsers()
  } catch (error) {
    if (error && error.message) ElMessage.error(error.message)
  } finally {
    deleting.value = false
  }
}

function roleLabel(role) {
  const map = {
    PLATFORM_ADMIN: '平台管理员',
    TENANT_ADMIN: '企业管理员',
    DEPT_ADMIN: '部门管理员',
    CONTRIBUTOR: '运维工程师',
    VIEWER: '只读成员',
    ADMIN: '管理员',
    OPERATOR: '操作员',
  }
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
  flex-wrap: wrap;
  justify-content: flex-end;
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

.user-name {
  font-weight: 600;
  font-size: 13px;
  color: var(--text-primary);
}

.user-display {
  font-size: 12px;
  color: var(--text-muted);
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

/* 禁用整行（规格 5.3） */
:deep(.el-table .row-disabled) {
  opacity: 0.5;
}

/* 筛选 segmented（规格 5.4） */
.seg-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.seg-title {
  font-size: 12.5px;
  color: var(--text-muted);
}

.seg-btns {
  display: flex;
  background: #EEF2F6;
  border-radius: 8px;
  padding: 2px;
}

.seg-btn {
  border: none;
  background: transparent;
  font-size: 12.5px;
  color: var(--text-secondary);
  padding: 4px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;
}

.seg-btn.active {
  background: #fff;
  color: var(--primary);
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
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

/* 删除确认 */
.delete-confirm {
  font-size: 13.5px;
  color: var(--text-primary);
  line-height: 1.7;
}

.delete-warn {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 12px 0 8px;
  color: var(--danger);
  font-size: 12.5px;
}
</style>
