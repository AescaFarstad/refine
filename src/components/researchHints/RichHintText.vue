<template>
  <template v-for="(line, li) in lines" :key="li">
    <br v-if="li > 0" />
    <template v-for="(seg, si) in line" :key="si">
      <span v-if="seg.type === 'text'">{{ seg.value }}</span>
      <span v-else-if="seg.type === 'gear_upgradebutton'" class="inline-upgrade-btn">+</span>
    </template>
  </template>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ text: string }>();

interface Segment { type: 'text' | 'gear_upgradebutton'; value: string }

const TOKEN_RE = /\[gear_upgradebutton\]/g;

function parseLine(raw: string): Segment[] {
  const segs: Segment[] = [];
  let last = 0;
  for (const m of raw.matchAll(TOKEN_RE)) {
    if (m.index > last) segs.push({ type: 'text', value: raw.slice(last, m.index) });
    segs.push({ type: 'gear_upgradebutton', value: '' });
    last = m.index + m[0].length;
  }
  if (last < raw.length) segs.push({ type: 'text', value: raw.slice(last) });
  return segs;
}

const lines = computed(() => props.text.split('\n').map(parseLine));
</script>

<style scoped>
.inline-upgrade-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 18px;
  font-size: 13px;
  font-weight: 900;
  background: rgba(34, 197, 94, 0.18);
  color: #86efac;
  border: 1px solid rgba(34, 197, 94, 0.35);
  border-radius: 3px;
  vertical-align: middle;
  line-height: 1;
}
</style>
