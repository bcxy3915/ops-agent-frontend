<template>
  <div class="page">
    <!-- 顶部栏 -->
    <header class="page-header">
      <h2>指标监控</h2>
      <div class="header-actions">
        <el-select v-model="selectedService" placeholder="选择服务" style="width: 220px" @change="loadMetrics">
          <el-option v-for="svc in services" :key="svc.name" :label="svc.name" :value="svc.name">
            <div class="service-option">
              <span class="status-dot" :class="svc.status?.toLowerCase()"></span>
              <span>{{ svc.name }}</span>
              <span class="service-url">{{ svc.baseUrl }}</span>
            </div>
          </el-option>
        </el-select>

        <el-radio-group v-model="range" @change="loadMetrics">
          <el-radio-button value="5m">5分钟</el-radio-button>
          <el-radio-button value="15m">15分钟</el-radio-button>
          <el-radio-button value="1h">1小时</el-radio-button>
          <el-radio-button value="6h">6小时</el-radio-button>
        </el-radio-group>

        <el-button :icon="Refresh" :loading="loading" @click="loadMetrics">
          刷新
        </el-button>
      </div>
    </header>

    <!-- 内容区 -->
    <div class="page-body" v-loading="loading">
      <div class="content-wrap">
        <!-- 服务信息条 -->
        <div v-if="currentService" class="service-bar">
          <div class="service-info">
            <span class="status-dot" :class="currentService.status?.toLowerCase()"></span>
            <span class="service-name">{{ currentService.name }}</span>
            <span class="service-url">{{ currentService.baseUrl }}</span>
          </div>
          <div class="update-time">
            <el-icon>
              <Clock />
            </el-icon>
            更新于 {{ lastUpdateTime }}
          </div>
        </div>

        <!-- 4 个关键指标卡片 -->
        <div class="metric-grid">
          <MetricCard label="CPU 使用率" :value="snapshot.cpu * 100" unit="%" :warn-threshold="60" :danger-threshold="80"
            :max-value="100" :formatter="(v) => Number(v).toFixed(2)" />
          <MetricCard label="JVM 内存" :value="snapshot.memoryUsed / 1024 / 1024" unit="MB"
            :warn-threshold="(snapshot.memoryMax * 0.7) / 1024 / 1024"
            :danger-threshold="(snapshot.memoryMax * 0.9) / 1024 / 1024" :max-value="snapshot.memoryMax / 1024 / 1024"
            :formatter="(v) => Number(v).toFixed(1)" />
          <MetricCard label="HTTP 请求数" :value="snapshot.httpCount" unit="req/min" :max-value="1000" />
          <MetricCard label="错误率" :value="snapshot.httpErrorRate * 100" unit="%" :warn-threshold="1"
            :danger-threshold="5" :max-value="100" :formatter="(v) => Number(v).toFixed(2)" />
        </div>

        <!-- 折线图区域 -->
        <div class="chart-grid">
          <div class="chart-card">
            <div class="chart-head">
              <div class="chart-title">
                <span class="chart-dot" style="background: #3B82F6"></span>
                CPU 使用率
              </div>
              <span class="chart-unit">%</span>
            </div>
            <LineChart :data="transformSeries(series.cpu, (v) => v * 100)" color="#3B82F6" unit="%" />
          </div>

          <div class="chart-card">
            <div class="chart-head">
              <div class="chart-title">
                <span class="chart-dot" style="background: #8B5CF6"></span>
                JVM 内存
              </div>
              <span class="chart-unit">MB</span>
            </div>
            <LineChart :data="series.memory" color="#8B5CF6" unit="MB" :precision="1" />
          </div>

          <div class="chart-card">
            <div class="chart-head">
              <div class="chart-title">
                <span class="chart-dot" style="background: #10B981"></span>
                HTTP 请求数
              </div>
              <span class="chart-unit">req/min</span>
            </div>
            <LineChart :data="series.httpCount" color="#10B981" unit="req/min" :precision="0" />
          </div>

          <div class="chart-card">
            <div class="chart-head">
              <div class="chart-title">
                <span class="chart-dot" style="background: #F59E0B"></span>
                GC 暂停时间
              </div>
              <span class="chart-unit">ms</span>
            </div>
            <LineChart :data="series.gcPause" color="#F59E0B" unit="ms" />
          </div>
        </div>

        <!-- 其他指标 -->
        <div class="other-metrics">
          <div class="other-title">其他指标</div>
          <div class="other-grid">
            <div class="other-item">
              <span class="other-label">活跃线程数</span>
              <span class="other-value">{{ snapshot.threadCount }}</span>
            </div>
            <div class="other-item">
              <span class="other-label">数据库活跃连接</span>
              <span class="other-value">{{ snapshot.hikariActive }}</span>
            </div>
            <div class="other-item">
              <span class="other-label">数据库等待连接</span>
              <span class="other-value">{{ snapshot.hikariPending }}</span>
            </div>
            <div class="other-item">
              <span class="other-label">HTTP 平均耗时</span>
              <span class="other-value">{{ (snapshot.httpAvgDuration * 1000).toFixed(1) }} ms</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { Refresh, Clock } from '@element-plus/icons-vue'
import MetricCard from '@/components/metrics/MetricCard.vue'
import LineChart from '@/components/metrics/LineChart.vue'
import { getServiceList, getMetrics } from '@/api/metrics'

const services = ref([])
const selectedService = ref('')
const range = ref('5m')
const loading = ref(false)
const lastUpdateTime = ref('')

const snapshot = reactive({
  cpu: 0,
  memoryUsed: 0,
  memoryMax: 1,
  httpCount: 0,
  httpErrorRate: 0,
  httpAvgDuration: 0,
  threadCount: 0,
  gcPause: 0,
  hikariActive: 0,
  hikariPending: 0
})

const series = reactive({
  cpu: [],
  memory: [],
  httpCount: [],
  gcPause: [],
  hikariActive: []
})

const currentService = computed(() =>
  services.value.find((s) => s.name === selectedService.value)
)

onMounted(async () => {
  try {
    services.value = await getServiceList()
    if (services.value.length > 0) {
      selectedService.value = services.value[0].name
      loadMetrics()
    }
  } catch (error) {
    ElMessage.error(error.message || '加载服务列表失败')
  }
})

async function loadMetrics() {
  if (!selectedService.value) return

  loading.value = true
  try {
    const data = await getMetrics(selectedService.value, range.value)

    Object.assign(snapshot, data.snapshot)
    Object.assign(series, data.series)

    const now = new Date()
    const pad = (n) => String(n).padStart(2, '0')
    lastUpdateTime.value = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
  } catch (error) {
    ElMessage.error(error.message || '加载指标失败')
  } finally {
    loading.value = false
  }
}

function transformSeries(data, transform) {
  return data.map((d) => ({ ...d, value: transform(d.value) }))
}
</script>

<style scoped>
.page {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
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

.service-option {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.service-option .service-url {
  margin-left: auto;
  color: var(--text-muted);
  font-size: 11px;
  font-family: ui-monospace, monospace;
}

/* 内容区 */
.page-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px 24px;
}

.content-wrap {
  max-width: 1600px;
  margin: 0 auto;
}

/* 状态点 */
.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  display: inline-block;
}

.status-dot.up {
  background: var(--success);
  box-shadow: 0 0 0 3px rgba(5, 150, 105, 0.15);
}

.status-dot.down {
  background: var(--danger);
  box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.15);
}

.status-dot.unknown {
  background: var(--warning);
  box-shadow: 0 0 0 3px rgba(217, 119, 6, 0.15);
}

/* 服务信息条 */
.service-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(255, 255, 255, 0.75);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(226, 232, 240, 0.8);
  border-radius: 10px;
  padding: 12px 16px;
  margin-bottom: 16px;
}

.service-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.service-name {
  font-size: 14px;
  font-weight: 600;
  font-family: ui-monospace, monospace;
  color: var(--text-primary);
}

.service-bar .service-url {
  font-size: 12.5px;
  color: var(--text-muted);
  font-family: ui-monospace, monospace;
}

.update-time {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: var(--text-muted);
}

/* 指标卡片网格 */
.metric-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 14px;
  margin-bottom: 16px;
}

/* 折线图网格 */
.chart-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(420px, 1fr));
  gap: 14px;
  margin-bottom: 16px;
}

.chart-card {
  background: linear-gradient(180deg, #FFFFFF 0%, #FDFEFF 100%);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 14px 16px;
  box-shadow: var(--card-shadow);
  transition: all 0.2s;
}

.chart-card:hover {
  box-shadow: var(--card-shadow-hover);
}

.chart-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.chart-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--text-primary);
}

.chart-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.chart-unit {
  font-size: 11.5px;
  color: var(--text-muted);
  font-family: ui-monospace, monospace;
}

/* 其他指标 */
.other-metrics {
  background: rgba(255, 255, 255, 0.75);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(226, 232, 240, 0.8);
  border-radius: 12px;
  padding: 16px 20px;
}

.other-title {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 12px;
}

.other-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
}

.other-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  background: rgba(241, 245, 249, 0.5);
  border-radius: 8px;
}

.other-label {
  font-size: 12.5px;
  color: var(--text-secondary);
}

.other-value {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  font-family: ui-monospace, monospace;
}

@media (max-width: 900px) {
  .page-header {
    flex-direction: column;
    height: auto;
    padding: 12px 16px;
    align-items: stretch;
  }

  .header-actions {
    flex-wrap: wrap;
  }

  .chart-grid {
    grid-template-columns: 1fr;
  }
}
</style>