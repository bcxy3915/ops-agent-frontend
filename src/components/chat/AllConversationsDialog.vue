<template>
    <el-dialog v-model="visible" width="820px" :show-close="false" align-center class="all-conv-dialog" top="5vh">
        <!-- 自定义头部 -->
        <template #header>
            <div class="dialog-header">
                <span class="header-title">历史会话</span>
                <button class="close-btn" @click="visible = false">
                    <el-icon>
                        <Close />
                    </el-icon>
                </button>
            </div>
        </template>

        <!-- 搜索框 -->
        <div class="search-wrap">
            <el-input v-model="keyword" placeholder="搜索历史会话" :prefix-icon="Search" clearable size="large" />
        </div>

        <!-- 会话列表（按分组显示） -->
        <div class="conv-scroll">
            <template v-for="group in filteredGroups" :key="group.label">
                <div class="conv-group">
                    <div class="conv-group-label">{{ group.label }}</div>

                    <div v-for="item in group.items" :key="item.sessionId" class="conv-item"
                        @click="handleSelect(item.sessionId)">
                        <div class="conv-item-main">
                            <div class="conv-item-title">{{ item.title || '新对话' }}</div>
                            <div class="conv-item-meta">
                                <span>{{ item.messageCount || 0 }} 条消息</span>
                            </div>
                        </div>
                        <div class="conv-item-time">{{ formatTime(item.lastActiveAt) }}</div>
                    </div>
                </div>
            </template>

            <!-- 空状态 -->
            <div v-if="filteredGroups.length === 0" class="conv-empty">
                <el-empty :description="keyword ? '没有匹配的会话' : '暂无历史会话'" />
            </div>
        </div>
    </el-dialog>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Search, Close } from '@element-plus/icons-vue'
import { useChatStore } from '@/stores/chat'
import { groupConversations, formatConversationTime } from '@/utils/conversation'

const props = defineProps({
    modelValue: { type: Boolean, default: false }
})

const emit = defineEmits(['update:modelValue'])

const visible = computed({
    get: () => props.modelValue,
    set: (val) => emit('update:modelValue', val)
})

const router = useRouter()
const chatStore = useChatStore()

const keyword = ref('')

/**
 * 分组 + 搜索过滤
 *  - 先按时间分组
 *  - 再按 keyword 过滤（标题模糊匹配）
 */
const filteredGroups = computed(() => {
    let list = chatStore.conversations

    // 搜索过滤
    if (keyword.value.trim()) {
        const kw = keyword.value.toLowerCase()
        list = list.filter((c) =>
            (c.title || '').toLowerCase().includes(kw)
        )
    }

    return groupConversations(list)
})

/**
 * 格式化时间（复用侧边栏的工具函数）
 */
function formatTime(iso) {
    return formatConversationTime(iso)
}

/**
 * 选择会话：加载消息 + 关闭弹窗 + 跳转
 */
async function handleSelect(sessionId) {
    await chatStore.loadConversation(sessionId)
    visible.value = false
    if (router.currentRoute.value.path !== '/chat') {
        router.push('/chat')
    }
}
</script>

<style scoped>
/* 头部 */
.dialog-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 0;
}

.header-title {
    font-size: 17px;
    font-weight: 600;
    color: var(--text-primary);
}

.close-btn {
    width: 32px;
    height: 32px;
    border: none;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s;
}

.close-btn:hover {
    background: rgba(30, 64, 175, 0.06);
    color: var(--text-primary);
}

/* 搜索框 */
.search-wrap {
    margin-bottom: 20px;
}

.search-wrap :deep(.el-input__wrapper) {
    border-radius: 10px;
    box-shadow: 0 0 0 1px var(--border) inset;
    background: #F8FAFC;
}

.search-wrap :deep(.el-input__wrapper.is-focus) {
    box-shadow: 0 0 0 1px var(--primary) inset;
    background: white;
}

/* 滚动区 */
.conv-scroll {
    max-height: 65vh;
    overflow-y: auto;
    padding-right: 8px;
}

/* 分组 */
.conv-group {
    margin-bottom: 24px;
}

.conv-group-label {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-muted);
    margin-bottom: 8px;
    padding-left: 4px;
}

/* 单项 */
.conv-item {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    padding: 14px 16px;
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.15s;
    margin-bottom: 2px;
}

.conv-item:hover {
    background: rgba(30, 64, 175, 0.05);
}

.conv-item-main {
    flex: 1;
    min-width: 0;
}

.conv-item-title {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-primary);
    margin-bottom: 4px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.conv-item-meta {
    font-size: 12px;
    color: var(--text-muted);
}

.conv-item-time {
    font-size: 12px;
    color: var(--text-muted);
    flex-shrink: 0;
    padding-top: 2px;
}

/* 空状态 */
.conv-empty {
    padding: 40px 0;
}

/* 弹窗样式覆盖 */
:deep(.el-dialog) {
    border-radius: 16px;
    padding: 20px 24px 24px;
}

:deep(.el-dialog__header) {
    padding: 0 0 16px;
    margin-right: 0;
}

:deep(.el-dialog__body) {
    padding: 0;
}
</style>