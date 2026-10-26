<template>
  <div class="rbac-page">
    <header class="rbac-header">
      <h2>部门树 <span class="sub">多级部门 · 上级可看下级全部信息 · 服务归属</span></h2>
      <div class="header-actions">
        <span class="pill">{{ tenantLabel }}</span>
        <el-button type="primary" size="small" :icon="Plus" :disabled="!canManage" @click="openCreate(null)">新增子部门</el-button>
      </div>
    </header>

    <div class="rbac-body" v-loading="loading">
      <div class="split">
        <!-- 左：部门树 -->
        <div class="rbac-card">
          <div class="card-hd">
            <div class="card-title">组织架构</div>
            <span class="tag tag-info">{{ depts.length }} 个部门</span>
          </div>
          <div class="tree-wrap">
            <el-tree :data="tree" node-key="id" :props="{ label: 'name', children: 'children' }"
              default-expand-all highlight-current :expand-on-click-node="false" @node-click="selectDept">
              <template #default="{ data }">
                <span class="tree-label">
                  <span class="tree-name">{{ data.name }}</span>
                  <span class="tree-code mono">{{ data.code }}</span>
                </span>
              </template>
            </el-tree>
            <el-empty v-if="!depts.length" description="暂无部门" :image-size="60" />
          </div>
          <div class="tree-tip">上级部门自动可见全部子部门数据；同级部门互不可见。</div>
        </div>

        <!-- 右：部门详情 -->
        <div class="detail-col">
          <div v-if="!selected" class="rbac-card">
            <el-empty description="请选择左侧部门" />
          </div>
          <template v-else>
            <div class="rbac-card">
              <div class="card-hd">
                <div class="card-title">{{ selected.name }} <span class="tag tag-primary">{{ roleHint }}</span></div>
                <div class="header-actions">
                  <el-button size="small" :disabled="!canManage" @click="openCreate(selected)">新增子部门</el-button>
                  <el-button size="small" :disabled="!canManage" @click="openEdit(selected)">编辑</el-button>
                  <el-button size="small" type="danger" plain :disabled="!canManage" @click="remove(selected)">删除</el-button>
                </div>
              </div>
              <div class="card-bd">
                <div class="kv-grid">
                  <div class="kv"><div class="k">部门编码</div><div class="v mono">{{ selected.code }}</div></div>
                  <div class="kv"><div class="k">上级部门</div><div class="v">{{ parentName(selected.parentId) }}</div></div>
                  <div class="kv"><div class="k">层级</div><div class="v">{{ selected.level }}</div></div>
                  <div class="kv"><div class="k">同级排序</div><div class="v">{{ selected.sort }}</div></div>
                  <div class="kv"><div class="k">状态</div><div class="v">{{ selected.status === 'ACTIVE' ? '启用' : '停用' }}</div></div>
                  <div class="kv"><div class="k">路径</div><div class="v mono">{{ selected.path }}</div></div>
                </div>
                <div class="alert-info">
                  数据范围：本部门 + 子部门。知识、告警、诊断均按此范围过滤。
                </div>
              </div>
            </div>

            <div class="split half">
              <div class="rbac-card">
                <div class="card-hd">
                  <div class="card-title">成员（{{ members.length }}）</div>
                  <span class="tag tag-info">含子部门</span>
                </div>
                <div class="card-bd list">
                  <div v-for="u in members.slice(0, 6)" :key="u.id" class="member-row">
                    <span class="avatar-sm">{{ (u.displayName || u.username || '?').charAt(0) }}</span>
                    <div class="member-main">
                      <b>{{ u.displayName || u.username }}</b>
                      <div class="muted small">{{ u.email || u.username }}</div>
                    </div>
                    <span class="tag tag-info">{{ (u.roles || []).map(roleLabel).join(' / ') || '-' }}</span>
                  </div>
                  <el-empty v-if="!members.length" description="暂无成员" :image-size="50" />
                </div>
              </div>

              <div class="rbac-card">
                <div class="card-hd">
                  <div class="card-title">负责服务（{{ deptServices.length }}）</div>
                  <span class="tag tag-info">按部门归属</span>
                </div>
                <div class="card-bd list">
                  <div v-for="s in deptServices.slice(0, 6)" :key="s.name" class="member-row">
                    <div class="member-main">
                      <b>{{ s.name }}</b>
                      <div class="muted small">{{ s.env || '-' }}</div>
                    </div>
                    <span class="tag" :class="s.status === 'UP' ? 'tag-success' : s.status === 'DOWN' ? 'tag-danger' : 'tag-warning'">
                      {{ s.status || 'UNKNOWN' }}
                    </span>
                  </div>
                  <el-empty v-if="!deptServices.length" description="暂无服务" :image-size="50" />
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>

    <el-dialog v-model="dialogVisible" :title="mode === 'edit' ? '编辑部门' : '新增部门'" width="480px"
      :close-on-click-modal="false" @closed="resetForm">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="90px">
        <el-form-item label="上级部门">
          <el-input :model-value="parentName(form.parentId)" disabled />
        </el-form-item>
        <el-form-item label="部门编码" prop="code">
          <el-input v-model="form.code" :disabled="mode === 'edit'" placeholder="字母、数字、下划线、连字符" />
        </el-form-item>
        <el-form-item label="部门名称" prop="name">
          <el-input v-model="form.name" placeholder="部门名称" />
        </el-form-item>
        <el-form-item label="同级排序">
          <el-input-number v-model="form.sort" :min="0" :max="9999" />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="form.status" style="width: 100%">
            <el-option label="启用" value="ACTIVE" />
            <el-option label="停用" value="DISABLED" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'
import { listDepts, createDept, updateDept, deleteDept } from '@/api/rbac'
import { listUsers } from '@/api/user'
import { listServices } from '@/api/service'

const authStore = useAuthStore()
const canManage = computed(() => authStore.hasPermission('dept:manage'))
const tenantLabel = computed(() => authStore.tenantId === '0' ? '平台' : (authStore.tenantId || '当前企业'))
const roleHint = computed(() => canManage.value ? 'DEPT_ADMIN 可管理' : '只读')

const depts = ref([])
const tree = ref([])
const services = ref([])
const members = ref([])
const selected = ref(null)
const loading = ref(false)

const dialogVisible = ref(false)
const submitting = ref(false)
const mode = ref('create')
const editingId = ref(null)
const formRef = ref(null)

const form = reactive({ parentId: null, code: '', name: '', sort: 0, status: 'ACTIVE' })

const rules = {
  code: [
    { required: true, message: '请输入部门编码', trigger: 'blur' },
    { pattern: /^[A-Za-z0-9_-]+$/, message: '只能包含字母、数字、下划线、连字符', trigger: 'blur' },
  ],
  name: [{ required: true, message: '请输入部门名称', trigger: 'blur' }],
}

const deptServices = computed(() => {
  if (!selected.value) return []
  return services.value.filter((s) => s.deptId === selected.value.id)
})

onMounted(async () => {
  await Promise.all([loadDepts(), loadServices()])
})

async function loadDepts() {
  loading.value = true
  try {
    depts.value = await listDepts()
    tree.value = buildTree(depts.value)
    if (!selected.value && tree.value.length) selectDept(tree.value[0])
  } catch (e) {
    ElMessage.error(e.message || '加载部门失败')
  } finally {
    loading.value = false
  }
}

async function loadServices() {
  try {
    services.value = await listServices()
  } catch {
    services.value = []
  }
}

async function selectDept(data) {
  selected.value = data
  try {
    members.value = await listUsers({ deptId: data.id })
  } catch {
    members.value = []
  }
}

function buildTree(list) {
  const map = new Map()
  list.forEach((item) => map.set(item.id, { ...item, children: [] }))
  const roots = []
  map.forEach((node) => {
    const parent = node.parentId ? map.get(node.parentId) : null
    if (parent) parent.children.push(node)
    else roots.push(node)
  })
  return roots
}

function openCreate(parent) {
  mode.value = 'create'
  editingId.value = null
  Object.assign(form, {
    parentId: parent ? parent.id : null,
    code: '',
    name: '',
    sort: 0,
    status: 'ACTIVE',
  })
  dialogVisible.value = true
}

function openEdit(row) {
  mode.value = 'edit'
  editingId.value = row.id
  Object.assign(form, {
    parentId: row.parentId,
    code: row.code,
    name: row.name,
    sort: row.sort ?? 0,
    status: row.status || 'ACTIVE',
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
      await updateDept(editingId.value, { name: form.name, sort: form.sort, status: form.status })
      ElMessage.success('部门已更新')
    } else {
      await createDept({
        parentId: form.parentId,
        code: form.code,
        name: form.name,
        sort: form.sort,
        status: form.status,
      })
      ElMessage.success('部门已创建')
    }
    dialogVisible.value = false
    await loadDepts()
  } catch (e) {
    ElMessage.error(e.message || '保存失败')
  } finally {
    submitting.value = false
  }
}

async function remove(row) {
  try {
    await ElMessageBox.confirm(`确定删除部门「${row.name}」？存在子部门或用户时将拒绝删除。`, '提示', {
      type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消',
    })
    await deleteDept(row.id)
    ElMessage.success('部门已删除')
    selected.value = null
    await loadDepts()
  } catch (e) {
    if (e && e.message && e.message !== 'cancel') ElMessage.error(e.message)
  }
}

function parentName(id) {
  if (!id) return '—（根部门）'
  const hit = depts.value.find((d) => d.id === id)
  return hit ? hit.name : String(id)
}

function roleLabel(code) {
  return {
    PLATFORM_ADMIN: '平台管理员', TENANT_ADMIN: '企业管理员', DEPT_ADMIN: '部门管理员',
    CONTRIBUTOR: '运维工程师', VIEWER: '只读成员', ADMIN: '管理员', OPERATOR: '操作员',
  }[code] || code
}

function resetForm() {
  formRef.value?.clearValidate()
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
.header-actions { display: flex; gap: 8px; align-items: center; }
.pill { padding: 3px 10px; border-radius: 12px; font-size: 12px; background: var(--primary-light); color: var(--primary); }
.rbac-body { flex: 1; overflow-y: auto; padding: 20px 24px; }
.split { display: grid; grid-template-columns: 360px minmax(0, 1fr); gap: 16px; align-items: start; }
.split.half { grid-template-columns: 1fr 1fr; margin-top: 16px; }
.rbac-card { background: var(--card-bg); border: 1px solid var(--border); border-radius: var(--radius-lg); box-shadow: var(--card-shadow); overflow: hidden; }
.card-hd { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; border-bottom: 1px solid var(--border-light); }
.card-title { font-size: 14px; font-weight: 600; }
.card-bd { padding: 16px 18px; }
.card-bd.list { padding: 6px 18px; }
.tree-wrap { padding: 8px; max-height: 62vh; overflow-y: auto; }
.tree-label { display: flex; align-items: center; gap: 8px; font-size: 13px; }
.tree-name { font-weight: 500; }
.tree-code { color: var(--text-muted); font-size: 11px; }
.tree-tip { border-top: 1px solid var(--border-light); padding: 10px 16px; font-size: 12px; color: var(--text-secondary); }
.detail-col { min-width: 0; }
.kv-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px 18px; margin-bottom: 14px; }
.kv .k { font-size: 12px; color: var(--text-muted); }
.kv .v { font-size: 13.5px; margin-top: 2px; }
.alert-info {
  display: flex; align-items: flex-start; gap: 8px; padding: 9px 12px;
  background: rgba(219,234,254,.4); border-radius: 8px; font-size: 12px; color: var(--primary); line-height: 1.6;
}
.member-row { display: flex; align-items: center; gap: 10px; padding: 9px 0; border-bottom: 1px solid var(--border-light); font-size: 13px; }
.member-row:last-child { border-bottom: none; }
.member-main { flex: 1; min-width: 0; }
.member-main b { font-size: 13px; }
.avatar-sm {
  width: 28px; height: 28px; border-radius: 50%; background: var(--primary-light); color: var(--primary);
  display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600; flex-shrink: 0;
}
.muted { color: var(--text-muted); }
.small { font-size: 11.5px; }
.mono { font-family: ui-monospace, monospace; font-size: 12px; }
.tag { display: inline-block; padding: 1px 9px; border-radius: 10px; font-size: 12px; }
.tag-success { background: var(--success-bg); color: var(--success); }
.tag-warning { background: var(--warning-bg); color: var(--warning); }
.tag-danger { background: var(--danger-bg); color: var(--danger); }
.tag-primary { background: var(--primary-light); color: var(--primary); }
.tag-info { background: #F1F5F9; color: var(--text-secondary); }
</style>
