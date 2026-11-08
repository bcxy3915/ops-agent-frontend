<template>
  <div class="app">
    <SidebarFrame v-slot="{ collapsed }"><Sidebar :collapsed="collapsed" /></SidebarFrame>
    <main class="main">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import Sidebar from './Sidebar.vue'
import SidebarFrame from './SidebarFrame.vue'
</script>

<style scoped>
.app { height: 100dvh; }
@media (max-width: 767px) { .app { flex-direction: column; } }
.main {
  min-height: 0;
  background: rgba(255, 255, 255, 0.35);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}
</style>
