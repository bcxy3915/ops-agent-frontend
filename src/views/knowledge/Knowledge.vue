<template>
  <div class="page kb-page">
    <!-- 页头：标题 + 检索测试 / 上传知识 -->
    <header class="page-header">
      <h2>知识库 <span class="page-sub">内置 SOP · 企业私有文档 · 故障案例，统一管理并为诊断提供可溯源依据</span></h2>
      <div class="header-actions">
        <el-button @click="switchTab('retrieval')">检索测试</el-button>
        <el-button type="primary" :icon="Plus" @click="openUpload">上传知识</el-button>
      </div>
    </header>

    <div class="page-body">
      <div class="kb-content">
        <!-- 一级 Tab：总览 / 文档 / 案例 / 检索 -->
        <div class="kb-tabs">
          <button
            v-for="t in tabs" :key="t.key"
            class="kb-tab" :class="{ active: activeTab === t.key }"
            @click="switchTab(t.key)"
          >
            {{ t.label }}
            <span v-if="t.key === 'documents' && stats.totalDocs" class="kb-tag kb-tag-info" style="margin-left: 2px">{{ stats.totalDocs }}</span>
            <span v-if="t.key === 'cases' && stats.pendingCases" class="kb-tag kb-tag-warning" style="margin-left: 2px">{{ stats.pendingCases }} 待确认</span>
          </button>
        </div>

        <OverviewTab
          v-if="activeTab === 'overview'"
          :tick="overviewTick"
          @switch-tab="switchTab"
          @open-upload="openUpload"
        />
        <DocumentsTab
          v-else-if="activeTab === 'documents'"
          :tick="docTick"
          @open-upload="openUpload"
        />
        <CasesTab v-else-if="activeTab === 'cases'" :tick="caseTick" />
        <RetrievalTab v-else />
      </div>
    </div>

    <!-- 上传抽屉（4 步引导） -->
    <UploadDrawer
      v-model="uploadVisible"
      @published="handlePublished"
    />
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { Plus } from '@element-plus/icons-vue'
import { getKnowledgeStats } from '@/api/knowledge'
import OverviewTab from './OverviewTab.vue'
import DocumentsTab from './DocumentsTab.vue'
import CasesTab from './CasesTab.vue'
import RetrievalTab from './RetrievalTab.vue'
import UploadDrawer from './UploadDrawer.vue'
import '@/styles/knowledge.css'

const tabs = [
  { key: 'overview', label: '知识总览' },
  { key: 'documents', label: '知识文档' },
  { key: 'cases', label: '案例沉淀' },
  { key: 'retrieval', label: '检索测试' }
]

const activeTab = ref('overview')
const uploadVisible = ref(false)
const stats = reactive({
  totalDocs: 0,
  pendingDocs: 0,
  expiredDocs: 0,
  zeroHitDocs: 0,
  orphanDocs: 0,
  totalCases: 0,
  pendingCases: 0,
  confirmedCases: 0,
  pendingConflicts: 0,
  monthHits: 0
})

// 发布/数据变化后用于驱动子组件刷新的计数
const docTick = ref(0)
const overviewTick = ref(0)
const caseTick = ref(0)

async function loadStats() {
  try {
    const res = await getKnowledgeStats()
    Object.assign(stats, res)
  } catch (e) {
    // 统计失败静默（列表仍可用）
  }
}

function switchTab(key) {
  activeTab.value = key
}

function openUpload() {
  uploadVisible.value = true
}

/** 上传发布成功：刷新统计与各 Tab */
function handlePublished() {
  docTick.value += 1
  overviewTick.value += 1
  caseTick.value += 1
  loadStats()
}

onMounted(loadStats)
</script>

<style scoped>
.kb-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.page-header {
  height: 64px;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  border-bottom: 1px solid rgba(226, 232, 240, 0.6);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  gap: 12px;
}

.page-header h2 {
  font-size: 16px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--text-primary);
}

.page-sub { font-size: 12px; color: var(--text-muted); font-weight: 400; }

.header-actions { display: flex; align-items: center; gap: 10px; }

.page-body {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

.kb-content { max-width: 1280px; margin: 0 auto; }
</style>
