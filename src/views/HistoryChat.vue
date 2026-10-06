<template>
    <div class="history-container">
        <div class="history-view">
            <!-- 头部区域 -->
            <div class="history-header">
                <h2>历史会话</h2>
                <button class="close-btn" @click="goBackToChat">
                    <el-icon>
                        <Close />
                    </el-icon>
                </button>
            </div>

            <!-- 搜索框 -->
            <div class="history-search">
                <el-input v-model="searchQuery" placeholder="搜索历史会话" prefix-icon="Search" clearable />
            </div>

            <!-- 列表区域 -->
            <div class="history-list" :class="{ 'has-selected': selectedIds.length > 0 }">
                <div v-for="group in groupedConversations" :key="group.label" class="history-group">
                    <!-- 分组标题 -->
                    <div class="group-label">{{ group.label }}</div>

                    <!-- 卡片列表项 -->
                    <div v-for="conv in group.items" :key="conv.sessionId" class="history-item"
                        :class="{ 'selected': isSelected(conv.sessionId) }" @click="handleCardClick(conv)">
                        <!-- 左侧勾选圈（悬浮/选中时显示） -->
                        <div class="item-checkbox" @click.stop="toggleSelect(conv.sessionId)">
                            <div class="checkbox-circle" :class="{ 'checked': isSelected(conv.sessionId) }">
                                <el-icon v-if="isSelected(conv.sessionId)">
                                    <Check />
                                </el-icon>
                            </div>
                        </div>

                        <!-- 主体内容：标题与预览 -->
                        <div class="item-main">
                            <div class="item-title">{{ conv.title || '未命名会话' }}</div>
                            <div class="item-preview">
                                {{ conv.lastMessage || '暂无预览内容' }}
                            </div>
                        </div>

                        <!-- 右侧时间 -->
                        <div class="item-meta">
                            <span class="item-time">{{ formatTime(conv.updatedAt) }}</span>
                        </div>
                    </div>
                </div>

                <!-- 空状态 -->
                <div v-if="filteredConversations.length === 0" class="empty-state">
                    <el-empty description="暂无历史会话" :image-size="120" />
                </div>
            </div>
        </div>

        <!-- 底部批量操作栏（选中时出现） -->
        <div v-if="selectedIds.length > 0" class="bottom-action-bar">
            <div class="bar-content">
                <el-button text class="cancel-btn" @click="clearSelection">退出</el-button>
                <div class="selected-count">已选择 {{ selectedIds.length }} 个会话</div>
                <el-button type="danger" class="delete-btn" @click="batchDelete">
                    <el-icon class="mr-1">
                        <Delete />
                    </el-icon> 删除
                </el-button>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useChatStore } from '@/stores/chat';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Search, Close, Delete, Check } from '@element-plus/icons-vue';

const router = useRouter();
const chatStore = useChatStore();
const searchQuery = ref('');
const selectedIds = ref([]); // 存储被选中的 sessionId

// 过滤逻辑
const filteredConversations = computed(() => {
    let list = chatStore.conversations || [];
    if (searchQuery.value.trim()) {
        const q = searchQuery.value.toLowerCase();
        list = list.filter(c => (c.title || '').toLowerCase().includes(q));
    }
    return list;
});

// 分组逻辑（今天、7天内、更早）
const groupedConversations = computed(() => {
    const groups = { '今天': [], '近 7 天': [], '更早': [] };
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const sevenDaysAgo = todayStart - 7 * 24 * 60 * 60 * 1000;

    filteredConversations.value.forEach(conv => {
        const time = new Date(conv.updatedAt || conv.createdAt).getTime();
        if (time >= todayStart) groups['今天'].push(conv);
        else if (time >= sevenDaysAgo) groups['近 7 天'].push(conv);
        else groups['更早'].push(conv);
    });

    return Object.entries(groups)
        .filter(([_, items]) => items.length > 0)
        .map(([label, items]) => ({ label, items }));
});

// 时间格式化
function formatTime(timeStr) {
    if (!timeStr) return '';
    const date = new Date(timeStr);
    const now = new Date();
    if (date.toDateString() === now.toDateString()) {
        return date.toTimeString().slice(0, 5);
    }
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return '昨天';
    return `${date.getMonth() + 1}月${date.getDate()}日`;
}

// ==================== 批量选择逻辑 ====================

function isSelected(sessionId) {
    return selectedIds.value.includes(sessionId);
}

function toggleSelect(sessionId) {
    const idx = selectedIds.value.indexOf(sessionId);
    if (idx > -1) {
        selectedIds.value.splice(idx, 1);
    } else {
        selectedIds.value.push(sessionId);
    }
}

function clearSelection() {
    selectedIds.value = [];
}

// 点击卡片主体逻辑：选中状态下切换选择，非选中状态下进入对话
function handleCardClick(conv) {
    if (selectedIds.value.length > 0) {
        toggleSelect(conv.sessionId);
    } else {
        openConversation(conv.sessionId);
    }
}

// 批量删除
async function batchDelete() {
    try {
        await ElMessageBox.confirm(`确定要删除选中的 ${selectedIds.value.length} 个会话吗？`, '提示', {
            type: 'warning',
            confirmButtonText: '删除',
            cancelButtonText: '取消'
        });

        // 注意：如果后端不支持批量删除，这里循环调用单删接口
        for (const sessionId of selectedIds.value) {
            await chatStore.removeConversation(sessionId);
        }

        ElMessage.success('删除成功');
        clearSelection();
    } catch (e) {
        // 用户取消
    }
}

// ==================== 其他逻辑 ====================

async function openConversation(sessionId) {
    await chatStore.loadConversation(sessionId);
    router.push('/chat');
}

function goBackToChat() {
    router.push('/chat');
}
</script>

<style scoped>
/* 1. 整体容器 */
.history-container {
    width: 100%;
    height: 100%;
    overflow-y: auto;
    background-color: #FFFFFF;
    position: relative;
}

/* 2. 核心内容区：居中 */
.history-view {
    max-width: 900px;
    margin: 0 auto;
    padding: 40px 24px 100px 24px;
    /* 底部留出足够空间给底部操作栏 */
    box-sizing: border-box;
}

/* 头部 */
.history-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
}

.history-header h2 {
    font-size: 22px;
    font-weight: 600;
    color: #1F2329;
    margin: 0;
}

.close-btn {
    background: none;
    border: none;
    font-size: 18px;
    color: #8F959E;
    cursor: pointer;
    padding: 8px;
    border-radius: 6px;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
}

.close-btn:hover {
    background: #F2F3F5;
    color: #1F2329;
}

/* 搜索框 */
.history-search {
    margin-bottom: 32px;
}

.history-search :deep(.el-input__wrapper) {
    border-radius: 8px;
    background-color: #F2F3F5;
    box-shadow: none !important;
    border: 1px solid transparent;
    padding: 10px 16px;
    transition: all 0.2s;
}

.history-search :deep(.el-input__wrapper:hover) {
    background-color: #EAEBED;
}

.history-search :deep(.el-input__wrapper.is-focus) {
    background-color: #FFFFFF;
    border-color: #3370FF;
}

/* 分组标题 */
.history-group {
    margin-bottom: 24px;
}

.group-label {
    font-size: 13px;
    font-weight: 500;
    color: #8F959E;
    margin-bottom: 12px;
    padding-left: 12px;
}

/* ★ 3. 卡片列表项：默认灰色背景，对齐 Kimi 视觉 */
.history-item {
    display: flex;
    align-items: center;
    padding: 16px 20px;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s ease;
    margin-bottom: 8px;
    /* 增加卡片间距 */

    /* 核心修改：默认背景色改为浅灰，而不是纯白 */
    background-color: #F7F8FA;
    border: 1px solid transparent;
    /* 预占位，防止选中时跳动 */
    position: relative;
}

/* 悬浮时底色稍微加深 */
.history-item:hover {
    background-color: #EBEDF0;
}

/* 选中态卡片样式（浅蓝背景 + 蓝色边框） */
.history-item.selected {
    background-color: #F0F7FF;
    border-color: #D1E5FF;
}

.history-item.selected:hover {
    background-color: #E6F0FF;
}

/* 左侧勾选圈（默认透明不可见） */
.item-checkbox {
    margin-right: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    opacity: 0;
    transition: opacity 0.2s;
}

/* 悬浮时显示勾选圈，或者已选中时强制显示 */
.history-item:hover .item-checkbox,
.history-item.selected .item-checkbox {
    opacity: 1;
}

.checkbox-circle {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    border: 1.5px solid #C4C7CC;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
    color: white;
}

.checkbox-circle.checked {
    background-color: #3370FF;
    border-color: #3370FF;
    font-size: 12px;
}

/* 主体内容区 */
.item-main {
    flex: 1;
    min-width: 0;
}

.item-title {
    font-size: 15px;
    font-weight: 500;
    color: #1F2329;
    margin-bottom: 6px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

/* 预览内容两行截断 */
.item-preview {
    font-size: 13px;
    color: #8F959E;
    line-height: 1.5;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-overflow: ellipsis;
}

/* 右侧时间 */
.item-meta {
    flex-shrink: 0;
    margin-left: 24px;
}

.item-time {
    font-size: 12px;
    color: #8F959E;
    white-space: nowrap;
}

/* 4. 底部操作栏（悬浮固定） */
.bottom-action-bar {
    position: fixed;
    bottom: 32px;
    left: 50%;
    transform: translateX(-50%);
    background: #1F2329;
    color: #FFFFFF;
    padding: 8px 16px;
    border-radius: 999px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
    z-index: 100;
    animation: slideUp 0.3s ease-out;
}

@keyframes slideUp {
    from {
        opacity: 0;
        transform: translate(-50%, 16px);
    }

    to {
        opacity: 1;
        transform: translate(-50%, 0);
    }
}

.bar-content {
    display: flex;
    align-items: center;
    gap: 16px;
    white-space: nowrap;
}

.cancel-btn {
    color: #9CA3AF !important;
    font-size: 14px;
    padding: 0 8px;
}

.cancel-btn:hover {
    color: #FFFFFF !important;
    background: transparent !important;
}

.selected-count {
    font-size: 14px;
    color: #E5E7EB;
}

.delete-btn {
    background-color: #EF4444 !important;
    border-color: #EF4444 !important;
    color: white !important;
    border-radius: 999px !important;
    font-size: 13px !important;
    padding: 6px 16px !important;
    height: auto !important;
}

.delete-btn:hover {
    background-color: #DC2626 !important;
}

.mr-1 {
    margin-right: 4px;
}

/* 空状态调整 */
.empty-state {
    padding: 80px 0;
    text-align: center;
}
</style>