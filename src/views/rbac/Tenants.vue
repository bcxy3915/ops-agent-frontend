<template>
  <div class="rbac-page">
    <header class="rbac-header">
      <h2>租户管理 <span class="sub">平台唯一入口 · 企业开通 / 停用 / 审核模式</span></h2>
      <div class="header-actions">
        <span class="pill">平台控制台</span>
        <el-button type="primary" size="small" :icon="Plus" @click="openCreate">开通租户</el-button>
      </div>
    </header>

    <div class="rbac-body" v-loading="loading">
      <div class="stat-grid">
        <div class="stat-card"><div class="k">租户总数</div><div class="v">{{ tenants.length }} <small>家</small></div></div>
        <div class="stat-card"><div class="k">活跃租户</div><div class="v success">{{ activeCount }} <small>家</small></div></div>
        <div class="stat-card"><div class="k">本月新增</div><div class="v">{{ monthAdded }} <small>家</small></div></div>
        <div class="stat-card"><div class="k">已停用</div><div class="v muted">{{ suspendedCount }} <small>家</small></div></div>
      </div>

      <div class="rbac-card">
        <div class="card-hd">
          <div class="card-title">租户列表</div>
          <el-input v-model="keyword" placeholder="搜索企业名称 / 编码" clearable style="width: 220px" :prefix-icon="Search" />
        </div>
        <el-table :data="filtered" stripe style="width: 100%" row-key="id">
          <el-table-column label="企业" min-width="200">
            <template #default="{ row }">
              <div class="tenant-name">{{ row.name }}</div>
              <div class="muted mono">{{ row.id }}</div>
            </template>
          </el-table-column>
          <el-table-column prop="code" label="编码" width="110">
            <template #default="{ row }"><span class="mono">{{ row.code }}</span></template>
          </el-table-column>
          <el-table-column label="状态" width="110">
            <template #default="{ row }">
              <span class="tag" :class="row.status === 'ACTIVE' ? 'tag-success' : 'tag-warning'">{{ row.status }}</span>
            </template>
          </el-table-column>
          <el-table-column label="审核模式" width="140">
            <template #default="{ row }">
              <span class="tag" :class="row.knowledgeReviewMode === 'NONE' ? 'tag-info' : 'tag-primary'">
                {{ reviewModeLabel(row.knowledgeReviewMode) }}
              </span>
            </template>
          </el-table-column>
          <el-table-column label="四眼原则" width="100" align="center">
            <template #default="{ row }">
              <span class="tag" :class="row.reviewFourEyes ? 'tag-success' : 'tag-info'">
                {{ row.reviewFourEyes ? '开启' : '关闭' }}
              </span>
            </template>
          </el-table-column>
          <el-table-column label="创建时间" width="170">
            <template #default="{ row }"><span class="muted mono">{{ formatTime(row.createdAt) }}</span></template>
          </el-table-column>
          <el-table-column label="操作" width="150" align="right">
            <template #default="{ row }">
              <el-button link type="primary" @click="openEdit(row)">配置</el-button>
              <el-button link :type="row.status === 'ACTIVE' ? 'danger' : 'success'" @click="toggleStatus(row)">
                {{ row.status === 'ACTIVE' ? '停用' : '启用' }}
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <div class="alert-info">
        <el-icon><InfoFilled /></el-icon>
        <span>审核模式决定知识发布链路：<b>仅部门</b> = 部门管理员通过即发布；<b>部门 + 企业</b> = 部门通过后再由企业管理员审核。平台管理员默认不参与内容审核。</span>
      </div>
    </div>

    <el-dialog v-model="dialogVisible" :title="mode === 'edit' ? '配置租户' : '开通租户'" width="500px"
      :close-on-click-modal="false" @closed="resetForm">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="企业名称" prop="name">
          <el-input v-model="form.name" placeholder="如：星海科技" />
        </el-form-item>
        <el-form-item label="企业编码" prop="code">
          <el-input v-model="form.code" :disabled="mode === 'edit'" placeholder="如：XH（全局唯一）" />
        </el-form-item>
        <el-form-item label="审核模式" prop="knowledgeReviewMode">
          <el-select v-model="form.knowledgeReviewMode" style="width: 100%">
            <el-option label="仅部门审核（DEPT_ONLY）" value="DEPT_ONLY" />
            <el-option label="部门 + 企业管理员（DEPT_AND_TENANT）" value="DEPT_AND_TENANT" />
            <el-option label="免审核（NONE，不推荐）" value="NONE" />
          </el-select>
        </el-form-item>
        <el-form-item label="四眼原则">
          <el-checkbox v-model="form.reviewFourEyes">审核人不能是上传人</el-checkbox>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submit">确认{{ mode === 'edit' ? '保存' : '开通' }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Search, InfoFilled } from '@element-plus/icons-vue'
import { listTenants, createTenant, updateTenant, updateTenantStatus } from '@/api/rbac'

const tenants = ref([])
const keyword = ref('')
const loading = ref(false)
const dialogVisible = ref(false)
const submitting = ref(false)
const mode = ref('create')
const editingId = ref(null)
const formRef = ref(null)

const form = reactive({
  code: '',
  name: '',
  knowledgeReviewMode: 'DEPT_AND_TENANT',
  reviewFourEyes: true,
})

const rules = {
  code: [
    { required: true, message: '请输入企业编码', trigger: 'blur' },
    { pattern: /^[A-Za-z0-9_-]+$/, message: '只能包含字母、数字、下划线、连字符', trigger: 'blur' },
  ],
  name: [{ required: true, message: '请输入企业名称', trigger: 'blur' }],
}

const activeCount = computed(() => tenants.value.filter((t) => t.status === 'ACTIVE').length)
const suspendedCount = computed(() => tenants.value.filter((t) => t.status !== 'ACTIVE').length)
const monthAdded = computed(() => {
  const now = new Date()
  return tenants.value.filter((t) => {
    if (!t.createdAt) return false
    const d = new Date(t.createdAt)
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  }).length
})
const filtered = computed(() => {
  const k = keyword.value.trim().toLowerCase()
  if (!k) return tenants.value
  return tenants.value.filter((t) =>
    (t.name || '').toLowerCase().includes(k) || (t.code || '').toLowerCase().includes(k))
})

onMounted(load)

async function load() {
  loading.value = true
  try {
    tenants.value = await listTenants()
  } catch (e) {
    ElMessage.error(e.message || '加载租户失败')
  } finally {
    loading.value = false
  }
}

function openCreate() {
  mode.value = 'create'
  editingId.value = null
  Object.assign(form, { code: '', name: '', knowledgeReviewMode: 'DEPT_AND_TENANT', reviewFourEyes: true })
  dialogVisible.value = true
}

function openEdit(row) {
  mode.value = 'edit'
  editingId.value = row.id
  Object.assign(form, {
    code: row.code,
    name: row.name,
    knowledgeReviewMode: row.knowledgeReviewMode || 'DEPT_ONLY',
    reviewFourEyes: row.reviewFourEyes !== false,
  })
  dialogVisible.value = true
}

async function submit() {
  if (!formRef.value) return
  try {
    await formRef.value.validate()
  } catch {
    return
  }
  submitting.value = true
  try {
    if (mode.value === 'edit') {
      await updateTenant(editingId.value, {
        name: form.name,
        knowledgeReviewMode: form.knowledgeReviewMode,
        reviewFourEyes: form.reviewFourEyes,
      })
      ElMessage.success('租户已更新')
    } else {
      await createTenant({ ...form })
      ElMessage.success('租户已开通')
    }
    dialogVisible.value = false
    load()
  } catch (e) {
    ElMessage.error(e.message || '保存失败')
  } finally {
    submitting.value = false
  }
}

async function toggleStatus(row) {
  const next = row.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE'
  try {
    await ElMessageBox.confirm(`确定${next === 'ACTIVE' ? '启用' : '停用'}租户「${row.name}」？`, '提示', {
      type: 'warning', confirmButtonText: '确定', cancelButtonText: '取消',
    })
    await updateTenantStatus(row.id, next)
    ElMessage.success('状态已更新')
    load()
  } catch (e) {
    if (e && e.message && e.message !== 'cancel') ElMessage.error(e.message)
  }
}

function resetForm() {
  formRef.value?.clearValidate()
}

function reviewModeLabel(v) {
  return { DEPT_ONLY: '仅部门', DEPT_AND_TENANT: '部门 + 企业', NONE: '免审核' }[v] || v
}

function formatTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
</script>

<style scoped>
.rbac-page { height: 100%; display: flex; flex-direction: column; }
.rbac-header {
  height: 64px; background: rgba(255,255,255,.72); backdrop-filter: blur(24px) saturate(180%);
  border-bottom: 1px solid var(--border); display: flex; align-items: center;
  justify-content: space-between; padding: 0 24px; gap: 12px; flex-shrink: 0;
}
.rbac-header h2 { font-size: 16px; font-weight: 600; }
.sub { font-size: 12px; font-weight: 400; color: var(--text-muted); margin-left: 8px; }
.header-actions { display: flex; gap: 10px; align-items: center; }
.pill { padding: 3px 10px; border-radius: 12px; font-size: 12px; background: var(--primary-light); color: var(--primary); }
.rbac-body { flex: 1; overflow-y: auto; padding: 20px 24px; }
.stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 16px; }
.stat-card { background: var(--card-bg); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 14px 18px; box-shadow: var(--card-shadow); }
.stat-card .k { font-size: 12px; color: var(--text-muted); }
.stat-card .v { font-size: 24px; font-weight: 700; margin-top: 4px; }
.stat-card .v small { font-size: 12px; font-weight: 400; color: var(--text-muted); }
.stat-card .success { color: var(--success); }
.stat-card .muted { color: var(--text-muted); }
.rbac-card { background: var(--card-bg); border: 1px solid var(--border); border-radius: var(--radius-lg); box-shadow: var(--card-shadow); overflow: hidden; }
.card-hd { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; border-bottom: 1px solid var(--border-light); }
.card-title { font-size: 14px; font-weight: 600; }
.tenant-name { font-weight: 600; font-size: 13.5px; }
.muted { color: var(--text-muted); }
.mono { font-family: ui-monospace, monospace; font-size: 12px; }
.tag { display: inline-block; padding: 1px 9px; border-radius: 10px; font-size: 12px; }
.tag-success { background: var(--success-bg); color: var(--success); }
.tag-warning { background: var(--warning-bg); color: var(--warning); }
.tag-primary { background: var(--primary-light); color: var(--primary); }
.tag-info { background: #F1F5F9; color: var(--text-secondary); }
.alert-info {
  display: flex; align-items: flex-start; gap: 8px; margin-top: 16px; padding: 10px 14px;
  background: rgba(219,234,254,.4); border-radius: 8px; font-size: 12.5px; color: var(--primary); line-height: 1.6;
}
</style>
