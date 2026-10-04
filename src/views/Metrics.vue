<template>
  <div class="page">
    <header class="page-header">
      <h2>指标监控</h2>
      <span class="page-hint">P5-7 会实现 ECharts 图表</span>
    </header>
    <div class="page-body">
      <el-empty description="对话主界面待实现" />
    </div>
  </div>
</template>

<style scoped>
.page {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: transparent;
}

.page-header {
  height: 60px;
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(24px) saturate(180%);
  border-bottom: 1px solid rgba(226, 232, 240, 0.6);
  display: flex;
  align-items: center;
  padding: 0 24px;
  gap: 12px;
}

.page-header h2 {
  font-size: 15px;
  font-weight: 600;
}

.page-hint {
  font-size: 12px;
  color: var(--text-muted);
}

.page-body {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>