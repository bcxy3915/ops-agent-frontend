<template>
  <div class="kb-documents">
    <!-- 筛选行 -->
    <div class="kb-filter-row">
      <el-input
        v-model="filters.keyword"
        placeholder="搜索文档名称 / 标签 / 服务"
        style="width: 240px"
        clearable
        @keyup.enter="handleSearch"
        @clear="handleSearch"
      >
        <template #prefix><el-icon><Search /></el-icon></template>
      </el-input>
      <el-select v-model="filters.layer" placeholder="全部层级" style="width: 130px" @change="handleSearch">
        <el-option label="全部层级" value="" />
        <el-option label="官方内置" value="BUILTIN" />
        <el-option label="企业私有" value="PRIVATE" />
        <el-option label="故障案例" value="CASE" />
      </el-select>
      <el-select v-model="filters.trustStatus" placeholder="全部状态" style="width: 130px" @change="handleSearch">
        <el-option label="全部状态" value="" />
        <el-option label="已验证" value="VERIFIED" />
        <el-option label="待审核" value="PENDING" />
        <el-option label="AI待校对" value="AI_DRAFT" />
        <el-option label="已失效" value="EXPIRED" />
      </el-select>
      <el-select v-model="filters.service" placeholder="全部服务" style="width: 150px" clearable @change="handleSearch">
        <el-option v-for="s in serviceOptions" :key="s" :label="s" :value="s" />
      </el-select>
      <el-button @click="handleReset">重置</el-button>
      <div class="kb-filter-sp"></div>
      <el-button v-if="canReload" :icon="Refresh" @click="handleReload">重建索引</el-button>
      <el-button v-if="canWrite" @click="onlineVisible = true">在线编写</el-button>
      <el-button v-if="canWrite" type="primary" :icon="Plus" @click="$emit('open-upload')">上传知识</el-button>
    </div>

    <!-- 文档表格 -->
    <div class="kb-card" style="overflow: hidden">
      <el-table v-loading="loading" :data="rows" class="kb-doc-table" stripe>
        <el-table-column label="文档" min-width="300">
          <template #default="{ row }">
            <div class="kb-doc-name">{{ row.title }}</div>
            <div class="kb-doc-meta">{{ docMeta(row) }}</div>
          </template>
        </el-table-column>
        <el-table-column label="层级" width="110">
          <template #default="{ row }">
            <span class="kb-tag" :class="layerCls(row.layer)">{{ layerLabel(row.layer) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <span class="kb-tag" :class="statusCls(row.trustStatus)">{{ statusLabel(row.trustStatus) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="关联服务" width="130">
          <template #default="{ row }">
            <span class="kb-sec">{{ (row.serviceIds || []).join(' / ') || '通用' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="负责人 / 更新" width="150">
          <template #default="{ row }">
            <div>{{ row.owner || '官方' }}</div>
            <div class="kb-doc-meta">{{ formatDay(row.updatedAt || row.createdAt) }}</div>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="230">
          <template #default="{ row }">
            <template v-for="op in opsFor(row)" :key="op.key">
              <button
                class="kb-op-link"
                :class="{ 'kb-op-danger': op.danger }"
                @click="runOp(op, row)"
              >{{ op.label }}</button>
            </template>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无文档，可点击右上角「上传知识」或「在线编写」" :image-size="80" />
        </template>
      </el-table>

      <div class="kb-pager">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.size"
          :total="pagination.total"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next"
          background
          @current-change="load"
          @size-change="handleSizeChange"
        />
      </div>
    </div>

    <!-- 文档详情 -->
    <el-dialog v-model="detailVisible" title="文档详情" width="760px" destroy-on-close>
      <template v-if="detail">
        <div class="kb-detail-block">
          <div class="kb-detail-label">基本信息</div>
          <div style="font-size: 13px; display: flex; flex-wrap: wrap; gap: 6px 20px">
            <span><span class="kb-muted">标题：</span><b>{{ detail.title }}</b></span>
            <span><span class="kb-muted">层级：</span><span class="kb-tag" :class="layerCls(detail.layer)">{{ layerLabel(detail.layer) }}</span></span>
            <span><span class="kb-muted">状态：</span><span class="kb-tag" :class="statusCls(detail.trustStatus)">{{ statusLabel(detail.trustStatus) }}</span></span>
            <span><span class="kb-muted">版本：</span>v{{ detail.version }}</span>
            <span><span class="kb-muted">类型：</span>{{ docTypeLabel(detail.docType) }}</span>
            <span><span class="kb-muted">负责人：</span>{{ detail.owner || '官方' }}</span>
            <span><span class="kb-muted">命中：</span>{{ fmtNumber(detail.hitCount) }} 次</span>
            <span><span class="kb-muted">分块：</span>{{ fmtNumber(detail.chunkCount) }} 个</span>
            <span v-if="detail.serviceIds && detail.serviceIds.length"><span class="kb-muted">服务：</span>{{ detail.serviceIds.join(' / ') }}</span>
            <span v-if="detail.tags && detail.tags.length"><span class="kb-muted">标签：</span>{{ detail.tags.join('，') }}</span>
            <span><span class="kb-muted">创建：</span>{{ formatDay(detail.createdAt) }}</span>
            <span><span class="kb-muted">更新：</span>{{ formatDay(detail.updatedAt) }}</span>
          </div>
        </div>
        <div v-if="detail.rawContent" class="kb-detail-block">
          <div class="kb-detail-label">正文内容</div>
          <div class="kb-detail-content">{{ detail.rawContent }}</div>
        </div>
        <div v-if="detail.chunks && detail.chunks.length" class="kb-detail-block">
          <div class="kb-detail-label">分块（{{ detail.chunks.length }}）</div>
          <div v-for="c in detail.chunks" :key="c.id" class="kb-detail-content" style="margin-bottom: 8px; max-height: 140px">
            <div class="kb-doc-meta" style="margin-bottom: 4px">#{{ c.ordinal }}<span v-if="c.section"> · {{ c.section }}</span></div>
            {{ c.content }}
          </div>
        </div>
      </template>
    </el-dialog>

    <!-- 检索命中流水 -->
    <el-dialog v-model="hitsVisible" title="检索命中记录" width="680px" destroy-on-close>
      <el-table :data="hits" size="small" max-height="420">
        <el-table-column prop="query" label="触发问题" min-width="240" show-overflow-tooltip />
        <el-table-column label="来源" width="100">
          <template #default="{ row }">{{ hitSourceLabel(row.hitSource) }}</template>
        </el-table-column>
        <el-table-column prop="channel" label="渠道" width="110" show-overflow-tooltip />
        <el-table-column label="时间" width="160">
          <template #default="{ row }">{{ formatDay(row.createdAt) }}</template>
        </el-table-column>
        <template #empty><el-empty description="暂无命中记录" :image-size="70" /></template>
      </el-table>
    </el-dialog>

    <!-- 更新日志 / 版本 -->
    <el-dialog v-model="versionVisible" title="更新日志 / 版本历史" width="680px" destroy-on-close>
      <el-table :data="versions" size="small" max-height="420">
        <el-table-column label="版本" width="70">
          <template #default="{ row }">v{{ row.version }}</template>
        </el-table-column>
        <el-table-column label="变更原因" width="150">
          <template #default="{ row }">{{ reasonLabel(row.changeReason) }}</template>
        </el-table-column>
        <el-table-column prop="changedBy" label="变更人" width="110" />
        <el-table-column label="时间" width="150">
          <template #default="{ row }">{{ formatDay(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="90" align="right">
          <template #default="{ row }">
            <button v-if="canWrite" class="kb-op-link" @click="doRollback(row)">回滚</button>
          </template>
        </el-table-column>
        <template #empty><el-empty description="暂无版本记录" :image-size="70" /></template>
      </el-table>
    </el-dialog>

    <!-- 编辑文档 -->
    <el-dialog v-model="editVisible" title="编辑文档" width="720px" destroy-on-close>
      <el-alert
        v-if="editForm.reviewStatus === 'APPROVED'"
        type="warning"
        :closable="false"
        show-icon
        style="margin-bottom: 14px"
        title="当前文档已发布：仅修改标题/标签等元数据不会影响线上版本；修改正文会下线当前版本并重新进入审核。"
      />
      <el-form :model="editForm" label-width="90px">
        <el-form-item label="标题" required>
          <el-input v-model="editForm.title" maxlength="255" />
        </el-form-item>
        <el-form-item label="负责人">
          <el-input v-model="editForm.owner" maxlength="64" />
        </el-form-item>
        <el-form-item label="关联服务">
          <el-select
            v-model="editForm.serviceIds" multiple filterable allow-create default-first-option
            placeholder="选择或输入服务名" style="width: 100%"
          >
            <el-option v-for="s in serviceOptions" :key="s" :label="s" :value="s" />
          </el-select>
        </el-form-item>
        <el-form-item label="标签">
          <el-input v-model="editTagsText" placeholder="多个标签用逗号分隔，如：SOP, 数据库" />
        </el-form-item>
        <el-form-item label="正文内容">
          <el-input v-model="editForm.rawContent" type="textarea" :rows="8" placeholder="留空则仅更新元数据；填写后将重新分块向量化" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveEdit">保存</el-button>
      </template>
    </el-dialog>

    <!-- 在线编写 -->
    <el-dialog v-model="onlineVisible" title="在线编写知识文档" width="720px" destroy-on-close>
      <el-form :model="onlineForm" label-width="90px">
        <el-form-item label="标题" required>
          <el-input v-model="onlineForm.title" maxlength="255" placeholder="文档标题" />
        </el-form-item>
        <el-form-item label="正文" required>
          <el-input v-model="onlineForm.content" type="textarea" :rows="10" placeholder="支持 Markdown 文本，保存后进入待审核" />
        </el-form-item>
        <el-form-item label="负责人">
          <el-input v-model="onlineForm.owner" maxlength="64" />
        </el-form-item>
        <el-form-item label="关联服务">
          <el-select
            v-model="onlineForm.serviceIds" multiple filterable allow-create default-first-option
            placeholder="选择或输入服务名" style="width: 100%"
          >
            <el-option v-for="s in serviceOptions" :key="s" :label="s" :value="s" />
          </el-select>
        </el-form-item>
        <el-form-item label="标签">
          <el-input v-model="onlineTagsText" placeholder="多个标签用逗号分隔" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="onlineVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveOnline">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Search, Refresh } from '@element-plus/icons-vue'
import {
  listKnowledgeDocuments, getKnowledgeDocument, listDocumentHits, listDocumentVersions,
  updateKnowledgeDocument, deleteKnowledgeDocument, reviewKnowledgeDocument, submitKnowledgeDocument,
  rollbackKnowledgeDocument, createKnowledgeOnline, reloadKnowledgeBase
} from '@/api/knowledge'
import { listServices } from '@/api/service'
import { useAuthStore } from '@/stores/auth'
import { LAYER_MAP, STATUS_MAP, DOCTYPE_MAP, formatDay, fmtNumber } from './kb-utils'

const props = defineProps({
  tick: { type: Number, default: 0 }
})
const emit = defineEmits(['open-upload'])

const auth = useAuthStore()
const canWrite = computed(() => auth.hasPermission('knowledge:write'))
const canReview = computed(() => auth.hasPermission('knowledge:review'))
// ★ 管理员可重建索引（后端 5 分钟限 3 次）
const canReload = computed(() => auth.hasPermission('knowledge:admin'))

async function handleReload() {
  try {
    await ElMessageBox.confirm(
      '重建将重新索引全部知识文档（含案例），期间检索结果可能短暂不完整。该操作 5 分钟内最多 3 次，确定继续吗？',
      '重建知识库索引',
      { type: 'warning', confirmButtonText: '重建', cancelButtonText: '取消' }
    )
    await reloadKnowledgeBase()
    ElMessage.success('索引重建已触发，正在后台处理')
    load()
  } catch (e) {
    // 用户取消或接口失败
    if (e && e.message) ElMessage.error(e.message)
  }
}

// ---- 筛选与分页 ----
const filters = reactive({ keyword: '', layer: '', trustStatus: '', service: '' })
const pagination = reactive({ page: 1, size: 10, total: 0 })
const rows = ref([])
const loading = ref(false)
const serviceOptions = ref([])

async function loadServiceOptions() {
  try {
    const list = await listServices()
    const set = new Set(['通用'])
    ;(list || []).forEach((s) => s?.name && set.add(s.name))
    serviceOptions.value = Array.from(set).sort()
  } catch {
    serviceOptions.value = ['通用']
  }
}

async function load() {
  loading.value = true
  try {
    const params = {
      keyword: filters.keyword || undefined,
      layer: filters.layer || undefined,
      trustStatus: filters.trustStatus || undefined,
      service: filters.service || undefined,
      page: pagination.page,
      size: pagination.size
    }
    const res = await listKnowledgeDocuments(params)
    rows.value = res.records || []
    pagination.total = Number(res.total || 0)
    collectServices(rows.value)
  } catch (e) {
    ElMessage.error(e.message || '加载文档失败')
  } finally {
    loading.value = false
  }
}

function collectServices(list) {
  const set = new Set(serviceOptions.value)
  list.forEach((r) => (r.serviceIds || []).forEach((s) => s && set.add(s)))
  serviceOptions.value = Array.from(set).sort()
}

function handleSearch() {
  pagination.page = 1
  load()
}
function handleReset() {
  filters.keyword = ''
  filters.layer = ''
  filters.trustStatus = ''
  filters.service = ''
  handleSearch()
}
function handleSizeChange() {
  pagination.page = 1
  load()
}

// ---- 展示映射 ----
function layerLabel(v) { return LAYER_MAP[v]?.label || v || '-' }
function layerCls(v) { return LAYER_MAP[v]?.cls || 'kb-tag-info' }
function statusLabel(v) { return STATUS_MAP[v]?.label || v || '-' }
function statusCls(v) { return STATUS_MAP[v]?.cls || 'kb-tag-info' }
function docTypeLabel(v) { return DOCTYPE_MAP[v] || v || '-' }
function docMeta(row) {
  const parts = [`${docTypeLabel(row.docType)} · v${row.version}`]
  if (row.hitCount != null) parts.push(`命中 ${fmtNumber(row.hitCount)} 次`)
  if (row.layer === 'CASE') parts.push('自动沉淀')
  return parts.join(' · ')
}
function reasonLabel(reason) {
  return {
    ONLINE_CREATE: '在线创建',
    UPDATE: '编辑更新',
    ROLLBACK: '回滚',
    ROLLBACK_BACKUP: '回滚备份'
  }[reason] || reason || '-'
}
function hitSourceLabel(s) {
  return { ASK: '对话诊断', TEST: '检索测试', RETRIEVE: '检索' }[s] || s || '-'
}

// ---- 操作列 ----
function opsFor(row) {
  const status = row.trustStatus
  const reviewStatus = row.reviewStatus
  const isOwner = !!auth.username && row.owner === auth.username
  const isDraft = ['DRAFT', 'REJECTED'].includes(reviewStatus)
  const isPending = ['PENDING_DEPT', 'PENDING_TENANT'].includes(reviewStatus)
  const ops = []
  ops.push({ key: 'view', label: isPending || isDraft ? '预览' : '查看', fn: viewDoc })
  if (status === 'VERIFIED' || row.layer === 'CASE') {
    ops.push({ key: 'hits', label: '检索命中', fn: viewHits })
  }
  ops.push({ key: 'versions', label: '更新日志', fn: viewVersions })
  // 作者提交审核；审核人不能是作者，审核入口只给有 review 权限且非作者的人
  if (isDraft && canWrite.value && isOwner) {
    ops.push({ key: 'submit', label: '提交审核', fn: submitDoc })
  }
  if (isPending && canReview.value && !isOwner) {
    ops.push({ key: 'approve', label: '通过', fn: approveDoc })
    ops.push({ key: 'reject', label: '驳回', danger: true, fn: rejectDoc })
  }
  const canEditDoc = canWrite.value && (isOwner || auth.hasPermission('knowledge:admin'))
  if (canEditDoc && row.layer !== 'CASE') {
    ops.push({ key: 'edit', label: '编辑', fn: openEdit })
    ops.push({ key: 'delete', label: '删除', danger: true, fn: deleteDoc })
  }
  return ops
}

async function runOp(op, row) {
  if (op.fn) await op.fn(row)
}

async function viewDoc(row) {
  try {
    const res = await getKnowledgeDocument(row.id)
    detail.value = res
    detailVisible.value = true
  } catch (e) {
    ElMessage.error(e.message || '加载详情失败')
  }
}
async function viewHits(row) {
  try {
    const res = await listDocumentHits(row.id, { page: 1, size: 20 })
    hits.value = res.records || []
    hitsVisible.value = true
  } catch (e) {
    ElMessage.error(e.message || '加载命中记录失败')
  }
}
async function viewVersions(row) {
  try {
    const res = await listDocumentVersions(row.id)
    versions.value = res || []
    versionDoc.value = row
    versionVisible.value = true
  } catch (e) {
    ElMessage.error(e.message || '加载版本历史失败')
  }
}
async function submitDoc(row) {
  try {
    await submitKnowledgeDocument(row.id)
    ElMessage.success('已提交审核')
    load()
    window.dispatchEvent(new CustomEvent('knowledge-review-updated'))
  } catch (e) {
    ElMessage.error(e.message || '提交审核失败')
  }
}
async function approveDoc(row) {
  await reviewDoc(row, true, '通过')
}
async function rejectDoc(row) {
  let comment = ''
  try {
    const res = await ElMessageBox.prompt('请填写驳回原因', '驳回文档', {
      confirmButtonText: '驳回',
      cancelButtonText: '取消',
      inputType: 'textarea',
      inputValidator: (value) => (value && value.trim() ? true : '请填写驳回原因')
    })
    comment = res.value.trim()
  } catch (_) {
    return
  }
  await reviewDoc(row, false, comment)
}
async function reviewDoc(row, approved, comment) {
  try {
    const level = row.reviewStatus === 'PENDING_TENANT' ? 'TENANT' : 'DEPT'
    await reviewKnowledgeDocument(row.id, { level, approved, comment })
    ElMessage.success(approved ? '已通过审核' : '已驳回')
    load()
    window.dispatchEvent(new CustomEvent('knowledge-review-updated'))
  } catch (e) {
    ElMessage.error(e.message || '操作失败')
  }
}
async function deleteDoc(row) {
  try {
    await ElMessageBox.confirm(
      row.reviewStatus === 'APPROVED'
        ? `文档「${row.title}」已发布，删除后会立即下线并清除向量索引，不可恢复。确认删除？`
        : `删除文档「${row.title}」将连带清除向量索引，不可恢复。确认删除？`,
      '删除确认',
      { type: 'warning', confirmButtonText: '删除', confirmButtonClass: 'el-button--danger' }
    )
  } catch (_) {
    return // 用户取消
  }
  try {
    await deleteKnowledgeDocument(row.id)
    ElMessage.success('已删除')
    load()
  } catch (e) {
    ElMessage.error(e.message || '删除失败')
  }
}
async function doRollback(version) {
  if (!versionDoc.value) return
  try {
    await ElMessageBox.confirm(
      `回滚到 v${version.version}？当前版本将生成备份快照。`,
      '回滚确认',
      { type: 'warning', confirmButtonText: '回滚' }
    )
  } catch (_) {
    return
  }
  try {
    await rollbackKnowledgeDocument(versionDoc.value.id, version.id)
    ElMessage.success('已回滚')
    versionVisible.value = false
    load()
  } catch (e) {
    ElMessage.error(e.message || '回滚失败')
  }
}

// ---- 编辑 ----
const editVisible = ref(false)
const saving = ref(false)
const editForm = reactive({
  id: null, title: '', owner: '', serviceIds: [], rawContent: '',
  reviewStatus: '', originalRawContent: ''
})
const editTagsText = ref('')

async function openEdit(row) {
  editForm.id = row.id
  editForm.title = row.title
  editForm.owner = row.owner || ''
  editForm.serviceIds = [...(row.serviceIds || [])]
  editForm.rawContent = ''
  editTagsText.value = (row.tags || []).join(', ')
  try {
    const detail = await getKnowledgeDocument(row.id)
    editForm.title = detail.title || editForm.title
    editForm.owner = detail.owner || editForm.owner
    editForm.serviceIds = [...(detail.serviceIds || editForm.serviceIds)]
    editForm.rawContent = detail.rawContent || ''
    editForm.originalRawContent = editForm.rawContent
    editForm.reviewStatus = detail.reviewStatus || ''
    editTagsText.value = (detail.tags || []).join(', ')
  } catch (e) {
    ElMessage.error(e.message || '加载文档内容失败')
    return
  }
  editVisible.value = true
}
async function saveEdit() {
  if (!editForm.title.trim()) return ElMessage.warning('标题不能为空')
  const contentChanged = editForm.rawContent !== editForm.originalRawContent
  if (editForm.reviewStatus === 'APPROVED' && contentChanged) {
    try {
      await ElMessageBox.confirm(
        '修改正文会立即下线当前已发布版本，并重新进入审核流程。是否继续？',
        '修改已发布文档',
        { type: 'warning', confirmButtonText: '继续修改', cancelButtonText: '取消' }
      )
    } catch (_) {
      return
    }
  }
  saving.value = true
  try {
    await updateKnowledgeDocument(editForm.id, {
      title: editForm.title,
      owner: editForm.owner,
      serviceIds: editForm.serviceIds,
      tags: splitTags(editTagsText.value),
      rawContent: editForm.rawContent || undefined
    })
    ElMessage.success('已保存')
    editVisible.value = false
    load()
  } catch (e) {
    ElMessage.error(e.message || '保存失败')
  } finally {
    saving.value = false
  }
}

// ---- 在线编写 ----
const onlineVisible = ref(false)
const onlineForm = reactive({ title: '', content: '', owner: '', serviceIds: [] })
const onlineTagsText = ref('')
async function saveOnline() {
  if (!onlineForm.title.trim()) return ElMessage.warning('标题不能为空')
  if (!onlineForm.content.trim()) return ElMessage.warning('正文不能为空')
  saving.value = true
  try {
    await createKnowledgeOnline({
      title: onlineForm.title,
      content: onlineForm.content,
      owner: onlineForm.owner,
      serviceIds: onlineForm.serviceIds,
      tags: splitTags(onlineTagsText.value)
    })
    ElMessage.success('已保存，等待审核')
    onlineVisible.value = false
    onlineForm.title = ''
    onlineForm.content = ''
    onlineForm.owner = ''
    onlineForm.serviceIds = []
    onlineTagsText.value = ''
    load()
  } catch (e) {
    ElMessage.error(e.message || '保存失败')
  } finally {
    saving.value = false
  }
}

function splitTags(text) {
  return text.split(/[,，]/).map((s) => s.trim()).filter(Boolean)
}

// ---- 弹窗状态 ----
const detail = ref(null)
const detailVisible = ref(false)
const hits = ref([])
const hitsVisible = ref(false)
const versions = ref([])
const versionDoc = ref(null)
const versionVisible = ref(false)

onMounted(() => {
  load()
  loadServiceOptions()
})
watch(() => props.tick, () => load())
</script>

<style scoped>
.kb-pager {
  display: flex;
  justify-content: flex-end;
  padding: 14px 18px;
  border-top: 1px solid var(--border-light);
}
</style>
