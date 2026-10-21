<template>
  <div class="page-container">
    <div class="page-header">
      <div>
        <h2 class="page-title">值班管理</h2>
        <p class="page-sub">全局主值班 / 备值班配置（可多人），不做排班轮换。通知联动：首报 → 主值班，升级 L1 → 备值班，L2 → ADMIN；规则显式 toUsers 优先；值班表为空时回退角色兜底。</p>
      </div>
      <div class="page-actions">
        <el-button type="primary" :icon="Plus" :disabled="!canWrite" @click="openAdd('PRIMARY')">添加主值班</el-button>
        <el-button type="warning" plain :icon="Plus" :disabled="!canWrite" @click="openAdd('BACKUP')">添加备值班</el-button>
      </div>
    </div>

    <div v-loading="loading" class="oncall-grid">
      <!-- 主值班 -->
      <div class="oncall-card">
        <div class="oncall-card-hd">
          <span class="oncall-dot oncall-dot-primary"></span>
          <b>主值班（PRIMARY）</b>
          <span class="kb-tag kb-tag-teal">{{ primaryList.length }} 人</span>
        </div>
        <div v-if="primaryList.length === 0" class="oncall-empty">暂无主值班，通知将回退角色兜底</div>
        <div v-for="m in primaryList" :key="m.id" class="oncall-row">
          <div class="oncall-avatar">{{ avatarText(m.userId) }}</div>
          <div class="oncall-info">
            <div class="oncall-name">用户 #{{ m.userId }}</div>
            <div class="oncall-meta">由 {{ m.addedBy || '-' }} 添加 · {{ formatDay(m.addedAt) }}</div>
          </div>
          <el-button v-if="canWrite" link type="danger" :icon="Delete" @click="doRemove(m)">移除</el-button>
        </div>
      </div>

      <!-- 备值班 -->
      <div class="oncall-card">
        <div class="oncall-card-hd">
          <span class="oncall-dot oncall-dot-backup"></span>
          <b>备值班（BACKUP）</b>
          <span class="kb-tag kb-tag-warning">{{ backupList.length }} 人</span>
        </div>
        <div v-if="backupList.length === 0" class="oncall-empty">暂无备值班，升级 L1 通知将回退角色兜底</div>
        <div v-for="m in backupList" :key="m.id" class="oncall-row">
          <div class="oncall-avatar">{{ avatarText(m.userId) }}</div>
          <div class="oncall-info">
            <div class="oncall-name">用户 #{{ m.userId }}</div>
            <div class="oncall-meta">由 {{ m.addedBy || '-' }} 添加 · {{ formatDay(m.addedAt) }}</div>
          </div>
          <el-button v-if="canWrite" link type="danger" :icon="Delete" @click="doRemove(m)">移除</el-button>
        </div>
      </div>
    </div>

    <!-- 添加值班人 -->
    <el-dialog v-model="addVisible" :title="addRole === 'PRIMARY' ? '添加主值班' : '添加备值班'" width="460px" destroy-on-close>
      <el-form :model="addForm" label-width="90px">
        <el-form-item label="用户 ID" required>
          <el-input v-model.number="addForm.userId" type="number" placeholder="请输入值班人的用户 ID" />
        </el-form-item>
        <el-form-item label="值班角色">
          <el-select v-model="addForm.dutyRole" style="width: 200px">
            <el-option label="主值班 PRIMARY" value="PRIMARY" />
            <el-option label="备值班 BACKUP" value="BACKUP" />
          </el-select>
        </el-form-item>
      </el-form>
      <div class="kb-muted" style="font-size: 12px; padding-left: 90px">提示：同一用户同一角色重复添加会被忽略；通知规则显式配置的 toUsers 始终优先于值班表。</div>
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
import { Plus, Delete } from '@element-plus/icons-vue'
import { listOncallMembers, addOncallMember, removeOncallMember } from '@/api/oncall'
import { useAuthStore } from '@/stores/auth'
import { formatDay } from '@/views/knowledge/kb-utils'

const auth = useAuthStore()
const canWrite = computed(() => auth.isOperator)

const loading = ref(false)
const members = ref([])
const primaryList = computed(() => members.value.filter((m) => m.dutyRole === 'PRIMARY'))
const backupList = computed(() => members.value.filter((m) => m.dutyRole === 'BACKUP'))

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

function avatarText(userId) {
  return String(userId || '?').slice(-2)
}

// ---- 添加 ----
const addVisible = ref(false)
const saving = ref(false)
const addRole = ref('PRIMARY')
const addForm = reactive({ userId: null, dutyRole: 'PRIMARY' })
function openAdd(role) {
  addRole.value = role
  addForm.userId = null
  addForm.dutyRole = role
  addVisible.value = true
}
async function doAdd() {
  if (!addForm.userId || addForm.userId <= 0) {
    ElMessage.warning('请输入有效的用户 ID')
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
      `确认移除值班人「用户 #${m.userId}」吗？`,
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

onMounted(load)
</script>

<style scoped>
.oncall-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}
.oncall-card {
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(226, 232, 240, 0.8);
  border-radius: 12px;
  padding: 16px;
}
.oncall-card-hd {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
.oncall-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  display: inline-block;
}
.oncall-dot-primary {
  background: #10b981;
  box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.15);
}
.oncall-dot-backup {
  background: #f59e0b;
  box-shadow: 0 0 0 4px rgba(245, 158, 11, 0.15);
}
.oncall-empty {
  padding: 28px 0;
  text-align: center;
  color: #94a3b8;
  font-size: 13px;
}
.oncall-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 4px;
  border-top: 1px dashed rgba(226, 232, 240, 0.7);
}
.oncall-avatar {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 600;
  flex-shrink: 0;
}
.oncall-info {
  flex: 1;
  min-width: 0;
}
.oncall-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}
.oncall-meta {
  font-size: 12px;
  color: #94a3b8;
  margin-top: 2px;
}
@media (max-width: 900px) {
  .oncall-grid {
    grid-template-columns: 1fr;
  }
}
</style>
