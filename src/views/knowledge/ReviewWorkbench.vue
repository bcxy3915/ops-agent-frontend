<template>
  <div class="rbac-page">
    <header class="rbac-header">
      <h2>审核工作台 <span class="sub">部门审核 / 企业审核 · 四眼原则</span></h2>
      <div class="header-actions">
        <span class="pill">{{ tenantLabel }}</span>
        <span class="pill warning">审核模式：{{ reviewModeLabel }}</span>
      </div>
    </header>

    <div class="rbac-body" v-loading="loading">
      <div class="stat-grid">
        <div class="stat-card"><div class="k">待部门审核</div><div class="v warning">{{ pendingDept.length }}</div></div>
        <div class="stat-card"><div class="k">待企业审核</div><div class="v primary">{{ pendingTenant.length }}</div></div>
        <div class="stat-card"><div class="k">今日已审核</div><div class="v success">{{ todayReviewed }}</div></div>
        <div class="stat-card"><div class="k">平均审核时长</div><div class="v">— <small>暂无统计</small></div></div>
      </div>

      <div class="rbac-tabs">
        <button class="tab" :class="{ active: activeTab === 'dept' }" @click="activeTab = 'dept'">
          待部门审核 <span class="tag tag-warning">{{ pendingDept.length }}</span>
        </button>
        <button class="tab" :class="{ active: activeTab === 'tenant' }" @click="activeTab = 'tenant'">
          待企业审核 <span class="tag tag-primary">{{ pendingTenant.length }}</span>
        </button>
        <button class="tab" :class="{ active: activeTab === 'done' }" @click="activeTab = 'done'">
          我已审核 <span class="tag tag-success">{{ doneDocs.length }}</span>
        </button>
      </div>

      <div class="review-list">
        <div v-for="doc in currentList" :key="doc.id" class="rbac-card review-card">
          <div class="review-top">
            <div class="review-main">
              <div class="review-title">
                {{ doc.title }}
                <span class="tag" :class="visibilityTag(doc.visibility)">{{ visibilityLabel(doc.visibility) }}</span>
                <span class="tag tag-info">{{ doc.docType || '文档' }}</span>
              </div>
              <div class="review-meta">
                <span>上传人：{{ doc.owner || '-' }}</span>
                <span>部门：{{ deptName(doc.deptId) }}</span>
                <span>提交：{{ formatTime(doc.submittedAt || doc.updatedAt) }}</span>
                <span v-if="serviceText(doc)">关联服务：{{ serviceText(doc) }}</span>
              </div>
            </div>
            <div style="display: flex; gap: 6px; align-items: center">
              <span class="tag" :class="statusTag(doc.reviewStatus)">{{ statusLabel(doc.reviewStatus) }}</span>
              <span
                v-if="doc.reviewStatus === 'APPROVED'"
                class="tag"
                :class="publishTag(doc.publishStatus)"
              >{{ publishLabel(doc.publishStatus) }}</span>
            </div>
          </div>

          <div class="review-body">
            <b>摘要：</b>{{ summary(doc.rawContent) }}
          </div>

          <div class="review-actions" v-if="activeTab !== 'done'">
            <el-button size="small" @click="preview(doc)">查看全文</el-button>
            <el-button size="small" type="danger" plain @click="openReview(doc, false)">驳回</el-button>
            <el-button size="small" type="primary" @click="openReview(doc, true)">
              通过并发布到{{ doc.reviewStatus === 'PENDING_TENANT' ? '本企业' : '本部门' }}
            </el-button>
          </div>
          <div class="review-actions" v-else>
            <el-button size="small" @click="preview(doc)">查看全文</el-button>
            <span class="review-note">审核意见：{{ doc.reviewNote || '—' }}</span>
          </div>
        </div>
        <el-empty v-if="!loading && currentList.length === 0" :description="emptyText" />
      </div>

      <div class="alert-info">
        <el-icon><InfoFilled /></el-icon>
        <span>四眼原则：审核人不能是上传人。租户可在「租户配置」中关闭该限制，但关闭操作会写入审计日志。</span>
      </div>
    </div>

    <el-dialog v-model="previewVisible" :title="previewDoc ? previewDoc.title : '文档预览'" width="760px">
      <div v-loading="previewLoading" class="preview-body">
        <pre v-if="previewDoc">{{ previewDoc.rawContent || '（无正文）' }}</pre>
      </div>
    </el-dialog>

    <el-dialog v-model="reviewVisible" :title="reviewApproved ? '审核通过' : '审核驳回'" width="500px"
      :close-on-click-modal="false">
      <el-form label-width="90px">
        <el-form-item label="文档"><span>{{ reviewDoc ? reviewDoc.title : '' }}</span></el-form-item>
        <el-form-item label="审核层级">
          <el-tag size="small">{{ reviewDoc ? levelLabel(reviewDoc.reviewLevel || reviewDoc.reviewStatus) : '' }}</el-tag>
        </el-form-item>
        <el-form-item label="审核意见">
          <el-input v-model="comment" type="textarea" :rows="4" maxlength="500" show-word-limit
            :placeholder="reviewApproved ? '可选，填写通过意见' : '请填写驳回原因'" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="reviewVisible = false">取消</el-button>
        <el-button :type="reviewApproved ? 'success' : 'danger'" :loading="submitting" @click="submitReview">
          {{ reviewApproved ? '确认通过' : '确认驳回' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { InfoFilled } from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'
import { listKnowledgeDocuments, getKnowledgeDocument, reviewKnowledgeDocument } from '@/api/knowledge'
import { listDepts, getTenant } from '@/api/rbac'
import { publishLabel } from './kb-utils'

const authStore = useAuthStore()
const tenantLabel = computed(() => authStore.tenantId === '0' ? '平台' : (authStore.tenantId || '当前企业'))
const reviewMode = ref('')
const reviewModeLabel = computed(() => {
  return { DEPT_ONLY: '仅部门', DEPT_AND_TENANT: '部门 + 企业', NONE: '免审核' }[reviewMode.value] || '按租户配置'
})

const loading = ref(false)
const pendingDocs = ref([])
const doneDocs = ref([])
const deptMap = ref({})
const activeTab = ref('dept')

const pendingDept = computed(() => pendingDocs.value.filter((d) => d.reviewStatus === 'PENDING_DEPT'))
const pendingTenant = computed(() => pendingDocs.value.filter((d) => d.reviewStatus === 'PENDING_TENANT'))
const currentList = computed(() => {
  if (activeTab.value === 'dept') return pendingDept.value
  if (activeTab.value === 'tenant') return pendingTenant.value
  return doneDocs.value
})
const todayReviewed = computed(() => {
  const today = new Date()
  return doneDocs.value.filter((d) => {
    const iso = myReviewTime(d)
    if (!iso) return false
    const t = new Date(iso)
    return t.getFullYear() === today.getFullYear() && t.getMonth() === today.getMonth() && t.getDate() === today.getDate()
  }).length
})
const emptyText = computed(() => {
  if (activeTab.value === 'dept') return '暂无待部门审核文档'
  if (activeTab.value === 'tenant') return '暂无待企业审核文档'
  return '暂无我审核过的文档'
})

const previewVisible = ref(false)
const previewLoading = ref(false)
const previewDoc = ref(null)

const reviewVisible = ref(false)
const reviewDoc = ref(null)
const reviewApproved = ref(true)
const comment = ref('')
const submitting = ref(false)

onMounted(async () => {
  await Promise.all([loadDepts(), loadTenantMode(), load()])
})

async function loadTenantMode() {
  if (!authStore.hasPermission('tenant:manage') || authStore.tenantId === '0') return
  try {
    const tenant = await getTenant(authStore.tenantId)
    reviewMode.value = tenant.knowledgeReviewMode || ''
  } catch {
    reviewMode.value = ''
  }
}

async function loadDepts() {
  try {
    const list = await listDepts()
    deptMap.value = Object.fromEntries((list || []).map((d) => [d.id, d.name]))
  } catch {
    deptMap.value = {}
  }
}

async function load() {
  loading.value = true
  try {
    const [pending, verified] = await Promise.all([
      listKnowledgeDocuments({ trustStatus: 'PENDING', page: 1, size: 100 }),
      listKnowledgeDocuments({ trustStatus: 'VERIFIED', page: 1, size: 100 }),
    ])
    const pendingRecords = pending.records || []
    const verifiedRecords = verified.records || []
    pendingDocs.value = pendingRecords.filter((d) =>
      (d.reviewStatus === 'PENDING_DEPT' || d.reviewStatus === 'PENDING_TENANT')
      && !isReviewedByMe(d))
    // “我已审核”需要包含：部门已通过、待企业审核；企业已通过；已驳回
    const done = [...pendingRecords, ...verifiedRecords].filter((d) =>
      isReviewedByMe(d) && ['PENDING_TENANT', 'APPROVED', 'REJECTED'].includes(d.reviewStatus))
    const unique = new Map()
    done.forEach((d) => { if (!unique.has(d.id)) unique.set(d.id, d) })
    doneDocs.value = [...unique.values()].sort((a, b) =>
      new Date(myReviewTime(b) || 0) - new Date(myReviewTime(a) || 0))
  } catch (e) {
    ElMessage.error(e.message || '加载审核列表失败')
    pendingDocs.value = []
    doneDocs.value = []
  } finally {
    loading.value = false
  }
}

function isReviewedByMe(doc) {
  return (doc.reviewedBy && doc.reviewedBy === authStore.username)
    || (doc.deptReviewedBy && doc.deptReviewedBy === authStore.username)
}

function myReviewTime(doc) {
  const times = []
  if (doc.reviewedBy && doc.reviewedBy === authStore.username && doc.reviewedAt) times.push(doc.reviewedAt)
  if (doc.deptReviewedBy && doc.deptReviewedBy === authStore.username && doc.deptReviewedAt) times.push(doc.deptReviewedAt)
  return times.sort().at(-1) || doc.reviewedAt || doc.deptReviewedAt || null
}

function notifyReviewChanged() {
  window.dispatchEvent(new CustomEvent('knowledge-review-updated'))
}

async function preview(doc) {
  previewDoc.value = doc
  previewVisible.value = true
  previewLoading.value = true
  try {
    previewDoc.value = await getKnowledgeDocument(doc.id)
  } catch (e) {
    ElMessage.error(e.message || '加载文档失败')
  } finally {
    previewLoading.value = false
  }
}

function openReview(doc, approved) {
  reviewDoc.value = doc
  reviewApproved.value = approved
  comment.value = ''
  reviewVisible.value = true
}

async function submitReview() {
  if (!reviewDoc.value) return
  if (!reviewApproved.value && !comment.value.trim()) {
    ElMessage.warning('驳回时请填写原因')
    return
  }
  submitting.value = true
  try {
    await reviewKnowledgeDocument(reviewDoc.value.id, {
      level: reviewDoc.value.reviewLevel || (reviewDoc.value.reviewStatus === 'PENDING_TENANT' ? 'TENANT' : 'DEPT'),
      approved: reviewApproved.value,
      comment: comment.value.trim() || null,
    })
    ElMessage.success(reviewApproved.value ? '审核已通过，正在后台入库，可到文档列表查看进度' : '已驳回')
    reviewVisible.value = false
    await load()
    notifyReviewChanged()
  } catch (e) {
    ElMessage.error(e.message || '审核失败')
  } finally {
    submitting.value = false
  }
}

function deptName(id) {
  return id == null ? '-' : deptMap.value[id] || String(id)
}

function serviceText(doc) {
  return (doc.serviceIds || []).join('、')
}

function summary(text) {
  if (!text) return '（无正文）'
  const plain = text.replace(/[#>*`_-]/g, ' ').replace(/\s+/g, ' ').trim()
  return plain.length > 160 ? plain.slice(0, 160) + '…' : plain
}

function visibilityLabel(v) {
  return { PERSONAL: '私有', DEPT: '本部门', TENANT: '本企业', PUBLIC: '公共' }[v] || v || '-'
}

function visibilityTag(v) {
  return { PERSONAL: 'tag-info', DEPT: 'tag-teal', TENANT: 'tag-primary', PUBLIC: 'tag-success' }[v] || 'tag-info'
}

function statusLabel(s) {
  return { PENDING_DEPT: '待部门审核', PENDING_TENANT: '待企业审核', APPROVED: '已通过', REJECTED: '已驳回' }[s] || s
}

function statusTag(s) {
  return s === 'PENDING_TENANT' ? 'tag-primary' : s === 'APPROVED' ? 'tag-success' : s === 'REJECTED' ? 'tag-danger' : 'tag-warning'
}

/** 索引发布状态 tag（审核通过后独立流转） */
function publishTag(s) {
  return {
    BUILDING: 'tag-warning',
    FAILED: 'tag-danger',
    PUBLISHED: 'tag-success'
  }[s] || 'tag-info'
}

function levelLabel(level) {
  return { DEPT: '部门审核', TENANT: '企业审核' }[level] || level || '-'
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
.header-actions { display: flex; gap: 8px; align-items: center; }
.pill { padding: 3px 10px; border-radius: 12px; font-size: 12px; background: var(--primary-light); color: var(--primary); }
.pill.warning { background: var(--warning-bg); color: var(--warning); }
.rbac-body { flex: 1; overflow-y: auto; padding: 20px 24px; }
.stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 16px; }
.stat-card { background: var(--card-bg); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 14px 18px; box-shadow: var(--card-shadow); }
.stat-card .k { font-size: 12px; color: var(--text-muted); }
.stat-card .v { font-size: 24px; font-weight: 700; margin-top: 4px; }
.stat-card .v small { font-size: 12px; font-weight: 400; color: var(--text-muted); }
.stat-card .warning { color: var(--warning); }
.stat-card .primary { color: var(--primary); }
.stat-card .success { color: var(--success); }
.rbac-tabs { display: flex; gap: 4px; margin-bottom: 14px; border-bottom: 1px solid var(--border); }
.tab {
  border: none; background: transparent; padding: 9px 16px; font-size: 13.5px; color: var(--text-secondary);
  cursor: pointer; border-bottom: 2px solid transparent; display: flex; align-items: center; gap: 6px;
}
.tab.active { color: var(--primary); border-bottom-color: var(--primary); font-weight: 600; }
.review-list { display: flex; flex-direction: column; gap: 14px; }
.review-card { padding: 16px 18px; }
.review-top { display: flex; align-items: flex-start; gap: 12px; }
.review-main { flex: 1; min-width: 0; }
.review-title { font-size: 15px; font-weight: 600; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.review-meta { display: flex; flex-wrap: wrap; gap: 14px; margin-top: 6px; font-size: 12px; color: var(--text-muted); }
.review-body {
  margin-top: 10px; padding: 10px 12px; background: rgba(248,250,252,.8); border-radius: 8px;
  font-size: 13px; line-height: 1.7; color: var(--text-secondary);
}
.review-actions { display: flex; align-items: center; justify-content: flex-end; gap: 8px; margin-top: 12px; }
.review-note { font-size: 12.5px; color: var(--text-muted); }
.alert-info {
  display: flex; align-items: flex-start; gap: 8px; margin-top: 16px; padding: 10px 14px;
  background: rgba(219,234,254,.4); border-radius: 8px; font-size: 12.5px; color: var(--primary); line-height: 1.6;
}
.preview-body { max-height: 60vh; overflow-y: auto; }
.preview-body pre { white-space: pre-wrap; word-break: break-word; font-size: 13px; line-height: 1.7; margin: 0; }
.tag { display: inline-block; padding: 1px 8px; border-radius: 10px; font-size: 11.5px; font-weight: 500; }
.tag-success { background: var(--success-bg); color: var(--success); }
.tag-warning { background: var(--warning-bg); color: var(--warning); }
.tag-danger { background: var(--danger-bg); color: var(--danger); }
.tag-primary { background: var(--primary-light); color: var(--primary); }
.tag-teal { background: #ECFEFF; color: #0E7490; }
.tag-info { background: #F1F5F9; color: var(--text-secondary); }
</style>
