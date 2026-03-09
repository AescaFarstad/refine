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
import { axialToPixel } from '../logic/HexMath';
import { type Point2 } from '../logic/core/math';
import { getOracleWaferCells, getOracleWaferCellKey, type OracleSealCellColors } from '../logic/Oracle';
import { ESSENCE_COLORS } from '../logic/RenderConstants';

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

const SEAL_HEX_SIZE = 16;
const SEAL_STROKE_PADDING = 2;

const markerKeySet = computed(() => new Set(props.markerKeys));

const sealSvg = computed(() => {
  const centers = getOracleWaferCells().map((point) => axialToPixel(point, SEAL_HEX_SIZE));
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const center of centers) {
    for (const corner of hexCorners(center)) {
      if (corner.x < minX) minX = corner.x;
      if (corner.y < minY) minY = corner.y;
      if (corner.x > maxX) maxX = corner.x;
      if (corner.y > maxY) maxY = corner.y;
    }
  }

  return {
    minX,
    minY,
    width: maxX - minX + SEAL_STROKE_PADDING * 2,
    height: maxY - minY + SEAL_STROKE_PADDING * 2,
  };
});

const waferCells = computed(() => {
  return getOracleWaferCells().map((point) => {
    const center = axialToPixel(point, SEAL_HEX_SIZE);
    const shiftedCenter = {
      x: center.x - sealSvg.value.minX + SEAL_STROKE_PADDING,
      y: center.y - sealSvg.value.minY + SEAL_STROKE_PADDING,
    };

    return {
      key: getOracleWaferCellKey(point),
      center: shiftedCenter,
      points: hexCorners(shiftedCenter).map((corner) => `${corner.x},${corner.y}`).join(' '),
    };
  });
});

function hexCorners(center: Point2): Point2[] {
  const points: Point2[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = ((60 * i) - 30) * (Math.PI / 180);
    points.push({
      x: center.x + SEAL_HEX_SIZE * Math.cos(angle),
      y: center.y + SEAL_HEX_SIZE * Math.sin(angle),
    });
  }
  return points;
}

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
