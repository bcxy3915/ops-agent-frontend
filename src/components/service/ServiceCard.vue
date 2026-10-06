<template>
    <div class="service-card" :class="`status-${service.status?.toLowerCase()}`">
        <!-- 顶部：名称 + 状态 + 操作 -->
        <div class="card-head">
            <div class="card-title">
                <span class="service-name">{{ service.name }}</span>
                <StatusBadge :status="service.status" />
            </div>

            <el-dropdown trigger="click" @command="handleCommand">
                <button class="more-btn">
                    <el-icon>
                        <MoreFilled />
                    </el-icon>
                </button>
                <template #dropdown>
                    <el-dropdown-menu>
                        <el-dropdown-item command="check" :disabled="checking">
                            <el-icon>
                                <Refresh />
                            </el-icon>
                            {{ checking ? '检查中...' : '触发健康检查' }}
                        </el-dropdown-item>
                        <el-dropdown-item command="edit" v-if="canEdit">
                            <el-icon>
                                <Edit />
                            </el-icon>编辑
                        </el-dropdown-item>
                        <el-dropdown-item command="delete" divided v-if="canDelete">
                            <el-icon>
                                <Delete />
                            </el-icon>删除
                        </el-dropdown-item>
                    </el-dropdown-menu>
                </template>
            </el-dropdown>
        </div>

        <!-- 地址 -->
        <div class="card-url">
            <el-icon>
                <Link />
            </el-icon>
            <span>{{ service.baseUrl }}</span>
        </div>

        <!-- 元信息 -->
        <div class="card-meta">
            <div class="meta-item">
                <span class="meta-label">负责人</span>
                <span class="meta-value">{{ service.owner || '—' }}</span>
            </div>
            <div class="meta-item">
                <span class="meta-label">环境</span>
                <span class="meta-value">
                    <span class="env-tag" :class="`env-${service.env}`">{{ service.env }}</span>
                </span>
            </div>
            <div class="meta-item">
                <span class="meta-label">最后检查</span>
                <span class="meta-value">{{ relativeTime }}</span>
            </div>
        </div>
    </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { MoreFilled, Refresh, Edit, Delete, Link } from '@element-plus/icons-vue'
import StatusBadge from './StatusBadge.vue'
import { useAuthStore } from '@/stores/auth'

const props = defineProps({
    service: { type: Object, required: true }
})

const emit = defineEmits(['edit', 'delete', 'check'])

const authStore = useAuthStore()
const checking = ref(false)

// 权限
const canEdit = computed(() => authStore.isOperator)
const canDelete = computed(() => authStore.isAdmin)

// 相对时间
const relativeTime = computed(() => {
    if (!props.service.lastCheckedAt) return '未检查'
    const diff = Date.now() - new Date(props.service.lastCheckedAt).getTime()
    const sec = Math.floor(diff / 1000)
    if (sec < 60) return `${sec} 秒前`
    const min = Math.floor(sec / 60)
    if (min < 60) return `${min} 分钟前`
    const hour = Math.floor(min / 60)
    if (hour < 24) return `${hour} 小时前`
    return `${Math.floor(hour / 24)} 天前`
})

function handleCommand(cmd) {
    if (cmd === 'edit') emit('edit', props.service)
    else if (cmd === 'delete') emit('delete', props.service)
    else if (cmd === 'check') {
        checking.value = true
        emit('check', props.service, () => {
            checking.value = false
        })
    }
}
</script>

<style scoped>
.service-card {
    background: linear-gradient(180deg, #FFFFFF 0%, #FDFEFF 100%);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 18px 20px;
    transition: all 0.2s;
    box-shadow: var(--card-shadow);
    position: relative;
    overflow: hidden;
}

.service-card::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 3px;
    background: #CBD5E1;
}

.service-card.status-up::before {
    background: var(--success);
}

.service-card.status-down::before {
    background: var(--danger);
}

.service-card.status-unknown::before {
    background: var(--warning);
}

.service-card:hover {
    box-shadow: var(--card-shadow-hover);
    border-color: #D8DFE9;
    transform: translateY(-2px);
}

/* 顶部 */
.card-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
}

.card-title {
    display: flex;
    align-items: center;
    gap: 10px;
}

.service-name {
    font-size: 15px;
    font-weight: 600;
    color: var(--text-primary);
    font-family: ui-monospace, monospace;
}

.more-btn {
    width: 28px;
    height: 28px;
    border-radius: 6px;
    border: none;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s;
}

.more-btn:hover {
    background: rgba(30, 64, 175, 0.06);
    color: var(--primary);
}

/* 地址 */
.card-url {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: var(--text-secondary);
    font-family: ui-monospace, monospace;
    margin-bottom: 14px;
    padding: 8px 12px;
    background: rgba(241, 245, 249, 0.6);
    border-radius: 6px;
    word-break: break-all;
}

/* 元信息 */
.card-meta {
    display: flex;
    gap: 20px;
    font-size: 12.5px;
}

.meta-item {
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.meta-label {
    color: var(--text-muted);
    font-size: 11px;
}

.meta-value {
    color: var(--text-primary);
    font-weight: 500;
}

/* 环境标签 */
.env-tag {
    display: inline-block;
    padding: 1px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 500;
    font-family: ui-monospace, monospace;
}

.env-dev {
    background: #DBEAFE;
    color: #1E40AF;
}

.env-test {
    background: #FEF3C7;
    color: #B45309;
}

.env-prod {
    background: #FCE7F3;
    color: #BE185D;
}
</style>