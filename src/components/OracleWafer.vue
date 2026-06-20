<template>
  <svg
    class="seal-svg"
    :viewBox="`0 0 ${sealSvg.width} ${sealSvg.height}`"
    :style="{ width: `${sealSvg.width}px`, height: `${sealSvg.height}px` }"
  >
    <g v-for="cell in waferCells" :key="cell.key">
      <polygon
        class="seal-cell"
        :class="{ active: !!cellColors[cell.key], interactive: interactive }"
        :points="cell.points"
        :fill="sealCellFill(cell.key)"
        :stroke="sealCellStroke(cell.key)"
        @click="onToggleCell(cell.key)"
      />
      <text
        v-if="markerKeySet.has(cell.key)"
        class="seal-marker"
        :x="cell.center.x"
        :y="cell.center.y"
      >
        x
      </text>
    </g>
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { type OracleSealCellColors } from '../logic/Oracle';
import { ESSENCE_COLORS } from '../logic/RenderConstants';
import { oracleWaferSvg as sealSvg, oracleWaferVisualCells as waferCells } from './OracleWaferGeometry';

const props = withDefaults(defineProps<{
  cellColors: Readonly<OracleSealCellColors>;
  markerKeys?: readonly string[];
  interactive?: boolean;
}>(), {
  markerKeys: () => [],
  interactive: true,
});

const emit = defineEmits<{
  toggleCell: [key: string];
}>();

const markerKeySet = computed(() => new Set(props.markerKeys));

function sealCellFill(key: string): string {
  const color = props.cellColors[key];
  if (!color) return 'rgba(15, 23, 42, 0.74)';
  return ESSENCE_COLORS[color];
}

function sealCellStroke(key: string): string {
  return props.cellColors[key] ? 'rgba(248, 250, 252, 0.72)' : 'rgba(148, 163, 184, 0.34)';
}

function onToggleCell(key: string) {
  if (!props.interactive) return;
  emit('toggleCell', key);
}
</script>

<style scoped>
.seal-svg {
  display: block;
  overflow: visible;
}

.seal-cell {
  stroke-width: 1.5;
  transition: fill 120ms ease, stroke 120ms ease, filter 120ms ease;
}

.seal-cell.interactive {
  cursor: pointer;
}

.seal-cell.interactive:hover {
  filter: brightness(1.12);
  stroke: rgba(248, 250, 252, 0.88);
}

.seal-cell.active {
  stroke-width: 2;
}

.seal-marker {
  fill: rgba(255, 245, 245, 0.96);
  font-size: 16px;
  font-weight: 800;
  text-anchor: middle;
  dominant-baseline: central;
  pointer-events: none;
  stroke: rgba(127, 29, 29, 0.9);
  stroke-width: 0.8px;
  paint-order: stroke fill;
}
</style>
