<template>
  <div class="page">
    <div class="page-header">
      <div class="page-header-left">
        <h2 class="page-title">值班管理</h2>
        <span class="page-subtitle">主值班 / 备值班配置与通知升级联动</span>
      </div>
      <div class="page-header-actions">
        <el-button type="primary" :icon="Plus" :disabled="!canWrite" @click="openAdd('PRIMARY')">添加主值班</el-button>
        <el-button type="warning" plain :icon="Plus" :disabled="!canWrite" @click="openAdd('BACKUP')">添加备值班</el-button>
      </div>
    </div>

    <div class="page-body" v-loading="loading">
      <div class="oncall-summary">
        <div class="oncall-summary-card">
          <div class="oncall-summary-icon primary"><el-icon><UserFilled /></el-icon></div>
          <div>
            <div class="oncall-summary-label">主值班（PRIMARY）</div>
            <div class="oncall-summary-value">{{ primaryList.length }} <small>人</small></div>
          </div>
        </div>
        <div class="oncall-summary-card">
          <div class="oncall-summary-icon backup"><el-icon><UserFilled /></el-icon></div>
          <div>
            <div class="oncall-summary-label">备值班（BACKUP）</div>
            <div class="oncall-summary-value">{{ backupList.length }} <small>人</small></div>
          </div>
        </div>
      </div>

      <div class="oncall-table-card">
        <el-table :data="sortedMembers" stripe>
          <el-table-column label="值班类型" width="130">
            <template #default="{ row }">
              <span class="oncall-role-tag" :class="row.dutyRole === 'PRIMARY' ? 'primary' : 'backup'">
                {{ row.dutyRole === 'PRIMARY' ? '主值班' : '备值班' }}
              </span>
            </template>
          </el-table-column>
          <el-table-column label="值班人" min-width="240">
            <template #default="{ row }">
              <div class="oncall-person">
                <div class="oncall-avatar" :class="row.dutyRole === 'PRIMARY' ? 'primary' : 'backup'">
                  {{ avatarText(row.userId) }}
                </div>
                <div class="oncall-person-info">
                  <div class="oncall-person-name">{{ userName(row.userId) }}</div>
                  <div class="oncall-person-id">{{ row.userId }}</div>
                </div>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="添加人" width="150">
            <template #default="{ row }">{{ row.addedBy || '-' }}</template>
          </el-table-column>
          <el-table-column label="添加时间" width="180">
            <template #default="{ row }">{{ formatDay(row.addedAt) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="100" align="right">
            <template #default="{ row }">
              <el-button v-if="canWrite" link type="danger" :icon="Delete" @click="doRemove(row)">移除</el-button>
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-if="!loading && sortedMembers.length === 0" description="暂无值班人，通知将回退角色兜底" :image-size="80" />
      </div>

      <div class="oncall-tip">
        <el-icon><InfoFilled /></el-icon>
        <span>通知联动：首报 → 主值班，升级 L1 → 备值班，L2 → ADMIN；规则显式配置的 toUsers 优先于值班表。值班表为空时按角色兜底。</span>
      </div>
    </div>

    <!-- 添加值班人 -->
    <el-dialog v-model="addVisible" :title="addRole === 'PRIMARY' ? '添加主值班' : '添加备值班'" width="480px" destroy-on-close>
      <el-form :model="addForm" label-width="90px">
        <el-form-item label="值班人" required>
          <el-select v-model="addForm.userId" filterable placeholder="选择用户" style="width: 100%">
            <el-option
              v-for="u in userOptions"
              :key="u.id"
              :label="u.displayName ? `${u.displayName}（${u.username}）` : u.username"
              :value="u.id"
            />
          </el-select>
          <div class="oncall-form-hint">只能选择当前企业内的用户。</div>
        </el-form-item>
        <el-form-item label="值班角色">
          <el-select v-model="addForm.dutyRole" style="width: 100%">
            <el-option label="主值班 PRIMARY" value="PRIMARY" />
            <el-option label="备值班 BACKUP" value="BACKUP" />
          </el-select>
        </el-form-item>
      </el-form>
      <div class="oncall-form-tip">同一用户同一角色重复添加会被忽略；通知规则显式配置的 toUsers 始终优先于值班表。</div>
      <template #footer>
        <el-button @click="addVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="doAdd">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Delete, UserFilled, InfoFilled } from '@element-plus/icons-vue'
import { listOncallMembers, addOncallMember, removeOncallMember } from '@/api/oncall'
import { listUsers } from '@/api/user'
import { useAuthStore } from '@/stores/auth'
import { formatDay } from '@/views/knowledge/kb-utils'

const auth = useAuthStore()
const canWrite = computed(() => auth.hasPermission('oncall:manage'))

const loading = ref(false)
const members = ref([])
const userOptions = ref([])
const primaryList = computed(() => members.value.filter((m) => m.dutyRole === 'PRIMARY'))
const backupList = computed(() => members.value.filter((m) => m.dutyRole === 'BACKUP'))
const sortedMembers = computed(() => [...members.value].sort((a, b) => {
  if (a.dutyRole !== b.dutyRole) return a.dutyRole === 'PRIMARY' ? -1 : 1
  return new Date(b.addedAt || 0) - new Date(a.addedAt || 0)
}))
const userMap = computed(() => Object.fromEntries(userOptions.value.map((u) => [u.id, u])))

async function load() {
  loading.value = true
  try {
    members.value = (await listOncallMembers()) || []
  } catch (e) {
    ElMessage.error(e.message || '加载值班列表失败')
  } finally {
    loading.value = false
  }
}

async function loadUsers() {
  try {
    userOptions.value = (await listUsers({ enabled: true })) || []
  } catch {
    userOptions.value = []
  }
}

function userName(userId) {
  const user = userMap.value[userId]
  return user?.displayName || user?.username || userId || '-'
}

function avatarText(userId) {
  const name = userName(userId)
  return String(name || '?').slice(0, 1)
}

// ---- 添加 ----
const addVisible = ref(false)
const saving = ref(false)
const addRole = ref('PRIMARY')
const addForm = reactive({ userId: '', dutyRole: 'PRIMARY' })
function openAdd(role) {
  addRole.value = role
  addForm.userId = ''
  addForm.dutyRole = role
  addVisible.value = true
}
async function doAdd() {
  if (!addForm.userId) {
    ElMessage.warning('请选择值班人')
    return
  }
  saving.value = true
  try {
    await addOncallMember({ userId: addForm.userId, dutyRole: addForm.dutyRole })
    ElMessage.success('已添加')
    addVisible.value = false
    load()
  } catch (e) {
    ElMessage.error(e.message || '添加失败')
  } finally {
    saving.value = false
  }
}

// ---- 移除 ----
async function doRemove(m) {
  try {
    await ElMessageBox.confirm(
      `确认移除值班人「${userName(m.userId)}」吗？`,
      '移除确认',
      { type: 'warning', confirmButtonText: '移除', confirmButtonClass: 'el-button--danger' }
    )
  } catch (_) {
    return
  }
  try {
    await removeOncallMember(m.id)
    ElMessage.success('已移除')
    load()
  } catch (e) {
    ElMessage.error(e.message || '操作失败')
  }
}

onMounted(() => {
  load()
  loadUsers()
})
</script>

<style scoped>
.page {
  padding: 20px 24px 32px;
  max-width: 1160px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18px;
}

.page-title {
  font-size: 20px;
  font-weight: 600;
  margin: 0;
  color: var(--text-primary);
}

.page-header-left {
  display: flex;
  align-items: baseline;
  gap: 10px;
  min-width: 0;
}

.page-subtitle {
  font-size: 13px;
  color: var(--text-muted);
  margin-left: 0;
}

.page-header-actions {
  display: flex;
  gap: 10px;
}

.page-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.oncall-table-card {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--card-shadow);
  overflow: hidden;
}

.oncall-role-tag {
  display: inline-block;
  padding: 2px 9px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 500;
}

.oncall-role-tag.primary {
  color: #059669;
  background: #ECFDF5;
}

.oncall-role-tag.backup {
  color: #D97706;
  background: #FFFBEB;
}

.oncall-summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.oncall-summary-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 18px;
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--card-shadow);
}

.oncall-summary-icon {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
}

.oncall-summary-icon.primary {
  color: #059669;
  background: #ECFDF5;
}

.oncall-summary-icon.backup {
  color: #D97706;
  background: #FFFBEB;
}

.oncall-summary-label {
  font-size: 12px;
  color: var(--text-muted);
}

.oncall-summary-value {
  margin-top: 2px;
  font-size: 22px;
  font-weight: 700;
  line-height: 1.2;
  color: var(--text-primary);
}

.oncall-summary-value small {
  font-size: 12px;
  font-weight: 400;
  color: var(--text-muted);
}

.oncall-person {
  display: flex;
  align-items: center;
  gap: 10px;
}

.oncall-avatar {
  width: 34px;
  height: 34px;
  border-radius: 9px;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 600;
  flex-shrink: 0;
}

.oncall-avatar.primary {
  background: linear-gradient(135deg, #10b981, #059669);
}

.oncall-avatar.backup {
  background: linear-gradient(135deg, #f59e0b, #d97706);
}

.oncall-person-info {
  min-width: 0;
}

.oncall-person-name {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--text-primary);
}

.oncall-person-id {
  margin-top: 2px;
  font-size: 12px;
  color: var(--text-muted);
}

.oncall-tip {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  padding: 12px 14px;
  border-radius: 10px;
  background: rgba(30, 64, 175, 0.05);
  border: 1px solid rgba(30, 64, 175, 0.08);
  font-size: 12.5px;
  color: var(--text-secondary);
  line-height: 1.6;
}

.oncall-tip .el-icon {
  color: var(--primary);
  margin-top: 2px;
}

.oncall-form-hint,
.oncall-form-tip {
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.5;
}

.oncall-form-hint {
  margin-top: 4px;
}

.oncall-form-tip {
  padding-left: 90px;
}

@media (max-width: 900px) {
  .oncall-summary {
    grid-template-columns: 1fr;
  }

  .page-header {
    align-items: flex-start;
    gap: 12px;
    flex-direction: column;
  }
}
</style>
