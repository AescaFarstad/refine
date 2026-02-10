<template>
  <div class="mismatch-box">
    <p class="mismatch-line">
      First mismatch at index {{ mismatch.index }}. Total char differences: {{ mismatch.totalDifferences }}.
    </p>
    <p class="mismatch-line">
      {{ leftLabel }} char: <code>{{ mismatch.leftChar }}</code>
      {{ rightLabel }} char: <code>{{ mismatch.rightChar }}</code>
    </p>
    <p class="mismatch-label">{{ leftLabel }} context</p>
    <pre class="mismatch-context"><span class="mismatch-before">{{ mismatch.leftBefore }}</span><span class="mismatch-after">{{ mismatch.leftAfter }}</span></pre>
    <p class="mismatch-label">{{ rightLabel }} context</p>
    <pre class="mismatch-context"><span class="mismatch-before">{{ mismatch.rightBefore }}</span><span class="mismatch-after">{{ mismatch.rightAfter }}</span></pre>
    <slot name="actions" />
  </div>
</template>

<script setup lang="ts">
import type { SaveLoadMismatch } from '../logic/dev/TestSaveLoad';

defineProps<{
  mismatch: SaveLoadMismatch;
  leftLabel: string;
  rightLabel: string;
}>();
</script>

<style scoped>
.mismatch-box {
  border: 1px solid rgba(252, 165, 165, 0.55);
  background: rgba(120, 25, 25, 0.18);
  border-radius: 6px;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.mismatch-line {
  margin: 0;
  font-size: 12px;
  color: #fecaca;
}

.mismatch-label {
  margin: 0;
  font-size: 12px;
  color: #e2e8f0;
  font-weight: 700;
}

.mismatch-context {
  margin: 0;
  max-height: 100px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-all;
  font-size: 11px;
  line-height: 1.3;
  border-radius: 4px;
  padding: 6px;
  background: rgba(0, 0, 0, 0.25);
  color: #f8fafc;
}

.mismatch-before {
  color: #67e8f9;
}

.mismatch-after {
  color: #fcd34d;
}
</style>
