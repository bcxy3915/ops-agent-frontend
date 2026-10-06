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
        <el-button type="primary" :icon="Plus" v-if="canWrite" @click="handleRegister">
          注册服务
        </el-button>
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
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { Search, Plus } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import ServiceCard from '@/components/service/ServiceCard.vue'
import ServiceFormDialog from '@/components/service/ServiceFormDialog.vue'
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

const filters = reactive({
  keyword: '',
  env: '',
  status: ''
})

const hasFilter = computed(() => !!(filters.keyword || filters.env || filters.status))
const canWrite = computed(() => authStore.isOperator)

// 弹窗
const dialogVisible = ref(false)
const editingService = ref(null)

onMounted(() => {
  loadServices()
})

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
  } catch (error) {
    ElMessage.error(error.message || '加载失败')
  } finally {
    loading.value = false
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