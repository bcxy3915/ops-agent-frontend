<template>
  <div class="rbac-page">
    <header class="rbac-header">
      <h2>角色权限 <span class="sub">角色 → 权限点 · 代码只认权限，不写死角色</span></h2>
      <div class="header-actions">
        <span class="pill">{{ tenantLabel }}</span>
        <el-button type="primary" size="small" :loading="saving" @click="save">保存权限</el-button>
      </div>
    </header>

    <div class="rbac-body" v-loading="loading">
      <div class="alert-info">
        <el-icon><InfoFilled /></el-icon>
        <span>新增角色只需勾选权限点，无需改代码。平台管理员默认不拥有“知识审核”，避免平台介入企业内容。</span>
      </div>

      <div class="split">
        <!-- 左：角色列表 -->
        <div class="rbac-card role-panel">
          <div class="card-hd">
            <div class="card-title">角色</div>
            <span class="tag tag-info">{{ roles.length }} 个</span>
          </div>
          <div class="role-list">
            <div v-for="r in roles" :key="r.id" class="role-item"
              :class="{ active: activeRoleId === r.id }" @click="activeRoleId = r.id">
              <div class="role-main">
                <div class="role-name">
                  {{ r.name }}
                  <span class="tag" :class="scopeTag(r.scope)">{{ r.code }}</span>
                </div>
                <div class="role-desc">{{ roleDesc(r.code) }}</div>
              </div>
              <span class="role-scope">{{ scopeLabel(r.scope) }}</span>
            </div>
          </div>
        </div>

        <!-- 右：多角色权限矩阵 -->
        <div class="rbac-card matrix-panel">
          <div class="card-hd">
            <div class="card-title">角色 · 权限点矩阵</div>
            <span class="tag tag-warning">
              {{ activeRole ? activeRole.name : '' }} 已选 {{ activeCount }}/{{ permissions.length }} 项
            </span>
            <span v-if="activeRole && activeRole.scope === 'PLATFORM'" class="tag tag-info">平台角色只读</span>
          </div>

          <div class="matrix-wrap">
            <table class="matrix">
              <thead>
                <tr>
                  <th class="module-col">模块</th>
                  <th class="perm-col">权限点</th>
                  <th v-for="r in matrixRoles" :key="r.id" class="role-col">
                    {{ r.name }}
                    <div class="role-col-code">{{ r.code }}</div>
                  </th>
                </tr>
              </thead>
              <tbody>
                <template v-for="group in permissionGroups" :key="group.module">
                  <tr v-for="(p, idx) in group.items" :key="p.id">
                    <td v-if="idx === 0" :rowspan="group.items.length" class="module-cell">
                      {{ group.label }}
                    </td>
                    <td class="perm-cell">
                      <span class="perm-name">{{ p.name }}</span>
                      <span class="perm-code">{{ p.code }}</span>
                    </td>
                    <td v-for="r in matrixRoles" :key="r.id" class="role-col">
                      <el-checkbox v-model="rolePerms[r.id]" :value="p.id" />
                    </td>
                  </tr>
                </template>
              </tbody>
            </table>
            <el-empty v-if="!permissionGroups.length" description="暂无权限点" />
          </div>

          <div class="card-ft">
            <span class="muted small">
              勾选多个角色可横向对比；保存时只提交有变更的角色。权限缓存 5 分钟内失效。
            </span>
            <el-button type="primary" size="small" :loading="saving" @click="save">保存</el-button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { InfoFilled } from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'
import { listRoles, listPermissions, getRolePermissions, updateRolePermissions } from '@/api/rbac'

const MODULE_LABELS = {
  tenant: '租户', org: '组织', knowledge: '知识库', service: '服务', alert: '告警',
  diagnosis: '诊断', notification: '通知', maintenance: '维护', oncall: '值班', audit: '审计',
}
const MODULE_ORDER = ['knowledge', 'service', 'alert', 'org', 'tenant', 'audit', 'diagnosis', 'notification', 'maintenance', 'oncall']
const ROLE_ORDER = ['TENANT_ADMIN', 'DEPT_ADMIN', 'CONTRIBUTOR', 'VIEWER', 'PLATFORM_ADMIN']

const authStore = useAuthStore()
const tenantLabel = computed(() => authStore.tenantId === '0' ? '平台' : (authStore.tenantId || '当前企业'))

const roles = ref([])
const permissions = ref([])
const rolePerms = reactive({})
const originals = reactive({})
const activeRoleId = ref(null)
const loading = ref(false)
const saving = ref(false)

const matrixRoles = computed(() => {
  const editable = roles.value.filter((r) => r.scope !== 'PLATFORM')
  return editable.length ? editable : roles.value
})
const activeRole = computed(() => roles.value.find((r) => r.id === activeRoleId.value) || null)
const activeCount = computed(() => (rolePerms[activeRoleId.value] || []).length)

const permissionGroups = computed(() => {
  const map = new Map()
  permissions.value.forEach((p) => {
    const module = p.module || 'other'
    if (!map.has(module)) map.set(module, [])
    map.get(module).push(p)
  })
  return Array.from(map.entries())
    .sort((a, b) => {
      const ai = MODULE_ORDER.indexOf(a[0])
      const bi = MODULE_ORDER.indexOf(b[0])
      return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi)
    })
    .map(([module, items]) => ({
      module,
      label: MODULE_LABELS[module] || module,
      items,
    }))
})

onMounted(load)

async function load() {
  loading.value = true
  try {
    const [r, p] = await Promise.all([listRoles(), listPermissions()])
    roles.value = (r || []).slice().sort((a, b) => {
      const ai = ROLE_ORDER.indexOf(a.code)
      const bi = ROLE_ORDER.indexOf(b.code)
      return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi)
    })
    permissions.value = p || []
    const preferred = roles.value.find((x) => x.code === 'TENANT_ADMIN')
      || roles.value.find((x) => x.scope !== 'PLATFORM')
      || roles.value[0]
    if (preferred) activeRoleId.value = preferred.id

    const results = await Promise.all(roles.value.map((role) => getRolePermissions(role.id).catch(() => [])))
    roles.value.forEach((role, idx) => {
      const ids = (results[idx] || []).slice().sort((a, b) => a - b)
      rolePerms[role.id] = ids
      originals[role.id] = [...ids]
    })
  } catch (e) {
    ElMessage.error(e.message || '加载角色权限失败')
  } finally {
    loading.value = false
  }
}

async function save() {
  const changed = matrixRoles.value.filter((role) => {
    const now = (rolePerms[role.id] || []).slice().sort((a, b) => a - b)
    const old = (originals[role.id] || []).slice().sort((a, b) => a - b)
    return now.length !== old.length || now.some((id, i) => id !== old[i])
  })
  if (!changed.length) {
    ElMessage.info('没有需要保存的变更')
    return
  }
  saving.value = true
  try {
    await Promise.all(changed.map((role) => updateRolePermissions(role.id, rolePerms[role.id] || [])))
    changed.forEach((role) => {
      originals[role.id] = (rolePerms[role.id] || []).slice().sort((a, b) => a - b)
    })
    ElMessage.success(`已保存 ${changed.length} 个角色的权限`)
  } catch (e) {
    ElMessage.error(e.message || '保存失败')
  } finally {
    saving.value = false
  }
}

function roleDesc(code) {
  return {
    PLATFORM_ADMIN: '租户 / 账号 / 系统 / 审计',
    TENANT_ADMIN: '本企业全部部门 · 企业级审核',
    DEPT_ADMIN: '本部门 + 子部门 · 部门审核',
    CONTRIBUTOR: '上传 / 处置 / 诊断',
    VIEWER: '只读 · 值班查看',
  }[code] || ''
}

function scopeLabel(scope) {
  return { PLATFORM: '平台', TENANT: '企业', DEPT: '部门' }[scope] || scope
}

function scopeTag(scope) {
  return scope === 'PLATFORM' ? 'tag-danger' : scope === 'TENANT' ? 'tag-primary' : 'tag-teal'
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
.alert-info {
  display: flex; align-items: flex-start; gap: 8px; padding: 10px 14px; margin-bottom: 16px;
  background: rgba(219,234,254,.4); border-radius: 8px; font-size: 12.5px; color: var(--primary); line-height: 1.6;
}
.split { display: grid; grid-template-columns: 300px minmax(0, 1fr); gap: 16px; align-items: start; }
.rbac-card { background: var(--card-bg); border: 1px solid var(--border); border-radius: var(--radius-lg); box-shadow: var(--card-shadow); overflow: hidden; }
.card-hd { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; border-bottom: 1px solid var(--border-light); }
.card-title { font-size: 14px; font-weight: 600; }
.role-list { padding: 8px; }
.role-item { display: flex; align-items: center; gap: 8px; padding: 11px 12px; border-radius: 9px; cursor: pointer; border: 1px solid transparent; }
.role-item:hover { background: var(--bg-hover); }
.role-item.active { background: var(--bg-selected); border-color: #BFDBFE; }
.role-main { flex: 1; min-width: 0; }
.role-name { font-size: 13.5px; font-weight: 600; }
.role-desc { font-size: 11.5px; color: var(--text-muted); margin-top: 2px; }
.role-scope { font-size: 11.5px; color: var(--text-muted); }
.matrix-wrap { overflow-x: auto; padding: 0 12px; }
.matrix {
  width: 900px;
  min-width: 900px;
  margin: 0 auto;
  table-layout: fixed;
  border-collapse: collapse;
  font-size: 13px;
}
.matrix th { font-size: 12px; font-weight: 600; color: var(--text-secondary); padding: 10px; border-bottom: 1px solid var(--border-light); background: rgba(248,250,252,.6); text-align: left; }
.matrix th.module-col { width: 90px; text-align: center; }
.matrix th.perm-col { width: 330px; }
.matrix th.role-col { width: 120px; text-align: center; }
.role-col-code { font-size: 10.5px; font-weight: 400; color: var(--text-muted); margin-top: 1px; }
.matrix td { padding: 9px 10px; border-bottom: 1px solid var(--border-light); vertical-align: middle; }
.matrix td.role-col { text-align: center; }
.matrix td.module-cell { text-align: center; font-weight: 600; color: var(--text-primary); background: rgba(248,250,252,.35); white-space: nowrap; }
.perm-cell { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.perm-name { font-size: 13px; }
.perm-code { margin-left: 10px; color: var(--text-muted); font-size: 11px; }
.card-ft { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 18px; border-top: 1px solid var(--border-light); }
.muted { color: var(--text-muted); }
.small { font-size: 12px; }
.tag { display: inline-block; padding: 1px 8px; border-radius: 10px; font-size: 11.5px; font-weight: 500; }
.tag-primary { background: var(--primary-light); color: var(--primary); }
.tag-danger { background: var(--danger-bg); color: var(--danger); }
.tag-teal { background: #ECFEFF; color: #0E7490; }
.tag-warning { background: var(--warning-bg); color: var(--warning); }
.tag-info { background: #F1F5F9; color: var(--text-secondary); }
</style>
