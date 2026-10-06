<template>
  <div class="page">
    <!-- 顶部栏 -->
    <header class="page-header">
      <h2>审计日志</h2>
      <div class="header-actions">
        <el-select v-model="filters.username" placeholder="用户" clearable style="width: 130px" @change="handleSearch">
          <el-option v-for="u in usernames" :key="u" :label="u" :value="u" />
        </el-select>

        <el-select v-model="filters.operation" placeholder="操作类型" clearable style="width: 160px" @change="handleSearch">
          <el-option v-for="op in operationTypes" :key="op.value" :label="op.label" :value="op.value" />
        </el-select>

        <el-select v-model="filters.result" placeholder="结果" clearable style="width: 110px" @change="handleSearch">
          <el-option label="成功" value="SUCCESS" />
          <el-option label="失败" value="FAILURE" />
        </el-select>

        <el-button @click="handleReset">重置</el-button>
      </div>
    </header>

    <!-- 表格 -->
    <div class="page-body" v-loading="loading">
      <el-table :data="logs" stripe style="width: 100%" row-key="id" @row-click="handleRowClick">
        <el-table-column type="expand">
          <template #default="{ row }">
            <div class="expand-detail">
              <div class="detail-item">
                <span class="detail-label">URI</span>
                <code>{{ row.uri }}</code>
              </div>
              <div class="detail-item">
                <span class="detail-label">Method</span>
                <code>{{ row.method }}</code>
              </div>
              <div class="detail-item">
                <span class="detail-label">IP</span>
                <code>{{ row.ip }}</code>
              </div>
              <div class="detail-item">
                <span class="detail-label">User-Agent</span>
                <code>{{ row.userAgent }}</code>
              </div>
              <div class="detail-item full">
                <span class="detail-label">请求参数</span>
                <pre>{{ row.params }}</pre>
              </div>
              <div v-if="row.errorMessage" class="detail-item full">
                <span class="detail-label">错误信息</span>
                <pre class="error">{{ row.errorMessage }}</pre>
              </div>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="时间" width="180">
          <template #default="{ row }">
            <span class="mono">{{ formatTime(row.createdAt) }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="username" label="用户" width="120">
          <template #default="{ row }">
            <span class="user-tag">{{ row.username }}</span>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="140">
          <template #default="{ row }">
            {{ row.operationLabel }}
          </template>
        </el-table-column>

        <el-table-column prop="target" label="对象" width="180">
          <template #default="{ row }">
            <span class="mono">{{ row.target }}</span>
          </template>
        </el-table-column>

        <el-table-column label="结果" width="100">
          <template #default="{ row }">
            <span class="result-badge" :class="row.result.toLowerCase()">
              {{ row.result === 'SUCCESS' ? '成功' : '失败' }}
            </span>
          </template>
        </el-table-column>

        <el-table-column label="耗时" width="100">
          <template #default="{ row }">
            <span class="mono">{{ row.durationMs }}ms</span>
          </template>
        </el-table-column>

        <el-table-column prop="ip" label="IP" min-width="200">
          <template #default="{ row }">
            <span class="mono">{{ row.ip }}</span>
          </template>
        </el-table-column>
      </el-table>
    </div>
    <!-- 分页 -->
    <div class="pagination-wrap">
      <el-pagination v-model:current-page="pagination.page" v-model:page-size="pagination.size"
        :page-sizes="[10, 20, 50, 100]" :total="pagination.total" layout="total, sizes, prev, pager, next, jumper"
        background @current-change="loadLogs" @size-change="handleSizeChange" />
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { listAuditLogs, getOperationTypes, getUsernames } from '@/api/audit'

const operationTypes = ref([])
const usernames = ref([])

const logs = ref([])
const loading = ref(false)

const filters = reactive({
  username: '',
  operation: '',
  result: ''
})

const pagination = reactive({
  page: 1,
  size: 20,
  total: 0
})

onMounted(() => {
  operationTypes.value = getOperationTypes()
  usernames.value = getUsernames()
  loadLogs()
})

async function loadLogs() {
  loading.value = true
  try {
    const res = await listAuditLogs({
      ...filters,
      page: pagination.page,
      size: pagination.size
    })
    logs.value = res.records
    pagination.total = res.total
  } catch (error) {
    ElMessage.error(error.message || '加载失败')
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  pagination.page = 1
  loadLogs()
}

function handleReset() {
  filters.username = ''
  filters.operation = ''
  filters.result = ''
  handleSearch()
}

function handleSizeChange() {
  pagination.page = 1
  loadLogs()
}

function handleRowClick(row, column, event) {
  // 点击展开列之外的区域切换展开
  // 简单做法：默认点击整行展开
  // （el-table 的 expand 列会自己处理，这里不用做）
}

function formatTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}
</script>

<style scoped>
.page {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  /* ★ 防止整体滚动 */
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

/* 表格区：占满剩余空间，独立滚动 */
.page-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px 24px 0;
  /* 底部不加 padding，分页区自带 */
}

.mono {
  font-family: ui-monospace, monospace;
  font-size: 12.5px;
}

.user-tag {
  padding: 2px 8px;
  background: rgba(219, 234, 254, 0.6);
  color: var(--primary);
  border-radius: 4px;
  font-size: 12px;
  font-family: ui-monospace, monospace;
}

.result-badge {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 500;
}

.result-badge.success {
  background: var(--success-bg);
  color: var(--success);
}

.result-badge.failure {
  background: var(--danger-bg);
  color: var(--danger);
}

/* ★ 分页区：固定在底部 */
.pagination-wrap {
  display: flex;
  justify-content: flex-end;
  padding: 16px 24px;
  border-top: 1px solid rgba(226, 232, 240, 0.6);
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  flex-shrink: 0;
}

/* 展开详情 */
.expand-detail {
  padding: 12px 24px 16px 60px;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.detail-item.full {
  grid-column: span 2;
}

.detail-label {
  font-size: 11.5px;
  color: var(--text-muted);
  font-weight: 500;
}

.detail-item code,
.detail-item pre {
  font-family: ui-monospace, monospace;
  font-size: 12px;
  background: rgba(241, 245, 249, 0.7);
  padding: 6px 10px;
  border-radius: 6px;
  word-break: break-all;
  white-space: pre-wrap;
  color: var(--text-primary);
  margin: 0;
}

.detail-item pre.error {
  background: var(--danger-bg);
  color: var(--danger);
}
</style>