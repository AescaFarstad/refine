<template>
  <div v-if="visible" class="maze-transmutation-menu">
    <div class="transmutation-panel">
      <div class="transmutation-header">TRANSMUTATION</div>
      <div class="transmutation-body" />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  visible: boolean;
}>();
</script>

<style scoped>
.maze-transmutation-menu {
  position: absolute;
  right: 12px;
  top: 12px;
  z-index: 14;
  pointer-events: auto;
}

.transmutation-panel {
  border: none;
  border-radius: 4px;
  background: var(--panel-bg);
  color: rgba(226, 232, 240, 0.95);
  padding: 0;
  min-width: 320px;
}

.transmutation-header {
  font-size: 14px;
  letter-spacing: 0.04em;
  color: rgba(226, 232, 240, 0.95);
  background: var(--panel-bg);
  border-radius: 8px;
  padding: 10px 16px;
  margin-bottom: 6px;
}

.transmutation-body {
  min-height: 120px;
  background: var(--panel-bg);
  border-radius: 8px;
}
</style>
