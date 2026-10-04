<template>
    <div class="page">
      <header class="page-header">
        <h2>服务管理</h2>
        <span class="page-hint">P5-5 会实现服务列表</span>
      </header>
      <div class="page-body">
        <el-empty description="服务管理页面待实现" />
      </div>
    </div>
  </template>
  
  <style scoped>
  /* 和 Chat.vue 相同 */
  .page { height: 100%; display: flex; flex-direction: column; }
  .page-header {
    height: 60px;
    background: rgba(255, 255, 255, 0.72);
    backdrop-filter: blur(24px) saturate(180%);
    border-bottom: 1px solid rgba(226, 232, 240, 0.6);
    display: flex; align-items: center; padding: 0 24px; gap: 12px;
  }
  .page-header h2 { font-size: 15px; font-weight: 600; }
  .page-hint { font-size: 12px; color: var(--text-muted); }
  .page-body { flex: 1; display: flex; align-items: center; justify-content: center; }
  </style>