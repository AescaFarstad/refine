<template>
  <div v-if="visible" class="maze-nexus-menu">
    <div class="nexus-panel">
      <div class="nexus-title">Maze Nexus</div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  visible: boolean;
}>();
</script>

<style scoped>
.maze-nexus-menu {
  position: absolute;
  right: 12px;
  top: 12px;
  z-index: 14;
  pointer-events: auto;
}

.nexus-panel {
  border: 1px solid rgba(148, 163, 184, 0.7);
  border-radius: 4px;
  background: rgba(15, 23, 42, 0.9);
  color: rgba(226, 232, 240, 0.95);
  padding: 8px 14px;
  min-width: 200px;
}

.nexus-title {
  font-size: 14px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: rgba(226, 232, 240, 0.95);
}
</style>
