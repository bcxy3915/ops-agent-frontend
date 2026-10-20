<template>
  <div class="page">
    <!-- ========== 页头 ========== -->
    <div class="page-header">
      <div class="page-header-left">
        <h2 class="page-title">管理后台</h2>
        <span class="page-subtitle">服务、指标、告警、知识库与系统设置统一管理</span>
      </div>
      <div class="page-header-actions">
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
          <span class="hero-tag" v-if="isAdmin">审计 · 用户</span>
        </div>
      </div>
      <div class="hero-badge">
        <div class="hero-badge-icon">
          <el-icon>
            <Monitor />
          </el-icon>
        </div>
      </div>
    </div>

    <!-- ========== 分组卡片入口 ========== -->
    <div class="home-groups">
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
              <div class="hc-desc">注册、检查与维护服务实例</div>
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
              <div class="hc-desc">系统资源与服务指标大盘</div>
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
              <div class="hc-desc">告警事件、诊断与处理跟踪</div>
            </div>
            <el-icon class="hc-arrow" color="#CBD5E1">
              <ArrowRight />
            </el-icon>
          </div>

          <div v-if="isOperator" class="home-card" @click="go('/admin/alert-rules')">
            <div class="hc-icon hc-slate">
              <el-icon>
                <SetUp />
              </el-icon>
            </div>
            <div class="hc-body">
              <div class="hc-title">告警规则</div>
              <div class="hc-desc">阈值触发与规则配置</div>
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
              <div class="hc-desc">文档、案例、检索与质检</div>
            </div>
            <el-icon class="hc-arrow" color="#CBD5E1">
              <ArrowRight />
            </el-icon>
          </div>
        </div>
      </div>

      <!-- 系统设置（仅管理员） -->
      <div v-if="isAdmin" class="home-group">
        <div class="home-group-label">系统设置</div>
        <div class="home-cards">
          <div class="home-card" @click="go('/admin/channels')">
            <div class="hc-icon hc-violet">
              <el-icon>
                <ChatDotRound />
              </el-icon>
            </div>
            <div class="hc-body">
              <div class="hc-title">通知渠道</div>
              <div class="hc-desc">邮件/Webhook 渠道配置与测试</div>
            </div>
            <el-icon class="hc-arrow" color="#CBD5E1">
              <ArrowRight />
            </el-icon>
          </div>

          <div class="home-card" @click="go('/admin/audit')">
            <div class="hc-icon hc-cyan">
              <el-icon>
                <Document />
              </el-icon>
            </div>
            <div class="hc-body">
              <div class="hc-title">审计日志</div>
              <div class="hc-desc">全量操作审计追踪</div>
            </div>
            <el-icon class="hc-arrow" color="#CBD5E1">
              <ArrowRight />
            </el-icon>
          </div>

          <div class="home-card" @click="go('/admin/users')">
            <div class="hc-icon hc-green">
              <el-icon>
                <User />
              </el-icon>
            </div>
            <div class="hc-body">
              <div class="hc-title">用户管理</div>
              <div class="hc-desc">账号、角色与权限</div>
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
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import {
  ArrowLeft, ArrowRight, Monitor, TrendCharts, Bell, SetUp,
  Collection, ChatDotRound, Document, User
} from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const isAdmin = computed(() => authStore.role === 'ADMIN')
const isOperator = computed(() => authStore.role === 'ADMIN' || authStore.role === 'OPERATOR')

function go(path) {
  router.push(path)
}

function goChat() {
  router.push('/chat')
}
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

/* ============ Hero ============ */
.admin-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 26px 28px;
  border-radius: 16px;
  background: linear-gradient(135deg, rgba(37, 99, 235, 0.9) 0%, rgba(30, 64, 175, 0.92) 100%);
  color: white;
  box-shadow: 0 8px 24px rgba(30, 64, 175, 0.22);
  margin-bottom: 28px;
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

/* ============ 分组卡片 ============ */
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
</style>
