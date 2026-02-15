<template>
  <div class="maze-tab">
    <MazePane />
  </div>
</template>

<script setup lang="ts">
import MazePane from './MazePane.vue';
</script>

<style scoped>
.maze-tab {
  position: relative;
  width: 100%;
  height: 100%;
  background: radial-gradient(circle at 50% 0%, rgba(15, 23, 42, 0.9), #020617);
  overflow: hidden;
}

.maze-info {
  position: absolute;
  left: 12px;
  top: 12px;
  padding: 4px 10px;
  border: 1px solid var(--panel-border);
  border-radius: 4px;
  background: var(--panel-bg);
  color: var(--text-primary);
  font-size: 13px;
  z-index: 10;
  pointer-events: none;
}
</style>
