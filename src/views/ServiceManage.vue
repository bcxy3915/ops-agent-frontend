<template>
  <div class="page">
    <!-- 顶部栏 -->
    <header class="page-header">
      <h2>服务管理</h2>
      <div class="header-actions">
        <el-input v-model="filters.keyword" placeholder="搜索服务名 / 地址 / 负责人" :prefix-icon="Search" clearable
          style="width: 240px" @input="loadServices" />
        <el-select v-model="filters.env" placeholder="环境" clearable style="width: 120px" @change="loadServices">
          <el-option label="开发" value="dev" />
          <el-option label="测试" value="test" />
          <el-option label="生产" value="prod" />
        </el-select>
        <el-select v-model="filters.status" placeholder="状态" clearable style="width: 120px" @change="loadServices">
          <el-option label="UP" value="UP" />
          <el-option label="DOWN" value="DOWN" />
          <el-option label="UNKNOWN" value="UNKNOWN" />
        </el-select>
        <el-button v-if="canMaintain" :icon="Tools" @click="openMaintenance">
          维护窗口
        </el-button>
        <el-button type="primary" :icon="Plus" v-if="canWrite" @click="handleRegister">
          注册服务
        </el-button>

        <!-- P2-A12 自动刷新 -->
        <el-tooltip content="开启后按所选间隔自动刷新服务列表" placement="top">
          <div class="auto-refresh">
            <el-switch v-model="autoRefresh" @change="toggleAutoRefresh" style="--el-switch-on-color: #3B82F6" />
            <el-select v-model="refreshInterval" size="small" style="width: 86px" :disabled="!autoRefresh" @change="restartAutoRefresh">
              <el-option label="30秒" :value="30" />
              <el-option label="60秒" :value="60" />
            </el-select>
          </div>
        </el-tooltip>
      </div>
    </header>

    <!-- 内容区 -->
    <div class="page-body" v-loading="loading">
      <!-- 空状态 -->
      <div v-if="!loading && services.length === 0" class="empty-state">
        <el-empty :description="hasFilter ? '没有匹配的服务' : '暂无服务，点击右上角注册'">
          <el-button v-if="hasFilter" @click="clearFilters">清空筛选</el-button>
        </el-empty>
      </div>

      <!-- 服务卡片列表 -->
      <div v-else class="service-grid">
        <ServiceCard v-for="svc in services" :key="svc.id" :service="svc" @edit="handleEdit" @delete="handleDelete"
          @check="handleCheck" />
      </div>
    </div>

    <!-- 注册/编辑弹窗 -->
    <ServiceFormDialog v-model="dialogVisible" :service="editingService" @success="handleFormSuccess" />

    <!-- P1 维护窗口弹窗 -->
    <el-dialog v-model="maintVisible" title="维护窗口" width="680px" destroy-on-close>
      <div class="maint-section">
        <div class="maint-title">新建维护窗口</div>
        <div class="maint-form">
          <el-form label-width="90px">
            <el-form-item label="服务" required>
              <el-select v-model="maintForm.services" multiple filterable placeholder="选择一个或多个服务" style="width: 100%">
                <el-option v-for="s in services" :key="s.name" :label="s.name" :value="s.name" />
              </el-select>
            </el-form-item>
            <el-form-item label="原因" required>
              <el-input v-model="maintForm.reason" maxlength="256" placeholder="例如：数据库版本升级" />
            </el-form-item>
            <el-form-item label="到期时间" required>
              <el-date-picker v-model="maintForm.until" type="datetime" value-format="YYYY-MM-DDTHH:mm:ss"
                placeholder="维护截止时间（必须晚于当前 15 分钟）"
                :disabled-date="disabledBeforeNowPlus15" style="width: 100%" />
            </el-form-item>
            <el-form-item label="备注">
              <el-input v-model="maintForm.note" maxlength="500" placeholder="可选" />
            </el-form-item>
          </el-form>
          <div class="maint-actions">
            <el-button type="primary" :loading="maintCreating" @click="createMaintenance">创建</el-button>
          </div>
        </div>
      </div>

      <div class="maint-section">
        <div class="maint-title">当前生效窗口</div>
        <div v-loading="maintLoading" class="maint-list">
          <el-empty v-if="!maintLoading && activeWindows.length === 0" description="暂无维护窗口" :image-size="60" />
          <div v-for="w in activeWindows" :key="w.id" class="maint-item">
            <div class="maint-item-main">
              <span class="maint-item-service">{{ w.service }}</span>
              <span class="maint-item-reason">{{ w.reason }}</span>
            </div>
            <div class="maint-item-meta">
              <span v-if="w.until">至 {{ fmtUntil(w.until) }}</span>
              <span v-if="w.createdBy"> · {{ w.createdBy }}</span>
            </div>
            <el-button size="small" type="danger" plain :loading="w._ending" @click="endMaintenance(w)">
              提前结束
            </el-button>
          </div>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount } from 'vue'
import { Search, Plus, Tools } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import ServiceCard from '@/components/service/ServiceCard.vue'
import ServiceFormDialog from '@/components/service/ServiceFormDialog.vue'
import { listMaintenanceWindows, createMaintenanceWindow, endMaintenanceWindow } from '@/api/maintenance'
import {
  listServices,
  registerService,
  updateService,
  deleteService,
  checkHealth
} from '@/api/service'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()

const services = ref([])
const loading = ref(false)
const autoRefresh = ref(false)
const refreshInterval = ref(30)
let refreshTimer = null

const filters = reactive({
  keyword: '',
  env: '',
  status: ''
})

const hasFilter = computed(() => !!(filters.keyword || filters.env || filters.status))
const canWrite = computed(() => authStore.hasPermission('service:manage'))
const canMaintain = computed(() => authStore.hasPermission('maintenance:manage'))

// 弹窗
const dialogVisible = ref(false)
const editingService = ref(null)

onMounted(() => {
  loadServices()
})

onBeforeUnmount(() => {
  stopAutoRefresh()
})

function toggleAutoRefresh() {
  if (autoRefresh.value) {
    startAutoRefresh()
  } else {
    stopAutoRefresh()
  }
}

function restartAutoRefresh() {
  if (autoRefresh.value) {
    startAutoRefresh()
  }
}

function startAutoRefresh() {
  stopAutoRefresh()
  refreshTimer = setInterval(() => {
    loadServices()
  }, refreshInterval.value * 1000)
}

function stopAutoRefresh() {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
}

// 加载列表
async function loadServices() {
  loading.value = true
  try {
    // 只传有值的参数
    const params = {}
    if (filters.env) params.env = filters.env
    if (filters.status) params.status = filters.status
    let result = await listServices({
      env: filters.env,
      status: filters.status
    })

    // keyword 在前端筛选
    if (filters.keyword) {
      const kw = filters.keyword.toLowerCase()
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(kw) ||
          s.baseUrl.toLowerCase().includes(kw) ||
          (s.owner && s.owner.toLowerCase().includes(kw))
      )
    }

    services.value = result
    markMaintenanceStatus()
  } catch (error) {
    ElMessage.error(error.message || '加载失败')
  } finally {
    loading.value = false
  }
}

// 后台静默加载活跃维护窗口，给服务卡片打"维护中"标记（不弹窗）
async function markMaintenanceStatus() {
  if (!canMaintain.value) return
  try {
    const windows = (await listMaintenanceWindows(true)) || []
    const inMaint = new Set(windows.map((w) => w.service))
    services.value.forEach((s) => { s.inMaintenance = inMaint.has(s.name) })
  } catch (e) {
    // 维护窗口加载失败不阻断服务列表
  }
}

// 清空筛选
function clearFilters() {
  filters.keyword = ''
  filters.env = ''
  filters.status = ''
  loadServices()
}

// 注册
function handleRegister() {
  editingService.value = null
  dialogVisible.value = true
}

// 编辑
function handleEdit(service) {
  editingService.value = service
  dialogVisible.value = true
}

// ========== P1 维护窗口 ==========
const maintVisible = ref(false)
const maintLoading = ref(false)
const maintCreating = ref(false)
const activeWindows = ref([])
const maintForm = reactive({ services: [], reason: '', until: null, note: '' })

function openMaintenance() {
  if (!canMaintain.value) return
  maintForm.services = []
  maintForm.reason = ''
  maintForm.until = null
  maintForm.note = ''
  maintVisible.value = true
  loadActiveWindows()
}

async function loadActiveWindows() {
  maintLoading.value = true
  try {
    activeWindows.value = (await listMaintenanceWindows(true)) || []
    // 标记服务维护中（供卡片显示 tag）
    const inMaint = new Set(activeWindows.value.map((w) => w.service))
    services.value.forEach((s) => { s.inMaintenance = inMaint.has(s.name) })
  } catch (e) {
    ElMessage.error(e.message || '加载维护窗口失败')
  } finally {
    maintLoading.value = false
  }
}

function disabledBeforeNowPlus15(date) {
  return date.getTime() < Date.now() + 15 * 60 * 1000
}

function fmtUntil(t) {
  if (!t) return ''
  const d = new Date(t)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

async function createMaintenance() {
  if (maintForm.services.length === 0) {
    ElMessage.warning('请选择至少一个服务')
    return
  }
  if (!maintForm.reason) {
    ElMessage.warning('请填写维护原因')
    return
  }
  if (!maintForm.until) {
    ElMessage.warning('请选择到期时间')
    return
  }
  const min = Date.now() + 15 * 60 * 1000
  if (new Date(maintForm.until).getTime() <= min) {
    ElMessage.warning('到期时间必须晚于当前 15 分钟')
    return
  }
  maintCreating.value = true
  try {
    const created = await createMaintenanceWindow({
      services: maintForm.services,
      reason: maintForm.reason.trim(),
      until: maintForm.until,
      note: maintForm.note.trim() || undefined,
    })
    ElMessage.success(`已创建 ${created.length} 个维护窗口`)
    maintForm.services = []
    maintForm.reason = ''
    maintForm.until = null
    maintForm.note = ''
    loadActiveWindows()
    loadServices()
  } catch (e) {
    ElMessage.error(e.message || '创建维护窗口失败')
  } finally {
    maintCreating.value = false
  }
}

async function endMaintenance(w) {
  try {
    await ElMessageBox.confirm(`确定提前结束服务 ${w.service} 的维护窗口吗？结束后告警将恢复正常通知。`, '提前结束', {
      type: 'warning',
      confirmButtonText: '提前结束',
      cancelButtonText: '取消',
    })
    w._ending = true
    await endMaintenanceWindow(w.id)
    ElMessage.success('已提前结束')
    loadActiveWindows()
    loadServices()
  } catch (e) {
    if (e !== 'cancel' && e && e.message) ElMessage.error(e.message)
  } finally {
    w._ending = false
  }
}

// 表单提交成功
async function handleFormSuccess(data) {
  try {
    if (data.isEdit) {
      await updateService(data.name, data)
      ElMessage.success('更新成功')
    } else {
      await registerService(data)
      ElMessage.success('注册成功')
    }
    loadServices()
  } catch (error) {
    ElMessage.error(error.message || '操作失败')
  }
}

// 删除
async function handleDelete(service) {
  try {
    await ElMessageBox.confirm(
      `确定要删除服务 "${service.name}" 吗？此操作不可恢复。`,
      '删除确认',
      {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        confirmButtonClass: 'el-button--danger'
      }
    )

    await deleteService(service.name)
    ElMessage.success('已删除')
    loadServices()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(error.message || '删除失败')
    }
  }
}

// 触发健康检查
async function handleCheck(service, done) {
  try {
    const result = await checkHealth(service.name)
    if (result.status === 'UP') {
      ElMessage.success(`${service.name} 健康检查通过（UP）`)
    } else {
      ElMessage.warning(`${service.name} 健康检查失败（${result.status}）`)
    }
    loadServices()
  } catch (error) {
    ElMessage.error(error.message || '检查失败')
  } finally {
    done && done()
  }
}
</script>

<style scoped>
.page {
  height: 100%;
  display: flex;
  flex-direction: column;
}

/* 顶部栏 */
.auto-refresh {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-left: 4px;
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

/* 内容区 */
.page-body {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

.service-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(420px, 1fr));
  gap: 16px;
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 400px;
}

/* P1 维护窗口弹窗 */
.maint-section {
  margin-bottom: 18px;
}

.maint-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 10px;
}

.maint-form {
  background: rgba(241, 245, 249, 0.5);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 14px 16px 6px;
}

.maint-actions {
  display: flex;
  justify-content: flex-end;
  padding-bottom: 8px;
}

.maint-list {
  min-height: 60px;
}

.maint-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  margin-bottom: 8px;
  background: #FFF;
}

.maint-item-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.maint-item-service {
  font-size: 13px;
  font-weight: 600;
  font-family: ui-monospace, monospace;
  color: var(--text-primary);
}

.maint-item-reason {
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.maint-item-meta {
  font-size: 12px;
  color: var(--text-muted);
  white-space: nowrap;
  flex-shrink: 0;
}

@media (max-width: 900px) {
  .service-grid {
    grid-template-columns: 1fr;
  }

  .page-header {
    flex-direction: column;
    height: auto;
    padding: 12px 16px;
    align-items: stretch;
  }

  .header-actions {
    flex-wrap: wrap;
  }
}
</style>