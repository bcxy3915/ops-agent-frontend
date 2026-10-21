<template>
  <div class="page">
    <div class="page-body">
      <!-- 返回 -->
      <div class="back-link" @click="$router.push('/admin/alerts')">
        <el-icon><ArrowLeft /></el-icon>
        返回告警中心
      </div>

      <el-skeleton v-if="loading" :rows="8" animated />

      <template v-else-if="event">
        <!-- ========== 告警头 ========== -->
        <div class="kb-card" style="margin-bottom: 16px">
          <div class="al-head">
            <div class="al-head-main">
              <h3 class="al-head-title">
                {{ event.ruleName || event.metric }}
                <el-tag size="small" :type="statusTagType(event.status)">{{ statusLabel(event.status) }}</el-tag>
                <el-tooltip v-if="event.escalationLevel > 0"
                  :content="`已升级至 L${event.escalationLevel}（${fmtTime(event.escalatedAt)}）`" placement="top">
                  <span class="al-escalated">已升级</span>
                </el-tooltip>
                <el-tag v-if="diag" size="small" type="success" effect="light">AI 已诊断</el-tag>
              </h3>
              <div class="al-head-meta">
                <span>规则：{{ event.ruleName || '-' }}</span>
                <span>服务：{{ event.service }}</span>
                <span>告警 #{{ event.id }}</span>
                <span>触发 {{ fmtTime(event.firedAt) }}</span>
              </div>
              <!-- ★ 规格 3.3：认领人展示（蓝 @username / 灰 未认领） -->
              <div class="al-head-owner">
                <span v-if="event.acknowledgedBy" class="al-owner-tag">处置人 @{{ event.acknowledgedBy }}</span>
                <span v-else class="al-owner-tag none">未认领</span>
                <span v-if="event.acknowledgedAt" class="al-owner-time">{{ fmtTime(event.acknowledgedAt) }} 认领</span>
              </div>
            </div>
            <div class="al-head-actions">
              <!-- ★ 规格 2.2：按钮按状态动态渲染 -->
              <template v-if="canWrite">
                <!-- 独立认领 / 接管（规格 3.2 / 3.4） -->
                <el-button v-if="!event.acknowledgedBy && ['FIRING', 'SILENCED'].includes(event.status)" type="primary" plain
                  @click="handleClaim">认领</el-button>
                <el-button v-if="event.acknowledgedBy && event.acknowledgedBy !== auth.username && event.status !== 'RESOLVED'"
                  type="primary" plain @click="handleTakeover">接管</el-button>
                <!-- FIRING / SILENCED：确认告警（无二次确认，自动认领，规格 2.3） -->
                <el-button v-if="['FIRING', 'SILENCED'].includes(event.status)" type="primary"
                  @click="handleAck">确认告警</el-button>
                <!-- ACK / SILENCED：标记恢复（规格 2.4） -->
                <el-button v-if="['ACKNOWLEDGED', 'SILENCED'].includes(event.status)" type="success"
                  @click="openResolve">标记恢复</el-button>
                <!-- FIRING / ACK：静默（规格 2.5） -->
                <el-button v-if="['FIRING', 'ACKNOWLEDGED'].includes(event.status)"
                  @click="openSilence">静默告警</el-button>
                <!-- SILENCED：解除静默（规格 2.2） -->
                <el-button v-if="event.status === 'SILENCED'" type="warning"
                  @click="handleUnsilence">解除静默</el-button>
              </template>
              <!-- ★ 规格 1.6：打开详情不自动已读，提供手动标记已读 -->
              <el-button v-if="event.read === false" type="info" plain @click="handleMarkRead">标记已读</el-button>
              <el-button type="primary" plain @click="goChat">带上下文去对话追问</el-button>
            </div>
          </div>

          <!-- 链路 -->
          <div class="al-flow">
            <div class="al-flow-node active"><span class="al-flow-dot">✓</span>告警</div>
            <span class="al-flow-line"></span>
            <div class="al-flow-node" :class="{ active: snapshot }"><span class="al-flow-dot">✓</span>快照</div>
            <span class="al-flow-line"></span>
            <div class="al-flow-node" :class="{ active: diag }"><span class="al-flow-dot">✓</span>诊断</div>
            <span class="al-flow-line"></span>
            <div class="al-flow-node" :class="{ active: isAcked }"><span class="al-flow-dot">✓</span>处置</div>
            <span class="al-flow-line"></span>
            <div class="al-flow-node" :class="{ active: event.status === 'RESOLVED' }">
              <span class="al-flow-dot">…</span>恢复 / 沉淀
            </div>
          </div>

          <div class="al-kvgrid">
            <div class="al-kv"><div class="k">指标</div><div class="v">{{ event.metric }}</div></div>
            <div class="al-kv"><div class="k">阈值</div><div class="v">{{ event.operator }} {{ event.threshold }}</div></div>
            <div class="al-kv"><div class="k">当前值</div><div class="v" :class="{ bad: event.status === 'FIRING' }">{{ event.currentValue }}</div></div>
            <div class="al-kv"><div class="k">状态</div><div class="v">{{ statusLabel(event.status) }}</div></div>
            <div class="al-kv"><div class="k">处置人（认领）</div>
              <div class="v">{{ event.acknowledgedBy || '待认领' }}</div>
            </div>
            <div class="al-kv"><div class="k">静默到期</div>
              <div class="v">{{ event.silencedUntil ? fmtTime(event.silencedUntil) : '-' }}</div>
            </div>
            <div class="al-kv"><div class="k">升级级别</div>
              <div class="v">{{ event.escalationLevel > 0 ? 'L' + event.escalationLevel + (event.escalatedAt ? ' · ' + fmtTime(event.escalatedAt) : '') : '未升级' }}</div>
            </div>
            <div class="al-kv"><div class="k">恢复时间</div>
              <div class="v">{{ event.resolvedAt ? fmtTime(event.resolvedAt) : '-' }}</div>
            </div>
          </div>
        </div>

        <div class="detail-grid">
          <!-- ========== 左列：AI 诊断 + 快照 ========== -->
          <div>
            <!-- AI 诊断 -->
            <div class="kb-card" style="margin-bottom: 16px">
              <div class="al-card-hd">
                <div class="al-card-title">
                  <el-icon color="var(--teal)"><Cpu /></el-icon>
                  AI 智能诊断
                </div>
                <span v-if="diag" class="al-conf-tag" :class="confCls(diag.confidence)">置信度 {{ diag.confidence || 0 }}%</span>
              </div>
              <div class="al-card-bd">
                <div v-if="diag">
                  <div class="al-diag-headline">
                    <div class="al-score-ring" :style="{ '--pct': diag.confidence || 0, '--ring': confColor(diag.confidence) }">
                      <span>{{ diag.confidence || 0 }}%</span>
                    </div>
                    <div class="al-diag-note">AI 结合指标快照、知识库手册与历史案例推断，根因建议人工确认后再执行处置。</div>
                  </div>

                  <div class="al-block">
                    <div class="al-lab">推断根因</div>
                    <div class="al-text">{{ diag.rootCause || '暂无根因结论' }}</div>
                  </div>
                  <div v-if="diag.evidence && diag.evidence.length" class="al-block">
                    <div class="al-lab">证据</div>
                    <ul class="al-list">
                      <li v-for="(e, i) in diag.evidence" :key="i">{{ e }}</li>
                    </ul>
                  </div>
                  <div v-if="diag.suggestions && diag.suggestions.length" class="al-block">
                    <div class="al-lab">建议处置</div>
                    <ol class="al-list">
                      <li v-for="(s, i) in diag.suggestions" :key="i">{{ s }}</li>
                    </ol>
                  </div>

                  <!-- P1 规格 4：来源溯源（参考知识 / 历史案例） -->
                  <div class="al-block">
                    <div class="al-lab">
                      参考知识
                      <span v-if="diag.references && diag.references.length" class="al-ref-count">{{ diag.references.length }} 条</span>
                    </div>
                    <div v-if="diag.references && diag.references.length" class="al-refs">
                      <div v-for="(r, i) in diag.references" :key="i" class="al-ref-item">
                        <div class="al-ref-top">
                          <span class="al-ref-type" :class="refTypeCls(r.refType)">{{ refTypeLabel(r.refType) }}</span>
                          <span class="al-ref-title">{{ r.title }}</span>
                          <span v-if="r.section" class="al-ref-section">#{{ r.section }}</span>
                          <span class="al-ref-score">{{ refScore(r.score) }}</span>
                        </div>
                        <div v-if="r.snippet" class="al-ref-snippet">{{ r.snippet }}</div>
                        <div class="al-ref-meta">
                          <span v-if="r.layer">层级：{{ layerLabel(r.layer) }}</span>
                          <span v-if="r.version">版本：{{ r.version }}</span>
                          <span v-if="r.author">作者：{{ r.author }}</span>
                          <span v-if="r.refType === 'CASE' && r.citedCount != null">被引用 {{ r.citedCount }} 次</span>
                        </div>
                      </div>
                    </div>
                    <div v-else class="al-ref-empty">
                      <el-icon><WarningFilled /></el-icon>
                      <span>知识缺口：本次诊断未命中知识库文档或历史案例，可在知识库补充运维文档后重新诊断。</span>
                    </div>
                  </div>
                  <div v-if="diag.errorMessage" class="al-err">{{ diag.errorMessage }}</div>

                  <div class="al-tip">
                    <el-icon><InfoFilled /></el-icon>
                    诊断摘要与建议由 LLM 结合实时快照与知识库生成，关键结论可溯源，处置前请结合现场确认。
                  </div>

                  <!-- P1 规格 3.1：内嵌追问区 -->
                  <div class="al-followup">
                    <div class="al-lab">继续追问 AI</div>
                    <div v-if="followUps.length" class="al-followup-list">
                      <div v-for="(fu, i) in followUps" :key="i" class="al-fu-item">
                        <div class="al-fu-q">Q：{{ fu.question }}</div>
                        <div v-if="fu.answer" class="al-fu-a">{{ fu.answer }}</div>
                        <div v-if="fu.errorMessage" class="al-fu-err">{{ fu.errorMessage }}</div>
                      </div>
                    </div>
                    <div class="al-followup-input">
                      <el-input v-model="followQuestion" type="textarea" :rows="2" maxlength="500"
                        placeholder="例如：结合快照里活跃线程打满的现象，进一步分析扩容后还有哪些风险？" />
                      <div class="al-followup-actions">
                        <span class="al-followup-hint">追问基于当前诊断与快照上下文</span>
                        <el-button type="primary" :loading="followLoading" @click="handleFollowUp">追问</el-button>
                      </div>
                    </div>
                  </div>
                  <div class="al-card-actions">
                    <el-button type="primary" plain @click="goChat">带着上下文去对话</el-button>
                    <el-button v-if="canWrite && ['FIRING', 'SILENCED'].includes(event.status)" type="primary"
                      @click="handleAck">采纳并确认告警</el-button>
                  </div>
                </div>
                <el-empty v-else description="暂无 AI 诊断" :image-size="80">
                  <el-button v-if="canWrite && snapshot" :loading="diagLoading" @click="handleTriggerDiag">基于快照触发诊断</el-button>
                </el-empty>
              </div>
            </div>

            <!-- 故障快照 -->
            <div class="kb-card">
              <div class="al-card-hd">
                <div class="al-card-title">
                  <el-icon color="var(--primary)"><Camera /></el-icon>
                  故障快照（告警瞬间现场）
                </div>
                <span v-if="snapshot" class="al-muted">采集于 {{ fmtTime(snapshot.createdAt) }} · snapshot #{{ snapshot.id }}</span>
              </div>
              <div class="al-card-bd">
                <div v-if="snapshotData" class="al-snap-grid">
                  <div v-for="(val, key) in snapshotData" :key="key" class="al-snap-item">
                    <div class="k">{{ key }}</div>
                    <div class="v">{{ displayValue(val) }}</div>
                  </div>
                </div>
                <el-empty v-else-if="!snapshot" description="暂无故障快照" :image-size="70" />
                <details v-if="snapshotData" class="al-snap-json">
                  <summary>查看快照原始 JSON</summary>
                  <pre>{{ snapshotJson }}</pre>
                </details>
              </div>
            </div>
          </div>

          <!-- ========== 右列：通知 + 处置时间线 + 沉淀 ========== -->
          <div>
            <!-- 通知记录 -->
            <div class="kb-card" style="margin-bottom: 16px">
              <div class="al-card-hd">
                <div class="al-card-title">通知记录</div>
                <el-button link type="primary" @click="$router.push('/admin/channels')">渠道配置</el-button>
              </div>
              <div class="al-card-bd">
                <div v-if="records.length" class="al-timeline">
                  <div v-for="r in records" :key="r.id" class="al-tl-item">
                    <span class="al-tl-dot" :class="dotCls(r.status)"></span>
                    <div class="al-tl-t">{{ r.channelName || r.channelType }}
                      <el-tag size="small" :type="recTagType(r.status)">{{ recLabel(r.status) }}</el-tag>
                    </div>
                    <div class="al-tl-d">{{ r.target || '-' }}{{ recNote(r) }}</div>
                    <div class="al-tl-time">{{ fmtTime(r.sentAt || r.createdAt) }}</div>
                  </div>
                </div>
                <el-empty v-else description="暂无通知记录" :image-size="70" />
              </div>
            </div>

            <!-- ★ 规格 3.5：处置时间线完整闭环（触发/认领/确认/静默/解除/恢复/升级） -->
            <div class="kb-card" style="margin-bottom: 16px">
              <div class="al-card-hd"><div class="al-card-title">处置时间线</div></div>
              <div class="al-card-bd">
                <div class="al-timeline">
                  <!-- 触发 -->
                  <div class="al-tl-item">
                    <span class="al-tl-dot ok"></span>
                    <div class="al-tl-t">告警触发</div>
                    <div class="al-tl-d">{{ event.ruleName || event.metric }} · {{ event.service }} 指标超阈值</div>
                    <div class="al-tl-time">{{ fmtTime(event.firedAt) }}</div>
                  </div>
                  <!-- AI 诊断 -->
                  <div v-if="diag" class="al-tl-item">
                    <span class="al-tl-dot ok"></span>
                    <div class="al-tl-t">AI 自动诊断</div>
                    <div class="al-tl-d">生成根因 / 证据 / 建议（置信度 {{ diag.confidence || 0 }}%）</div>
                    <div class="al-tl-time">{{ fmtTime(diag.createdAt) }}</div>
                  </div>
                  <!-- 认领（独立认领或确认自动认领） -->
                  <div class="al-tl-item">
                    <span class="al-tl-dot" :class="event.acknowledgedAt ? 'ok' : 'gray'"></span>
                    <div class="al-tl-t">{{ event.acknowledgedAt ? '已认领' : '待认领' }}</div>
                    <div class="al-tl-d">
                      <template v-if="event.acknowledgedBy">由 <b>@{{ event.acknowledgedBy }}</b> 认领处置</template>
                      <template v-else>确认告警或点击认领后记录处置人</template>
                    </div>
                    <div v-if="event.acknowledgedAt" class="al-tl-time">{{ fmtTime(event.acknowledgedAt) }}</div>
                  </div>
                  <!-- 确认 -->
                  <div class="al-tl-item">
                    <span class="al-tl-dot" :class="isAcked || event.status === 'RESOLVED' ? 'ok' : 'gray'"></span>
                    <div class="al-tl-t">{{ isAcked || event.status === 'RESOLVED' ? '已确认' : '待确认' }}</div>
                    <div class="al-tl-d">
                      <template v-if="event.acknowledgedAt">确认时间见上（确认自动认领）</template>
                      <template v-else>确认后开始处置计时</template>
                    </div>
                  </div>
                  <!-- 静默 / 解除静默 -->
                  <div v-if="event.silencedAt || event.status === 'SILENCED'" class="al-tl-item">
                    <span class="al-tl-dot warn"></span>
                    <div class="al-tl-t">已静默告警</div>
                    <div class="al-tl-d">
                      {{ event.silencedReason || '未填写原因' }}
                      <template v-if="event.silencedNote"> · {{ event.silencedNote }}</template>
                      <template v-if="event.silencedUntil"> · 到期 {{ fmtTime(event.silencedUntil) }}</template>
                      <template v-if="event.silencedBy"> · 由 {{ event.silencedBy }} 操作</template>
                    </div>
                    <div v-if="event.silencedAt" class="al-tl-time">{{ fmtTime(event.silencedAt) }}</div>
                  </div>
                  <!-- 升级记录（规格 4.2：橙色箭头 + 文字说明） -->
                  <template v-if="escalations.length">
                    <div v-for="esc in escalations" :key="esc.id" class="al-tl-item">
                      <span class="al-tl-dot warn"></span>
                      <div class="al-tl-t">已升级（L{{ esc.level }}）</div>
                      <div class="al-tl-d">
                        {{ esc.reason || '长时间未确认处理，系统自动升级' }}
                        <template v-if="esc.toRole"> · 通知角色 {{ esc.toRole }}</template>
                        <template v-if="esc.toUsers"> · 通知 {{ esc.toUsers }}</template>
                      </div>
                      <div class="al-tl-time">{{ fmtTime(esc.triggeredAt) }}</div>
                    </div>
                  </template>
                  <!-- 恢复 -->
                  <div class="al-tl-item">
                    <span class="al-tl-dot" :class="event.status === 'RESOLVED' ? 'ok' : 'gray'"></span>
                    <div class="al-tl-t">{{ event.status === 'RESOLVED' ? '已恢复' : '待恢复' }}</div>
                    <div class="al-tl-d">
                      <template v-if="event.resolutionNote">{{ event.resolutionNote }}</template>
                      <template v-else>恢复后生成候选案例沉淀知识库</template>
                    </div>
                    <div v-if="event.resolvedAt" class="al-tl-time">{{ fmtTime(event.resolvedAt) }}</div>
                  </div>
                </div>
              </div>
            </div>

            <!-- 案例沉淀 -->
            <div class="kb-card">
              <div class="al-card-bd">
                <div class="al-card-title" style="margin-bottom: 8px">
                  <el-icon color="var(--warning)"><RefreshLeft /></el-icon>
                  恢复后沉淀案例
                </div>
                <div class="al-case-desc">告警恢复并确认真实根因/有效处置后，系统会生成候选案例，脱敏后一键沉淀进知识库，在相似故障诊断中被引用。</div>
                <el-button type="primary" style="width: 100%" @click="$router.push('/admin/knowledge')">去案例沉淀（知识库）</el-button>
              </div>
            </div>
          </div>
        </div>

                <!-- ★ 规格 2.4：标记恢复（二次确认 + 恢复备注可选，绿色主按钮） -->
        <el-dialog v-model="resolveVisible" title="标记恢复" width="460px" destroy-on-close>
          <div class="al-confirm-text">
            将告警 <b>{{ event.ruleName || event.metric }}</b> 标记为已恢复？
            <span class="al-confirm-note">恢复为终态，此后告警不再进入待处理列表；若指标再次异常将重新触发。</span>
          </div>
          <el-form label-width="80px" style="margin-top: 8px">
            <el-form-item label="恢复备注">
              <el-input v-model="resolveNote" type="textarea" :rows="3" maxlength="500" show-word-limit
                placeholder="可选，记录恢复操作说明" />
            </el-form-item>
          </el-form>
          <template #footer>
            <el-button @click="resolveVisible = false">取消</el-button>
            <el-button type="success" :loading="resolveLoading" @click="doResolve">确认恢复</el-button>
          </template>
        </el-dialog>

        <!-- ★ 规格 2.5：静默弹窗（原因枚举 + 预设时间 + 校验） -->
        <el-dialog v-model="silenceVisible" title="静默告警" width="500px" destroy-on-close>
          <el-form label-width="90px">
            <el-form-item label="静默原因" required>
              <div class="al-reason-grid">
                <button v-for="r in SILENCE_REASONS" :key="r.value" class="al-reason-item"
                  :class="{ active: silenceForm.reason === r.value }" @click="silenceForm.reason = r.value">
                  {{ r.label }}
                </button>
              </div>
            </el-form-item>
            <el-form-item label="到期时间" required>
              <div class="al-until-row">
                <button v-for="p in UNTIL_PRESETS" :key="p.value" class="al-until-item"
                  :class="{ active: silenceForm.untilType === p.value }" @click="pickUntil(p.value)">
                  {{ p.label }}
                </button>
              </div>
              <el-date-picker v-if="silenceForm.untilType === 'custom'" v-model="silenceForm.untilCustom" type="datetime"
                :disabled-date="disabledBeforeNowPlus15"
                style="width: 100%; margin-top: 8px"
                placeholder="选择静默恢复时间（需晚于当前 15 分钟）" />
            </el-form-item>
            <el-form-item label="备注">
              <el-input v-model="silenceForm.note" type="textarea" :rows="2" maxlength="500" show-word-limit
                placeholder="可选，静默备注" />
            </el-form-item>
            <div class="al-silence-hint">到期必须 &gt; 当前时间 15 分钟，最多 7 天；到期后若指标仍异常将自动回到原状态。</div>
          </el-form>
          <template #footer>
            <el-button @click="silenceVisible = false">取消</el-button>
            <el-button type="primary" :loading="silenceLoading" @click="doSilence">确定静默</el-button>
          </template>
        </el-dialog>
      </template>

      <el-empty v-else-if="!loading" description="告警不存在或已删除">
        <el-button @click="$router.push('/admin/alerts')">返回告警中心</el-button>
      </el-empty>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft, Cpu, Camera, InfoFilled, RefreshLeft, WarningFilled } from '@element-plus/icons-vue'
import {
  listAlertEvents, acknowledgeAlertEvent, claimAlertEvent, resolveAlertEvent,
  silenceAlertEvent, unsilenceAlertEvent, markAlertEventRead, getAlertEscalations,
} from '@/api/alerts'
import { listDiagnoses, followUpDiagnosis, triggerDiagnosis } from '@/api/diagnosis'
import { getFailureSnapshot, listFailureSnapshots } from '@/api/snapshot'
import { listNotificationRecords } from '@/api/notifications'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const canWrite = computed(() => auth.isOperator)

const eventId = route.params.id
const loading = ref(true)
const event = ref(null)
const diag = ref(null)
const snapshot = ref(null)
const snapshotData = ref(null)
const snapshotJson = ref('')
const records = ref([])
const escalations = ref([])
const diagLoading = ref(false)
const followVisible = ref(false)
const followQuestion = ref('')
const followLoading = ref(false)
const followUps = ref([])

// 标记恢复（规格 2.4）
const resolveVisible = ref(false)
const resolveLoading = ref(false)
const resolveNote = ref('')

// 静默（规格 2.5）
const SILENCE_REASONS = [
  { value: 'PLANNED_MAINTENANCE', label: '计划维护' },
  { value: 'KNOWN_ISSUE', label: '已知问题' },
  { value: 'FALSE_POSITIVE', label: '误报' },
  { value: 'OTHER', label: '其他' },
]
const UNTIL_PRESETS = [
  { value: '15m', label: '15 分钟' },
  { value: '30m', label: '30 分钟' },
  { value: '1h', label: '1 小时' },
  { value: '2h', label: '2 小时' },
  { value: 'endOfDay', label: '今天结束' },
  { value: 'custom', label: '自定义' },
]
const silenceVisible = ref(false)
const silenceLoading = ref(false)
const silenceForm = ref({ reason: '', untilType: '1h', untilCustom: null, note: '' })

const isAcked = computed(() => event.value && event.value.status === 'ACKNOWLEDGED')

const STATUS_LABEL = { FIRING: '待处理', SILENCED: '静默', ACKNOWLEDGED: '已确认', RESOLVED: '已恢复' }
const STATUS_TAG = { FIRING: 'danger', SILENCED: 'warning', ACKNOWLEDGED: 'info', RESOLVED: 'success' }
function statusLabel(s) { return STATUS_LABEL[s] || s || '-' }
function statusTagType(s) { return STATUS_TAG[s] || 'info' }

function confColor(c) {
  if (c == null) return '#94A3B8'
  if (c >= 80) return '#0D9488'
  if (c >= 60) return '#D97706'
  return '#64748B'
}
function confCls(c) {
  if (c == null) return 'conf-low'
  if (c >= 80) return 'conf-high'
  if (c >= 60) return 'conf-mid'
  return 'conf-low'
}

// P1 规格 4：参考知识辅助
const REF_TYPE_LABEL = { BASE_DOC: '内置文档', KNOWLEDGE_DOC: '知识文档', CASE: '历史案例' }
const LAYER_LABEL = { BUILTIN: '内置', PRIVATE: '私有', CASE: '案例' }
function refTypeLabel(t) { return REF_TYPE_LABEL[t] || t || '知识' }
function refTypeCls(t) { return `ref-${(t || 'doc').toLowerCase()}` }
function layerLabel(l) { return LAYER_LABEL[l] || l || '-' }
function refScore(s) {
  if (s == null) return ''
  return `${Math.round(s * 100)}%`
}

// ---- 通知记录状态 ----
const REC_LABEL = { SUCCESS: '已送达', FAILED: '失败', RETRYING: '重试中', PENDING: '待发送', SENT: '已送达' }
function recLabel(s) { return REC_LABEL[s] || s || '-' }
function recTagType(s) {
  if (s === 'SUCCESS' || s === 'SENT') return 'success'
  if (s === 'RETRYING' || s === 'PENDING') return 'warning'
  return 'danger'
}
function dotCls(s) {
  if (s === 'SUCCESS' || s === 'SENT') return 'ok'
  if (s === 'RETRYING' || s === 'PENDING') return 'warn'
  return 'fail'
}
function recNote(r) {
  if (r.status === 'RETRYING' || r.status === 'FAILED') {
    return ` · ${r.errorMessage || ''}${r.retryCount != null ? `（已重试 ${r.retryCount}/${r.maxRetry || 3}）` : ''}`
  }
  return ''
}

// ---- 快照展示 ----
function displayValue(v) {
  if (v == null) return '-'
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

// ---- 加载 ----
async function load() {
  loading.value = true
  try {
    // 1. 找告警事件（列表接口无单查，全量匹配）
    const list = (await listAlertEvents({ limit: 200 })) || []
    event.value = list.find((e) => String(e.id) === String(eventId)) || null
    if (!event.value) return

    // ★ 规格 1.6：打开详情不自动标记已读（由用户手动操作）

    // 2. 诊断
    const diags = (await listDiagnoses({ alertEventId: Number(eventId), limit: 10 })) || []
    diag.value = diags.find((d) => d.status !== 'FAILED' && !d.question) || diags.find((d) => d.status !== 'FAILED') || diags[0] || null
    // P1 规格 3.1：追问记录（question 非空），按时间正序展示
    followUps.value = diags.filter((d) => d.question && d.answer).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))

    // 3. 快照：优先用诊断关联，其次按告警事件查
    let snap = null
    if (diag.value && diag.value.snapshotId) {
      try {
        snap = await getFailureSnapshot(diag.value.snapshotId)
      } catch { /* 忽略 */ }
    }
    if (!snap) {
      const snaps = (await listFailureSnapshots({ alertEventId: Number(eventId), limit: 5 })) || []
      snap = snaps[0] || null
    }
    snapshot.value = snap
    if (snap && snap.snapshot) {
      snapshotData.value = snap.snapshot
      snapshotJson.value = JSON.stringify(snap.snapshot, null, 2)
    }

    // 4. 通知记录
    records.value = (await listNotificationRecords({ alertEventId: Number(eventId), limit: 20 })) || []

    // 5. 升级记录（规格 4.2：处置时间线数据源）
    try {
      escalations.value = (await getAlertEscalations(event.value.id)) || []
    } catch { escalations.value = [] }
  } catch (e) {
    ElMessage.error(e.message || '加载告警详情失败')
  } finally {
    loading.value = false
  }
}

// 独立认领（规格 3.2）
async function handleClaim() {
  try {
    await claimAlertEvent(event.value.id)
    ElMessage.success(`已认领告警，当前处置人 @${auth.username}`)
    load()
  } catch (e) {
    ElMessage.error(e.message || '认领失败')
  }
}

// 接管他人告警（规格 3.4：二次确认）
async function handleTakeover() {
  try {
    await ElMessageBox.confirm(
      `该告警当前由 @${event.value.acknowledgedBy} 认领。确认接管？`,
      '接管告警',
      { type: 'warning', confirmButtonText: '确认接管', cancelButtonText: '取消' }
    )
    await claimAlertEvent(event.value.id)
    ElMessage.success(`已接管，当前处置人 @${auth.username}`)
    load()
  } catch (e) {
    if (e && e.message) ElMessage.error(e.message)
  }
}

// 确认告警（规格 2.3：无二次确认，自动认领）
async function handleAck() {
  try {
    await acknowledgeAlertEvent(event.value.id)
    ElMessage.success(`已确认，处置人 @${auth.username}`)
    load()
  } catch (e) {
    ElMessage.error(e.message || '确认失败')
  }
}

// 标记恢复：弹窗（规格 2.4）
function openResolve() {
  resolveNote.value = ''
  resolveVisible.value = true
}

async function doResolve() {
  resolveLoading.value = true
  try {
    await resolveAlertEvent(event.value.id, { resolutionNote: resolveNote.value.trim() || undefined })
    ElMessage.success('已标记恢复')
    resolveVisible.value = false
    load()
  } catch (e) {
    ElMessage.error(e.message || '标记恢复失败')
  } finally {
    resolveLoading.value = false
  }
}

// 标记已读（规格 1.6：详情不自动已读，手动标记）
async function handleMarkRead() {
  try {
    await markAlertEventRead(event.value.id)
    ElMessage.success('已标记已读')
    event.value.read = true
  } catch (e) {
    ElMessage.error(e.message || '标记已读失败')
  }
}

// 解除静默（规格 2.2）
async function handleUnsilence() {
  try {
    await unsilenceAlertEvent(event.value.id)
    ElMessage.success('已解除静默')
    load()
  } catch (e) {
    ElMessage.error(e.message || '解除静默失败')
  }
}

// ---- 静默 ----
function openSilence() {
  silenceForm.value = { reason: '', untilType: '1h', untilCustom: null, note: '' }
  silenceVisible.value = true
}

function pickUntil(type) {
  silenceForm.value.untilType = type
  if (type !== 'custom') silenceForm.value.untilCustom = null
}

function disabledBeforeNowPlus15(date) {
  return date.getTime() < Date.now() + 15 * 60 * 1000
}

function computeUntil() {
  const now = Date.now()
  const f = silenceForm.value
  switch (f.untilType) {
    case '15m': return new Date(now + 16 * 60 * 1000) // 规格要求 > now+15min，留 1 分钟缓冲
    case '30m': return new Date(now + 30 * 60 * 1000)
    case '1h': return new Date(now + 60 * 60 * 1000)
    case '2h': return new Date(now + 2 * 60 * 60 * 1000)
    case 'endOfDay': {
      const d = new Date()
      d.setHours(23, 59, 59, 0)
      return d
    }
    default: return f.untilCustom
  }
}

async function doSilence() {
  const f = silenceForm.value
  if (!f.reason) {
    ElMessage.warning('请选择静默原因')
    return
  }
  const until = computeUntil()
  if (!until) {
    ElMessage.warning('请选择到期时间')
    return
  }
  // 校验：必须 > now+15min，最多 7 天（规格 2.5）
  const min = Date.now() + 15 * 60 * 1000
  const max = Date.now() + 7 * 24 * 3600 * 1000
  const untilTs = new Date(until).getTime()
  if (untilTs <= min) {
    ElMessage.warning('到期时间必须晚于当前时间 15 分钟')
    return
  }
  if (untilTs > max) {
    ElMessage.warning('静默最多 7 天，请缩短到期时间')
    return
  }
  silenceLoading.value = true
  try {
    const payload = {
      reason: f.reason,
      silencedUntil: formatDateTime(until),
      note: f.note.trim() || undefined,
    }
    await silenceAlertEvent(event.value.id, payload)
    ElMessage.success('已静默，到期自动恢复')
    silenceVisible.value = false
    load()
  } catch (e) {
    ElMessage.error(e.message || '静默失败')
  } finally {
    silenceLoading.value = false
  }
}

async function handleTriggerDiag() {
  diagLoading.value = true
  try {
    await triggerDiagnosis(snapshot.value.id)
    ElMessage.success('诊断已触发')
    load()
  } catch (e) {
    ElMessage.error(e.message || '触发诊断失败')
  } finally {
    diagLoading.value = false
  }
}

async function handleFollowUp() {
  const q = (followQuestion.value || '').trim()
  if (!q) {
    ElMessage.warning('请输入追问内容')
    return
  }
  if (!diag.value) return
  followLoading.value = true
  try {
    await followUpDiagnosis(diag.value.id, q)
    ElMessage.success('追问完成')
    followQuestion.value = ''
    load()
  } catch (e) {
    ElMessage.error(e.message || '追问失败')
  } finally {
    followLoading.value = false
  }
}

// P1 规格 3.2：带上下文跳 /chat
function buildAlertContext() {
  if (!event.value) return ''
  const parts = []
  parts.push(`告警 #${event.value.id}（${event.value.ruleName || event.value.metric}）`)
  parts.push(`服务 ${event.value.service} · 指标 ${event.value.metric} · 触发 ${fmtTime(event.value.firedAt)}`)
  if (diag.value && diag.value.rootCause) parts.push(`AI 诊断根因：${diag.value.rootCause}`)
  if (diag.value && diag.value.summary) parts.push(`诊断摘要：${diag.value.summary}`)
  if (diag.value && diag.value.suggestions && diag.value.suggestions.length) {
    parts.push(`建议处置：${diag.value.suggestions.slice(0, 3).join('；')}`)
  }
  let ctx = parts.join('\n')
  if (ctx.length > 800) ctx = ctx.slice(0, 800)
  return ctx
}

function goChat() {
  const ctx = buildAlertContext()
  const query = { ref: `alert:${event.value.id}`, context: ctx }
  if (diag.value && diag.value.rootCause) {
    query.q = `这个告警的根因是「${diag.value.rootCause}」，结合上下文继续分析处置建议？`
  }
  router.push({ path: '/chat', query })
}

function fmtTime(t) {
  if (!t) return '-'
  const d = new Date(t)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

function formatDateTime(d) {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

onMounted(load)
</script>

<style scoped>
.page {
  padding: 20px 24px 32px;
  max-width: 1160px;
  margin: 0 auto;
}

.back-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
  margin-bottom: 14px;
  transition: color 0.15s;
}

.back-link:hover { color: var(--primary); }

/* ============ 告警头 ============ */
.al-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
}

.al-head-title {
  font-size: 17px;
  font-weight: 600;
  margin: 0 0 8px;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  color: var(--text-primary);
}

.al-head-meta {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
  font-size: 12.5px;
  color: var(--text-muted);
}

/* 认领人展示（规格 3.3） */
.al-head-owner {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 8px;
}
.al-owner-tag {
  display: inline-block;
  font-size: 12px;
  font-weight: 600;
  padding: 2px 10px;
  border-radius: 999px;
  background: rgba(37, 99, 235, 0.1);
  color: #2563EB;
  border: 1px solid rgba(37, 99, 235, 0.2);
}
.al-owner-tag.none {
  background: rgba(100, 116, 139, 0.08);
  color: rgba(0, 0, 0, 0.3);
  border: 1px dashed rgba(100, 116, 139, 0.25);
}
.al-owner-time {
  font-size: 12px;
  color: var(--text-muted);
}

/* 已升级徽标（规格 4.3） */
.al-escalated {
  display: inline-block;
  font-size: 12px;
  font-weight: 600;
  padding: 1px 8px;
  border-radius: 999px;
  background: rgba(217, 119, 6, 0.14);
  color: #D97706;
  cursor: default;
}

.al-head-actions {
  display: flex;
  gap: 10px;
  flex-shrink: 0;
  flex-wrap: wrap;
}

/* ============ 链路 ============ */
.al-flow {
  display: flex;
  align-items: center;
  margin: 16px 0 4px;
  flex-wrap: wrap;
  gap: 6px;
}

.al-flow-node {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 12.5px;
  color: var(--text-secondary);
}

.al-flow-dot {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--success-bg);
  color: var(--success);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
}

.al-flow-node.active .al-flow-dot {
  background: linear-gradient(135deg, #2563EB, #1E40AF);
  color: #fff;
}

.al-flow-line {
  flex: 0 0 26px;
  height: 2px;
  background: #C7F0DE;
}

/* ============ kv ============ */
.al-kvgrid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-top: 14px;
}

.al-kv {
  background: #F8FAFC;
  border-radius: 8px;
  padding: 10px 12px;
}

.al-kv .k {
  font-size: 11.5px;
  color: var(--text-muted);
  margin-bottom: 3px;
}

.al-kv .v {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  font-family: ui-monospace, monospace;
}

.al-kv .v.bad { color: var(--danger); }

/* ============ 双列布局 ============ */
.detail-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 16px;
}

/* ============ 卡片 ============ */
.al-card-hd {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid rgba(226, 232, 240, 0.6);
}

.al-card-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.al-card-bd { padding: 16px 18px; }

.al-muted { font-size: 12px; color: var(--text-muted); }

.al-conf-tag {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 11.5px;
  font-weight: 600;
}

.conf-high { background: rgba(13, 148, 136, 0.12); color: var(--teal); }
.conf-mid { background: rgba(217, 119, 6, 0.12); color: var(--warning); }
.conf-low { background: rgba(100, 116, 139, 0.1); color: var(--text-muted); }

/* ============ 诊断 ============ */
.al-diag-headline {
  display: flex;
  gap: 16px;
  align-items: center;
  margin-bottom: 14px;
}

.al-score-ring {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  flex-shrink: 0;
  background: conic-gradient(var(--ring) calc(var(--pct) * 1%), #EEF1F6 0);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.al-score-ring::before {
  content: '';
  position: absolute;
  inset: 7px;
  border-radius: 50%;
  background: #fff;
}

.al-score-ring span {
  position: relative;
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
}

.al-diag-note {
  font-size: 12.5px;
  color: var(--text-muted);
  line-height: 1.7;
}

.al-block { margin-top: 12px; }
.al-lab { font-size: 12px; color: var(--text-muted); margin-bottom: 4px; }
.al-text { font-size: 13.5px; color: var(--text-primary); line-height: 1.7; }
.al-list { margin: 0; padding-left: 18px; font-size: 13px; color: var(--text-primary); line-height: 1.8; }
.al-err { margin-top: 10px; padding: 8px 12px; background: rgba(220, 38, 38, 0.08); border-radius: 6px; color: #DC2626; font-size: 12.5px; }

.al-tip {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  margin-top: 14px;
  padding: 10px 12px;
  background: #F0F7FF;
  border-radius: 8px;
  color: var(--text-secondary);
  font-size: 12.5px;
  line-height: 1.6;
}

.al-card-actions {
  display: flex;
  gap: 10px;
  margin-top: 14px;
}

/* ============ 快照 ============ */
.al-snap-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.al-snap-item {
  background: #F8FAFC;
  border-radius: 8px;
  padding: 10px 12px;
  min-width: 0;
}

.al-snap-item .k {
  font-size: 11px;
  color: var(--text-muted);
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.al-snap-item .v {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  font-family: ui-monospace, monospace;
  word-break: break-all;
  max-height: 60px;
  overflow: hidden;
}

.al-snap-json {
  margin-top: 14px;
  font-size: 12.5px;
  color: var(--text-muted);
}

.al-snap-json pre {
  max-height: 240px;
  overflow: auto;
  background: #F8FAFC;
  border-radius: 8px;
  padding: 12px;
  font-size: 12px;
  line-height: 1.6;
  margin: 8px 0 0;
}

/* ============ 时间线 ============ */
.al-timeline {
  position: relative;
  padding-left: 6px;
}

.al-tl-item {
  position: relative;
  padding: 0 0 18px 22px;
}

.al-tl-item:last-child { padding-bottom: 0; }

.al-tl-item::before {
  content: '';
  position: absolute;
  left: 4px;
  top: 6px;
  bottom: -2px;
  width: 2px;
  background: #E5EAF1;
}

.al-tl-item:last-child::before { display: none; }

.al-tl-dot {
  position: absolute;
  left: 0;
  top: 3px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #CBD5E1;
}

.al-tl-dot.ok { background: var(--success); box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.12); }
.al-tl-dot.warn { background: var(--warning); box-shadow: 0 0 0 3px rgba(217, 119, 6, 0.14); }
.al-tl-dot.fail { background: var(--danger); }
.al-tl-dot.gray { background: #CBD5E1; }

.al-tl-t {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--text-primary);
}

.al-tl-d {
  font-size: 12.5px;
  color: var(--text-muted);
  margin-top: 2px;
  line-height: 1.6;
}

.al-tl-time {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 2px;
}

/* ============ 案例沉淀 ============ */
.al-case-desc {
  font-size: 12.5px;
  color: var(--text-muted);
  line-height: 1.7;
  margin-bottom: 14px;
}

/* ============ 弹窗通用 ============ */
.al-confirm-text {
  font-size: 14px;
  color: var(--text-primary);
  line-height: 1.7;
}
.al-confirm-note {
  display: block;
  font-size: 12.5px;
  color: var(--text-muted);
  margin-top: 2px;
}

.al-reason-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  width: 100%;
}
.al-reason-item {
  border: 1px solid rgba(226, 232, 240, 0.9);
  background: #fff;
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s;
}
.al-reason-item:hover { border-color: rgba(37, 99, 235, 0.4); }
.al-reason-item.active {
  border-color: var(--primary);
  background: rgba(37, 99, 235, 0.06);
  color: var(--primary);
  font-weight: 600;
}

.al-until-row {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.al-until-item {
  border: 1px solid rgba(226, 232, 240, 0.9);
  background: #fff;
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 12.5px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s;
}
.al-until-item:hover { border-color: rgba(37, 99, 235, 0.4); }
.al-until-item.active {
  border-color: var(--primary);
  background: rgba(37, 99, 235, 0.06);
  color: var(--primary);
  font-weight: 600;
}

.al-silence-hint {
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.6;
  padding: 4px 0 0;
}

/* ============ P1 参考知识（规格 4） ============ */
.al-ref-count {
  font-size: 11px;
  font-weight: 500;
  color: var(--text-muted);
  margin-left: 4px;
}
.al-refs {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.al-ref-item {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 8px 10px;
  background: #fff;
}
.al-ref-top {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.al-ref-type {
  display: inline-block;
  padding: 1px 7px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  background: #E0F2FE;
  color: #0369A1;
}
.al-ref-type.ref-knowledge_doc {
  background: #FEF3C7;
  color: #B45309;
}
.al-ref-type.ref-case {
  background: #FCE7F3;
  color: #BE185D;
}
.al-ref-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}
.al-ref-section {
  font-size: 11.5px;
  color: var(--text-muted);
  font-family: ui-monospace, monospace;
}
.al-ref-score {
  margin-left: auto;
  font-size: 12px;
  font-weight: 600;
  color: var(--teal);
}
.al-ref-snippet {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 5px;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.al-ref-meta {
  display: flex;
  gap: 10px;
  margin-top: 5px;
  font-size: 11.5px;
  color: var(--text-muted);
}
.al-ref-empty {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  border: 1px dashed var(--border);
  border-radius: 8px;
  font-size: 12px;
  color: var(--text-muted);
  background: rgba(241, 245, 249, 0.4);
}

/* ============ P1 内嵌追问（规格 3.1） ============ */
.al-followup {
  margin-top: 6px;
  padding-top: 12px;
  border-top: 1px dashed var(--border);
}
.al-followup-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 10px;
}
.al-fu-item {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 8px 10px;
  background: rgba(241, 245, 249, 0.5);
}
.al-fu-q {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 4px;
}
.al-fu-a {
  font-size: 12.5px;
  color: var(--text-secondary);
  line-height: 1.6;
  white-space: pre-wrap;
}
.al-fu-err {
  font-size: 12px;
  color: var(--danger);
}
.al-followup-input {
  margin-top: 8px;
}
.al-followup-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
}
.al-followup-hint {
  font-size: 11.5px;
  color: var(--text-muted);
}

</style>
