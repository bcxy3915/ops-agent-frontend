<template>
  <div class="page">
    <!-- ========== 页头 ========== -->
    <div class="page-header">
      <div class="page-header-left">
        <h2 class="page-title">管理后台</h2>
        <span class="page-subtitle">服务、指标、告警、知识库与系统设置统一管理</span>
      </div>
      <div class="page-header-actions">
        <span class="header-pill">{{ tenantLabel }}</span>
        <span class="header-pill">{{ deptLabel }}</span>
        <el-button @click="goChat">
          <el-icon style="margin-right: 4px">
            <ArrowLeft />
          </el-icon>
          返回对话
        </el-button>
      </div>
    </div>

    <!-- ========== Hero ========== -->
    <div class="admin-hero">
      <div class="hero-info">
        <div class="hero-greet">你好，{{ authStore.username }} 👋</div>
        <div class="hero-desc">一站式管理你的运维资产：监控服务健康、处理告警、沉淀运维知识、追踪审计记录。</div>
        <div class="hero-tags">
          <span class="hero-tag">服务管理</span>
          <span class="hero-tag">指标监控</span>
          <span class="hero-tag">告警 · 通知</span>
          <span class="hero-tag">知识库</span>
          <span class="hero-tag" v-if="can('audit:read')">审计 · 用户</span>
        </div>
      </div>
      <div class="hero-badge">
        <div class="hero-badge-icon">
          <el-icon>
            <Monitor />
          </el-icon>
        </div>
      </div>
      <!-- ========== Hero 动态数据（P1：实时概要） ========== -->
      <div class="hero-stats">
        <div class="hero-stat" @click="go('/admin/alerts')">
          <div class="hs-label">待处理告警</div>
          <div class="hs-value">{{ heroValue(summary.data?.openCount) }}</div>
        </div>
        <div class="hero-stat" @click="go('/admin/alerts')">
          <div class="hs-label">今日触发</div>
          <div class="hs-value">{{ heroValue(summary.data?.todayCount) }}</div>
        </div>
        <div class="hero-stat" @click="go('/admin/knowledge')">
          <div class="hs-label">本月知识命中</div>
          <div class="hs-value">{{ heroValue(kstats.data?.monthHits) }}</div>
        </div>
      </div>
    </div>

    <!-- ========== 实时概览统计卡（P1 规格 2.3） ========== -->
    <div class="home-overview">
      <div class="ov-card ov-danger" @click="go('/admin/alerts')">
        <div class="ov-head">
          <span class="ov-label">待处理告警</span>
          <el-button v-if="summary.error" link size="small" title="重试" @click.stop="loadSummary">
            <el-icon><Refresh /></el-icon>
          </el-button>
        </div>
        <div class="ov-value" v-loading="summary.loading" element-loading-background="rgba(255,255,255,0.5)">
          {{ displayValue(summary.data?.openCount, summary) }}
        </div>
        <div class="ov-sub">FIRING + ACK，点击进入告警中心</div>
      </div>

      <div class="ov-card ov-warning" @click="go('/admin/knowledge')">
        <div class="ov-head">
          <span class="ov-label">待沉淀案例</span>
          <el-button v-if="kstats.error" link size="small" title="重试" @click.stop="loadStats">
            <el-icon><Refresh /></el-icon>
          </el-button>
        </div>
        <div class="ov-value" v-loading="kstats.loading" element-loading-background="rgba(255,255,255,0.5)">
          {{ displayValue(kstats.data?.pendingCases, kstats) }}
        </div>
        <div class="ov-sub">待确认候选案例，确认后作为检索语料</div>
      </div>

      <div class="ov-card ov-teal" @click="go('/admin/knowledge')">
        <div class="ov-head">
          <span class="ov-label">本月知识命中</span>
          <el-button v-if="kstats.error" link size="small" title="重试" @click.stop="loadStats">
            <el-icon><Refresh /></el-icon>
          </el-button>
        </div>
        <div class="ov-value" v-loading="kstats.loading" element-loading-background="rgba(255,255,255,0.5)">
          {{ displayValue(kstats.data?.monthHits, kstats) }}
        </div>
        <div class="ov-sub">知识文档 / 案例被诊断引用的次数</div>
      </div>

      <div class="ov-card ov-blue" @click="go('/admin/knowledge')">
        <div class="ov-head">
          <span class="ov-label">知识文档</span>
          <el-button v-if="kstats.error" link size="small" title="重试" @click.stop="loadStats">
            <el-icon><Refresh /></el-icon>
          </el-button>
        </div>
        <div class="ov-value" v-loading="kstats.loading" element-loading-background="rgba(255,255,255,0.5)">
          {{ displayValue(kstats.data?.totalDocs, kstats) }}
        </div>
        <div class="ov-sub">内置文档 + 私有知识文档</div>
      </div>
    </div>

    <!-- ========== 快捷卡片 ========== -->
    <div class="home-groups">
      <!-- 平台管理 -->
      <div v-if="can('tenant:manage')" class="home-group">
        <div class="home-group-label">平台管理</div>
        <div class="home-cards">
          <div class="home-card" @click="go('/admin/tenants')">
            <div class="hc-icon hc-blue">
              <el-icon><OfficeBuilding /></el-icon>
            </div>
            <div class="hc-body">
              <div class="hc-title">租户管理</div>
              <div class="hc-desc">开通 / 停用 / 审核模式 / 配额</div>
            </div>
            <el-icon class="hc-arrow" color="#CBD5E1"><ArrowRight /></el-icon>
          </div>
        </div>
      </div>

      <!-- 组织与权限 -->
      <div v-if="can('dept:read') || can('user:read') || authStore.isPlatformAdmin" class="home-group">
        <div class="home-group-label">组织与权限</div>
        <div class="home-cards">
          <div v-if="can('dept:read')" class="home-card" @click="go('/admin/depts')">
            <div class="hc-icon hc-teal">
              <el-icon><Connection /></el-icon>
            </div>
            <div class="hc-body">
              <div class="hc-title">部门树</div>
              <div class="hc-desc">多级部门 · 上级看下级 · 服务归属</div>
            </div>
            <el-icon class="hc-arrow" color="#CBD5E1"><ArrowRight /></el-icon>
          </div>

          <div v-if="can('user:read')" class="home-card" @click="go('/admin/users')">
            <div class="hc-icon hc-teal">
              <el-icon><User /></el-icon>
            </div>
            <div class="hc-body">
              <div class="hc-title">用户管理</div>
              <div class="hc-desc">邮箱 · 部门 · 多角色 · 状态</div>
            </div>
            <el-icon class="hc-arrow" color="#CBD5E1"><ArrowRight /></el-icon>
          </div>

          <div v-if="authStore.isPlatformAdmin" class="home-card" @click="go('/admin/roles')">
            <div class="hc-icon hc-teal">
              <el-icon><Key /></el-icon>
            </div>
            <div class="hc-body">
              <div class="hc-title">角色权限</div>
              <div class="hc-desc">平台 / 企业 / 部门角色 · 权限点矩阵</div>
            </div>
            <el-icon class="hc-arrow" color="#CBD5E1"><ArrowRight /></el-icon>
          </div>
        </div>
      </div>

      <!-- 监控运维 -->
      <div class="home-group">
        <div class="home-group-label">监控运维</div>
        <div class="home-cards">
          <div class="home-card" @click="go('/admin/services')">
            <div class="hc-icon hc-blue">
              <el-icon>
                <Monitor />
              </el-icon>
            </div>
            <div class="hc-body">
              <div class="hc-title">服务管理</div>
              <div class="hc-desc">注册、健康检查、维护窗口</div>
            </div>
            <el-icon class="hc-arrow" color="#CBD5E1">
              <ArrowRight />
            </el-icon>
          </div>

          <div class="home-card" @click="go('/admin/metrics')">
            <div class="hc-icon hc-indigo">
              <el-icon>
                <TrendCharts />
              </el-icon>
            </div>
            <div class="hc-body">
              <div class="hc-title">指标监控</div>
              <div class="hc-desc">系统资源与业务指标曲线</div>
            </div>
            <el-icon class="hc-arrow" color="#CBD5E1">
              <ArrowRight />
            </el-icon>
          </div>

          <div class="home-card" @click="go('/admin/alerts')">
            <div class="hc-icon hc-amber">
              <el-icon>
                <Bell />
              </el-icon>
            </div>
            <div class="hc-body">
              <div class="hc-title">告警中心</div>
              <div class="hc-desc">告警事件、批量处置与静默</div>
            </div>
            <el-icon class="hc-arrow" color="#CBD5E1">
              <ArrowRight />
            </el-icon>
          </div>

          <div v-if="can('alert:manage')" class="home-card" @click="go('/admin/alert-rules')">
            <div class="hc-icon hc-slate">
              <el-icon>
                <SetUp />
              </el-icon>
            </div>
            <div class="hc-body">
              <div class="hc-title">告警规则</div>
              <div class="hc-desc">阈值、持续时长、升级策略</div>
            </div>
            <el-icon class="hc-arrow" color="#CBD5E1">
              <ArrowRight />
            </el-icon>
          </div>
        </div>
      </div>

      <!-- 知识库 -->
      <div class="home-group">
        <div class="home-group-label">知识库</div>
        <div class="home-cards">
          <div class="home-card" @click="go('/admin/knowledge')">
            <div class="hc-icon hc-teal">
              <el-icon>
                <Collection />
              </el-icon>
            </div>
            <div class="hc-body">
              <div class="hc-title">知识库</div>
              <div class="hc-desc">文档沉淀、案例确认、检索引用</div>
            </div>
            <el-icon class="hc-arrow" color="#CBD5E1">
              <ArrowRight />
            </el-icon>
          </div>

          <div v-if="can('knowledge:review')" class="home-card" @click="go('/admin/review')">
            <div class="hc-icon hc-teal">
              <el-icon>
                <DocumentChecked />
              </el-icon>
            </div>
            <div class="hc-body">
              <div class="hc-title">
                审核工作台
                <span v-if="reviewCount" class="hc-badge">{{ reviewCount }}</span>
              </div>
              <div class="hc-desc">部门 / 企业两级审核 · 四眼原则</div>
            </div>
            <el-icon class="hc-arrow" color="#CBD5E1">
              <ArrowRight />
            </el-icon>
          </div>
        </div>
      </div>

      <!-- 系统设置 -->
      <div v-if="can('notification:manage') || can('audit:read')" class="home-group">
        <div class="home-group-label">系统设置</div>
        <div class="home-cards">
          <div v-if="can('notification:manage')" class="home-card" @click="go('/admin/channels')">
            <div class="hc-icon hc-violet">
              <el-icon>
                <ChatDotRound />
              </el-icon>
            </div>
            <div class="hc-body">
              <div class="hc-title">通知渠道</div>
              <div class="hc-desc">邮件/Webhook 渠道与模板</div>
            </div>
            <el-icon class="hc-arrow" color="#CBD5E1">
              <ArrowRight />
            </el-icon>
          </div>

          <div v-if="can('audit:read')" class="home-card" @click="go('/admin/audit')">
            <div class="hc-icon hc-cyan">
              <el-icon>
                <Document />
              </el-icon>
            </div>
            <div class="hc-body">
              <div class="hc-title">审计日志</div>
              <div class="hc-desc">租户 / 部门维度 · 审核与敏感访问留痕</div>
            </div>
            <el-icon class="hc-arrow" color="#CBD5E1">
              <ArrowRight />
            </el-icon>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  ArrowLeft, ArrowRight, Monitor, TrendCharts, Bell, SetUp,
  Collection, ChatDotRound, Document, User, Refresh,
  OfficeBuilding, Connection, Key, DocumentChecked
} from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'
import { getAlertSummary } from '@/api/alerts'
import { getKnowledgeStats } from '@/api/knowledge'
import { listDepts } from '@/api/rbac'

const router = useRouter()
const authStore = useAuthStore()

const can = (code) => authStore.hasPermission(code)
const deptName = ref('')
const tenantLabel = computed(() => {
  if (authStore.tenantId === '0') return '平台'
  return authStore.tenantId === 't-default' ? '星海科技' : (authStore.tenantId || '本企业')
})
const deptLabel = computed(() => deptName.value || '未分配部门')

// ========== 实时概览（P1 规格 2.3）：单卡失败显示 "—" 并提供重试 ==========
const summary = reactive({ loading: false, error: false, data: null })
const kstats = reactive({ loading: false, error: false, data: null })
const reviewCount = computed(() => kstats.data?.pendingDocs || 0)

function displayValue(v, state) {
  if (state.error) return '—'
  if (v === null || v === undefined) return '—'
  return v
}

function heroValue(v) {
  return v === null || v === undefined ? '—' : v
}

async function loadSummary() {
  summary.loading = true
  try {
    summary.data = await getAlertSummary()
    summary.error = false
  } catch (e) {
    summary.error = true
  } finally {
    summary.loading = false
  }
}

async function loadStats() {
  kstats.loading = true
  try {
    kstats.data = await getKnowledgeStats()
    kstats.error = false
  } catch (e) {
    kstats.error = true
  } finally {
    kstats.loading = false
  }
}

function go(path) {
  router.push(path)
}

function goChat() {
  router.push('/chat')
}

async function loadDept() {
  if (!authStore.hasPermission('dept:read')) return
  try {
    const list = await listDepts()
    const hit = (list || []).find((d) => d.id === authStore.deptId)
    if (hit) deptName.value = hit.name
  } catch {
    deptName.value = ''
  }
}

onMounted(() => {
  loadDept()
  loadSummary()
  loadStats()
})
</script>

<style scoped>
.page {
  padding: 20px 24px 32px;
  max-width: 1160px;
  margin: 0 auto;
}

/* ============ 页头 ============ */
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18px;
}

.page-title {
  font-size: 20px;
  font-weight: 600;
  margin: 0;
  color: var(--text-primary);
}

.page-subtitle {
  font-size: 13px;
  color: var(--text-muted);
  margin-left: 10px;
}

.header-pill {
  padding: 3px 10px;
  border-radius: 12px;
  background: rgba(219, 234, 254, 0.7);
  color: var(--primary);
  font-size: 12px;
  font-weight: 500;
}

/* ============ Hero ============ */
.admin-hero {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 26px 28px;
  border-radius: 16px;
  background: linear-gradient(135deg, rgba(37, 99, 235, 0.9) 0%, rgba(30, 64, 175, 0.92) 100%);
  color: white;
  box-shadow: 0 8px 24px rgba(30, 64, 175, 0.22);
  margin-bottom: 20px;
  gap: 20px;
}

.hero-info {
  flex: 1;
  min-width: 0;
}

.hero-greet {
  font-size: 20px;
  font-weight: 600;
  margin-bottom: 6px;
}

.hero-desc {
  font-size: 13.5px;
  color: rgba(255, 255, 255, 0.82);
  margin-bottom: 14px;
}

.hero-tags {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.hero-tag {
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.16);
  font-size: 12px;
  color: rgba(255, 255, 255, 0.92);
}

.hero-badge {
  width: 64px;
  height: 64px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.14);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.hero-badge-icon {
  font-size: 30px;
  color: rgba(255, 255, 255, 0.9);
}

/* ============ Hero 动态数据（P1） ============ */
.hero-stats {
  display: flex;
  gap: 10px;
  flex-shrink: 0;
}

.hero-stat {
  min-width: 96px;
  padding: 10px 14px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.13);
  border: 1px solid rgba(255, 255, 255, 0.18);
  cursor: pointer;
  transition: all 0.15s;
}

.hero-stat:hover {
  background: rgba(255, 255, 255, 0.22);
}

.hs-label {
  font-size: 11.5px;
  color: rgba(255, 255, 255, 0.78);
  margin-bottom: 3px;
}

.hs-value {
  font-size: 20px;
  font-weight: 700;
  line-height: 1.1;
}

/* ============ 实时概览统计卡（P1 规格 2.3） ============ */
.home-overview {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
  margin-bottom: 28px;
}

.ov-card {
  position: relative;
  background: rgba(255, 255, 255, 0.85);
  border: 1px solid rgba(226, 232, 240, 0.8);
  border-radius: 12px;
  padding: 16px 18px;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 1px 3px rgba(30, 64, 175, 0.04);
  border-top: 3px solid var(--primary);
}

.ov-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(30, 64, 175, 0.1);
}

.ov-danger { border-top-color: #EF4444; }
.ov-warning { border-top-color: #F59E0B; }
.ov-teal { border-top-color: #0D9488; }
.ov-blue { border-top-color: #3B82F6; }

.ov-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.ov-label {
  font-size: 12.5px;
  color: var(--text-muted);
}

.ov-value {
  font-size: 28px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.2;
}

.ov-sub {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 6px;
}

/* ============ 快捷卡片 ============ */
.home-group {
  margin-bottom: 26px;
}

.home-group-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 12px;
  padding-left: 2px;
}

.home-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 14px;
}

.home-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.82);
  border: 1px solid rgba(226, 232, 240, 0.8);
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 1px 3px rgba(30, 64, 175, 0.04);
}

.home-card:hover {
  transform: translateY(-2px);
  border-color: rgba(30, 64, 175, 0.2);
  box-shadow: 0 6px 16px rgba(30, 64, 175, 0.1);
}

.hc-icon {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 19px;
  color: white;
  flex-shrink: 0;
}

.hc-blue { background: linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%); }
.hc-indigo { background: linear-gradient(135deg, #818CF8 0%, #4F46E5 100%); }
.hc-amber { background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%); }
.hc-slate { background: linear-gradient(135deg, #94A3B8 0%, #64748B 100%); }
.hc-teal { background: linear-gradient(135deg, #2DD4BF 0%, #0D9488 100%); }
.hc-violet { background: linear-gradient(135deg, #A78BFA 0%, #7C3AED 100%); }
.hc-cyan { background: linear-gradient(135deg, #22D3EE 0%, #0891B2 100%); }
.hc-green { background: linear-gradient(135deg, #34D399 0%, #059669 100%); }

.hc-body {
  flex: 1;
  min-width: 0;
}

.hc-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 2px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.hc-badge {
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: #EF4444;
  color: #fff;
  font-size: 11px;
  line-height: 18px;
  text-align: center;
  font-weight: 600;
}

.hc-desc {
  font-size: 12px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.hc-arrow {
  flex-shrink: 0;
}

@media (max-width: 980px) {
  .hero-stats {
    display: none;
  }
  .home-overview {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
