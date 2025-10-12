<template>
  <div class="refinery panel" :class="{ selected }" @click="$emit('select')">
    <div class="header">
      <span class="title">Refinery {{ index + 1 }}</span>
      <span class="status" :class="{ on: hasRecipe }">{{ hasRecipe ? 'Loaded' : 'Idle' }}</span>
    </div>
    <div class="stats">
      <div class="bar">
        <div class="fill" :style="{ width: `${Math.max(0, Math.min(100, health))}%` }" />
      </div>
      <span class="health">{{ health }}%</span>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ index: number; health: number; hasRecipe: boolean; selected?: boolean }>();
defineEmits<{ (e: 'select'): void }>();
</script>

<style scoped>
.refinery { cursor: pointer; min-width: 200px; }
.refinery.selected { outline: 2px solid var(--accent); }
.header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.title { font-weight: 700; letter-spacing: 0.04em; opacity: 0.95; }
.status { font-size: 12px; opacity: 0.8; }
.status.on { color: var(--accent); opacity: 1; }
.stats { display: flex; align-items: center; gap: 8px; }
.bar { position: relative; height: 8px; background: rgba(255,255,255,0.06); border: 1px solid var(--panel-border); border-radius: 3px; overflow: hidden; flex: 1; }
.fill { position: absolute; inset: 0; width: 0; background: linear-gradient(90deg, var(--accent), var(--accent-hover)); }
.health { font-size: 12px; opacity: 0.9; width: 40px; text-align: right; }
</style>

