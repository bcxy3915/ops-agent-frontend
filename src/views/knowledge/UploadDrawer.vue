<template>
  <el-drawer
    :model-value="modelValue"
    title="上传知识 · 引导式"
    :size="720"
    direction="rtl"
    destroy-on-close
    class="kb-upload-drawer"
    @close="resetAll"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <!-- 步骤条 -->
    <div class="kb-steps">
      <div v-for="(s, i) in steps" :key="s" class="kb-step" :class="{ done: i + 1 < step, active: i + 1 === step }">
        <span class="kb-step-num">{{ i + 1 }}</span>{{ s }}
      </div>
      <template v-if="step < 4"><span class="kb-step-line" :class="{ done: step >= 2 }"></span></template>
    </div>

    <!-- step1 上传文件 -->
    <div class="kb-up-pane" :class="{ hidden: step !== 1 }">
      <div class="kb-dropzone" @click="pickFiles">
        <div class="kb-dz-ico"><el-icon><UploadFilled /></el-icon></div>
        <div style="font-weight: 600">点击或拖拽文件到此处</div>
        <div class="kb-muted" style="font-size: 12.5px; margin-top: 4px">支持 PDF / Word / Markdown / TXT，单文件 ≤ 20MB，单次最多 10 个</div>
        <input
          ref="fileInput" type="file" multiple style="display: none"
          accept=".md,.markdown,.txt,.docx,.pdf"
          @change="onFileChange"
        />
      </div>

      <div v-for="f in files" :key="f.id" class="kb-file-row">
        <el-icon style="color: var(--primary); font-size: 20px"><Document /></el-icon>
        <div class="kb-f-main">
          <div class="kb-f-name">{{ f.name }}</div>
          <div class="kb-todo-sub">{{ fileSize(f.file.size) }}<template v-if="f.content !== null"> · 解析成功</template><template v-else> · 发布时由后端解析</template></div>
        </div>
        <span class="kb-tag" :class="f.content !== null ? 'kb-tag-success' : 'kb-tag-info'">{{ f.content !== null ? '可解析' : '待后端解析' }}</span>
        <el-icon class="kb-remove" @click="removeFile(f)"><Close /></el-icon>
      </div>

      <div class="kb-alert kb-alert-info" style="margin-top: 14px">
        <el-icon class="kb-alert-icon"><InfoFilled /></el-icon>
        <span>文件上传后进入引导式流程：质量检查（冲突 / 脱敏）→ 分类信息 → 确认发布。企业私有文档默认层级，发布后自动参与诊断检索。</span>
      </div>
    </div>

    <!-- step2 质量检查 -->
    <div class="kb-up-pane" :class="{ hidden: step !== 2 }">
      <div v-loading="checking" style="min-height: 120px">
        <template v-if="!checking">
          <template v-if="quality">
            <!-- 冲突 -->
            <div v-if="quality.conflicts && quality.conflicts.length" class="kb-conflict-box">
              <div class="kb-conflict-hd">
                <el-icon><WarningFilled /></el-icon> 检测到 {{ quality.conflicts.length }} 处与现有知识冲突，需裁定后才能发布
              </div>
              <div class="kb-conflict-bd">
                <div v-for="(c, i) in quality.conflicts" :key="i" style="font-size: 13px">
                  <b>{{ c.matchedTitle }}</b><span class="kb-muted">（相似度 {{ c.similarity?.toFixed(2) || '-' }}）</span>
                  <div class="kb-seg" style="margin: 6px 0 10px">
                    <button :class="{ on: decision === 'KEEP_NEW' }" @click="decision = 'KEEP_NEW'">以新文档为准</button>
                    <button :class="{ on: decision === 'KEEP_OLD' }" @click="decision = 'KEEP_OLD'">保留原值</button>
                    <button :class="{ on: decision === 'MANUAL' }" @click="decision = 'MANUAL'">标记人工裁定</button>
                  </div>
                </div>
              </div>
            </div>

            <!-- 脱敏 -->
            <div v-if="sensitiveCount > 0" class="kb-alert kb-alert-warning" style="margin-bottom: 10px">
              <el-icon class="kb-alert-icon"><Warning /></el-icon>
              <span>文档中含 {{ sensitiveCount }} 个敏感信息项，将在入库时自动脱敏（见下方明细）。</span>
            </div>
            <div v-if="sensitiveItems.length" style="margin-bottom: 10px">
              <span v-for="(s, i) in sensitiveItems" :key="i" class="kb-mask-tag" style="margin-right: 6px">{{ s.type }} · {{ s.raw }} → {{ s.masked }}</span>
            </div>

            <!-- 过时文档提醒 -->
            <div v-if="quality.staleDocs && quality.staleDocs.length" class="kb-alert kb-alert-warning" style="margin-bottom: 10px">
              <el-icon class="kb-alert-icon"><Warning /></el-icon>
              <span>检测到 {{ quality.staleDocs.length }} 篇同主题文档已过复核期（{{ quality.staleDocs.map((s) => s.title).join('、') }}），建议一并更新。</span>
            </div>

            <div class="kb-alert kb-alert-info">
              <el-icon class="kb-alert-icon"><InfoFilled /></el-icon>
              <span>文档未标注生效日期，建议在下一步填写（超期未复核会自动提醒，避免失效知识误导诊断）。</span>
            </div>
          </template>
          <div v-else class="kb-empty" style="padding: 40px 0">
            文档将交由后端在上传发布时解析质检；如为 Markdown / TXT，可在本页预览冲突与脱敏。
          </div>
        </template>
      </div>
    </div>

    <!-- step3 分类信息 -->
    <div class="kb-up-pane" :class="{ hidden: step !== 3 }">
      <div class="kb-form-row">
        <label>内容类型 <span class="kb-req">*</span></label>
        <div class="kb-radio-cards">
          <div
            v-for="t in typeOptions" :key="t.value"
            class="kb-rc" :class="{ on: form.type === t.value }"
            @click="form.type = t.value"
          >
            <b>{{ t.label }}</b><span>{{ t.desc }}</span>
          </div>
        </div>
      </div>
      <div class="kb-form-row">
        <label>关联服务</label>
        <el-select v-model="form.serviceIds" multiple filterable allow-create default-first-option style="width: 100%" placeholder="选择或输入服务名，可多选">
          <el-option v-for="s in serviceOptions" :key="s" :label="s" :value="s" />
        </el-select>
      </div>
      <div class="kb-form-row">
        <label>标签</label>
        <el-input v-model="tagsText" placeholder="多个标签用逗号分隔，如：连接池, 应急预案, 数据库" />
      </div>
      <div class="kb-form-row">
        <label>负责人</label>
        <el-input v-model="form.owner" :placeholder="auth.username || '填写负责人'" maxlength="64" />
      </div>
      <div class="kb-form-row">
        <label>生效 / 复核日期</label>
        <el-date-picker v-model="form.reviewDate" type="date" style="width: 100%" value-format="YYYY-MM-DD" placeholder="建议填写生效日期" />
      </div>
      <div class="kb-form-row">
        <label>发布方式</label>
        <div class="kb-seg">
          <button :class="{ on: form.publishMode === 'review' }" @click="form.publishMode = 'review'">提交审核</button>
          <button v-if="canDirectPublish" :class="{ on: form.publishMode === 'direct' }" @click="form.publishMode = 'direct'">直接发布（管理员）</button>
        </div>
      </div>
    </div>

    <!-- step4 确认发布 -->
    <div class="kb-up-pane" :class="{ hidden: step !== 4 }">
      <div class="kb-alert kb-alert-success" style="margin-bottom: 16px">
        <el-icon class="kb-alert-icon"><CircleCheckFilled /></el-icon>
        <span>{{ files.length }} 个文件已准备就绪，发布后进入后台入库，完成后参与诊断检索（{{ form.publishMode === 'direct' ? '直接发布，无需审核' : '提交审核，通过后入库' }}）。</span>
      </div>
      <div class="kb-card" style="overflow: hidden">
        <div class="kb-card-bd">
          <div v-for="f in files" :key="f.id" class="kb-summary-grid" style="margin-bottom: 12px">
            <span class="muted">文档名称</span><b>{{ f.name }}</b>
            <span class="muted">层级</span><span class="kb-tag kb-tag-teal">企业私有</span>
            <span class="muted">类型 / 服务</span><span>{{ typeLabel(form.type) }}{{ form.serviceIds.length ? ' · ' + form.serviceIds.join('、') : ' · 通用' }}</span>
            <span class="muted">冲突裁定</span>
            <span v-if="hasConflict" class="kb-tag" :class="decision === 'KEEP_OLD' ? 'kb-tag-info' : 'kb-tag-success'">{{ decisionLabel(decision) }}</span>
            <span v-else class="kb-tag kb-tag-success">无冲突</span>
            <span class="muted">脱敏</span><span>{{ sensitiveCount > 0 ? sensitiveCount + ' 个敏感信息项将脱敏' : '未检测到敏感信息' }}</span>
            <span class="muted">状态</span><span class="kb-tag" :class="form.publishMode === 'direct' ? 'kb-tag-success' : 'kb-tag-warning'">{{ form.publishMode === 'direct' ? '将直接发布并入库' : '待审核' }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 底部操作 -->
    <template #footer>
      <div style="display: flex; justify-content: flex-end; gap: 10px">
        <el-button :disabled="step === 1" @click="stepBack">上一步</el-button>
        <el-button type="primary" :loading="publishing" @click="stepNext">
          {{ step === 4 ? '确认发布' : step === 3 ? '去确认' : '下一步' }}
        </el-button>
      </div>
    </template>
  </el-drawer>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import {
  UploadFilled, Document, Close, InfoFilled, Warning, WarningFilled, CircleCheckFilled
} from '@element-plus/icons-vue'
import { checkKnowledgeQuality, uploadKnowledgeDocument, publishDirectKnowledgeDocument, submitKnowledgeDocument } from '@/api/knowledge'
import { listServices } from '@/api/service'
import { useAuthStore } from '@/stores/auth'

const props = defineProps({
  modelValue: { type: Boolean, default: false }
})
const emit = defineEmits(['update:modelValue', 'published'])

const auth = useAuthStore()
const fileInput = ref(null)
const canDirectPublish = computed(() =>
  auth.hasPermission('knowledge:publish')
  || auth.hasPermission('knowledge:admin')
)

const steps = ['上传文件', '质量检查', '分类信息', '确认发布']
const step = ref(1)

const typeOptions = [
  { value: '运维手册/SOP', label: '运维手册/SOP', desc: '排查步骤、操作规范' },
  { value: '应急预案', label: '应急预案', desc: '故障处置、降级方案' },
  { value: '服务/指标字典', label: '服务/指标字典', desc: '服务清单、阈值定义' }
]
const serviceOptions = ref([])
onMounted(async () => {
  try {
    const list = await listServices()
    const set = new Set(['通用'])
    ;(list || []).forEach((s) => s?.name && set.add(s.name))
    serviceOptions.value = Array.from(set).sort()
  } catch {
    serviceOptions.value = ['通用']
  }
})

const files = ref([])
let fileSeq = 0

const form = reactive({
  type: '运维手册/SOP',
  serviceIds: [],
  owner: '',
  reviewDate: '',
  publishMode: 'review'
})
const tagsText = ref('')
const decision = ref('KEEP_NEW')

const quality = ref(null)
const checking = ref(false)
const publishing = ref(false)

const sensitiveItems = computed(() => quality.value?.maskedPreview?.sensitiveItems || [])
const sensitiveCount = computed(() => sensitiveItems.value.length)
const hasConflict = computed(() => (quality.value?.conflicts || []).length > 0)

function typeLabel(v) { return typeOptions.find((t) => t.value === v)?.label || v || '通用' }
function decisionLabel(v) {
  return { KEEP_NEW: '以新文档为准', KEEP_OLD: '保留原值', MANUAL: '标记人工裁定' }[v] || v
}
function fileSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(1) + ' MB'
}

function pickFiles() {
  fileInput.value?.click?.()
}

function onFileChange(e) {
  const input = e.target
  const picked = Array.from(input.files || [])
  input.value = ''
  if (!picked.length) return
  const remain = 10 - files.value.length
  if (picked.length > remain) {
    ElMessage.warning(`单次最多 10 个文件，已超出 ${picked.length - remain} 个`)
  }
  picked.slice(0, remain).forEach((file) => {
    const id = ++fileSeq
    const item = reactive({ id, file, name: file.name, content: null })
    files.value.push(item)
    if (file.size > 20 * 1024 * 1024) {
      ElMessage.warning(`${file.name} 超过 20MB，将被跳过`)
      files.value = files.value.filter((f) => f.id !== id)
      return
    }
    if (/\.(md|markdown|txt)$/i.test(file.name)) {
      readText(file, item)
    }
    // docx/pdf 标记为待后端解析
  })
}

function readText(file, item) {
  const reader = new FileReader()
  reader.onload = () => { item.content = String(reader.result || '') }
  reader.onerror = () => { item.content = null }
  reader.readAsText(file)
}

function removeFile(f) {
  files.value = files.value.filter((x) => x.id !== f.id)
}

function docTypeOf(name) {
  if (/\.(md|markdown)$/i.test(name)) return 'MARKDOWN'
  if (/\.txt$/i.test(name)) return 'TEXT'
  if (/\.docx$/i.test(name)) return 'DOCX'
  if (/\.pdf$/i.test(name)) return 'PDF'
  return 'MARKDOWN'
}

/** step2 质检：对所有可读文件逐个调用质检接口并合并展示 */
async function doQualityCheck() {
  const readable = files.value.filter((f) => f.content !== null)
  if (!readable.length) {
    quality.value = null
    return
  }
  checking.value = true
  try {
    const results = await Promise.all(
      readable.map((f) =>
        checkKnowledgeQuality({
          title: f.name,
          content: f.content,
          docType: docTypeOf(f.name)
        }).catch(() => null)
      )
    )
    const ok = results.filter(Boolean)
    if (!ok.length) {
      quality.value = null
      return
    }
    const conflicts = []
    const staleDocs = []
    const sensitiveItemsList = []
    ok.forEach((r) => {
      if (r.conflicts) conflicts.push(...r.conflicts)
      if (r.staleDocs) staleDocs.push(...r.staleDocs)
      if (r.maskedPreview?.sensitiveItems) sensitiveItemsList.push(...r.maskedPreview.sensitiveItems)
    })
    quality.value = { conflicts, staleDocs, maskedPreview: { sensitiveItems: sensitiveItemsList } }
  } finally {
    checking.value = false
  }
}

function stepBack() {
  if (step.value > 1) step.value -= 1
}
async function stepNext() {
  if (step.value === 1) {
    if (!files.value.length) {
      ElMessage.warning('请先选择要上传的文件')
      return
    }
    step.value = 2
    doQualityCheck()
  } else if (step.value === 2) {
    step.value = 3
  } else if (step.value === 3) {
    step.value = 4
  } else {
    await publish()
  }
}

/** step4 确认发布：逐个上传；选择直接发布时上传成功后自动审核通过 */
async function publish() {
  if (!files.value.length) return
  if (form.publishMode === 'direct' && !canDirectPublish.value) {
    form.publishMode = 'review'
  }
  publishing.value = true
  try {
    const tags = tagsText.value.split(/[,，]/).map((s) => s.trim()).filter(Boolean)
    if (form.type) tags.unshift(form.type)
    const serviceIds = form.serviceIds.join(',')

    let publishedCount = 0
    let failedCount = 0
    let firstError = ''
    for (const f of files.value) {
      const fd = new FormData()
      fd.append('file', f.file)
      fd.append('title', f.name)
      fd.append('layer', 'PRIVATE')
      fd.append('owner', form.owner)
      if (serviceIds) fd.append('serviceIds', serviceIds)
      if (tags.length) fd.append('tags', tags.join(','))
      const res = await uploadKnowledgeDocument(fd)
      publishedCount += 1
      if (form.publishMode === 'review') {
        await submitKnowledgeDocument(res.id)
      } else {
        try {
          // 直接发布：跳过审核，后端置 APPROVED + BUILDING 并异步入库
          await publishDirectKnowledgeDocument(res.id)
        } catch (err) {
          // 失败不阻断其余文件：文档保留为草稿，提示具体原因供用户重试
          failedCount += 1
          if (!firstError) firstError = err?.message || '未知原因'
        }
      }
    }
    if (form.publishMode === 'review') {
      ElMessage.success(`已上传 ${publishedCount} 个文档，等待审核`)
    } else if (failedCount > 0) {
      ElMessage.warning(`已上传 ${publishedCount} 个文档，其中 ${failedCount} 个直接发布失败：${firstError}。文档保留为待审核，可在文档列表提交审核`)
    } else {
      ElMessage.success(`已上传 ${publishedCount} 个文档，正在后台入库，进度请查看知识库文档列表`)
    }
    window.dispatchEvent(new CustomEvent('knowledge-review-updated'))
    emit('published')
    emit('update:modelValue', false)
    resetAll()
  } catch (e) {
    ElMessage.error(e.message || '发布失败')
  } finally {
    publishing.value = false
  }
}

function resetAll() {
  step.value = 1
  files.value = []
  quality.value = null
  form.type = '运维手册/SOP'
  form.serviceIds = []
  form.owner = ''
  form.reviewDate = ''
  form.publishMode = 'review'
  tagsText.value = ''
  decision.value = 'KEEP_NEW'
}
</script>

<style scoped>
.kb-remove {
  cursor: pointer;
  color: var(--text-muted);
  font-size: 16px;
}
.kb-remove:hover { color: var(--danger); }
</style>
