<template>
  <svg
    class="oracle-wafer-animation"
    :viewBox="`0 0 ${oracleWaferSvg.width} ${oracleWaferSvg.height}`"
    :style="{ width: `${oracleWaferSvg.width}px`, height: `${oracleWaferSvg.height}px` }"
    aria-hidden="true"
  >
    <defs>
      <filter id="oracle-wave-glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="2.2" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>

    <g filter="url(#oracle-wave-glow)">
      <template v-for="cell in animatedCells" :key="cell.key">
        <polygon
          v-if="cell.cyanIntensity > 0.01"
          :points="cell.points"
          fill="#67e8f9"
          :fill-opacity="cell.cyanIntensity * 0.34"
          stroke="#a5f3fc"
          :stroke-opacity="cell.cyanIntensity * 0.9"
          :stroke-width="1 + cell.cyanIntensity * 1.5"
        />
        <circle
          v-if="cell.sparkIntensity > 0.01"
          :cx="cell.center.x"
          :cy="cell.center.y"
          :r="2 + cell.sparkIntensity * 3"
          fill="#ecfeff"
          :fill-opacity="cell.sparkIntensity * 0.9"
        />
      </template>
    </g>
    <g>
      <polygon
        v-for="cell in coloredWaveCells"
        :key="cell.key"
        :points="cell.points"
        fill="none"
        :stroke="cell.secondaryColor"
        :stroke-opacity="cell.secondaryIntensity * 0.8"
        :stroke-width="0.8 + cell.secondaryIntensity * 0.8"
      />
    </g>
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { OracleSealCellColors } from '../logic/Oracle';
import { ESSENCE_COLORS } from '../logic/RenderConstants';
import type { Point2 } from '../logic/core/math';
import { oracleWaferSvg, oracleWaferVisualCells } from './OracleWaferGeometry';

const props = defineProps<{
  elapsedMs: number;
  success: boolean;
  cellColors: Readonly<OracleSealCellColors>;
}>();

const corners = [
  { x: 4, y: 0 },
  { x: 0, y: 4 },
  { x: -4, y: 4 },
  { x: -4, y: 0 },
  { x: 0, y: -4 },
  { x: 4, y: -4 },
];

for (let i = corners.length - 1; i > 0; i--) {
  const swapIndex = Math.floor(Math.random() * (i + 1));
  [corners[i], corners[swapIndex]] = [corners[swapIndex]!, corners[i]!];
}

const waveSources = corners.slice(0, 5).map((point, index) => ({
  point,
  delay: index * 0.1,
}));

function smoothstep(from: number, to: number, value: number): number {
  const normalized = Math.max(0, Math.min(1, (value - from) / (to - from)));
  return normalized * normalized * (3 - 2 * normalized);
}

function waveEnvelope(distance: number, front: number): number {
  const age = front - distance;
  if (age < 0) return 0;
  if (age < 0.45) return smoothstep(0, 0.45, age);
  if (age < 0.9) return 1;
  return 1 - smoothstep(0.9, 1.9, age);
}

function waveDistance(a: Point2, b: Point2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dx * dy + dy * dy);
}

function sourceArrival(x: number, y: number): number {
  let arrival = Number.POSITIVE_INFINITY;
  for (const source of waveSources) {
    const distance = waveDistance(source.point, { x, y });
    arrival = Math.min(arrival, source.delay + distance / 12);
  }
  return arrival;
}

const filledSources = computed(() => oracleWaferVisualCells.flatMap((cell) => {
  const color = props.cellColors[cell.key];
  if (!color) return [];
  return [{
    point: cell.point,
    color: ESSENCE_COLORS[color],
    activation: sourceArrival(cell.point.x, cell.point.y),
  }];
}));

const animatedCells = computed(() => {
  const waveProgress = props.elapsedMs / 2000;
  const resolution = props.success
    ? smoothstep(2000, 3000, props.elapsedMs)
    : 0;
  const waveFade = props.success ? 1 - resolution * 0.82 : 1;

  return oracleWaferVisualCells.map((cell) => {
    let cyanIntensity = 0;
    for (const source of waveSources) {
      if (waveProgress < source.delay) continue;
      const front = (waveProgress - source.delay) * 12;
      const distance = waveDistance(source.point, cell.point);
      cyanIntensity = Math.max(cyanIntensity, waveEnvelope(distance, front));
    }

    let secondaryIntensity = 0;
    let secondaryColor = '#67e8f9';
    for (const source of filledSources.value) {
      const front = (waveProgress - source.activation) * 10;
      if (front < 0) continue;
      const intensity = waveEnvelope(waveDistance(source.point, cell.point), front);
      if (intensity <= secondaryIntensity) continue;
      secondaryIntensity = intensity;
      secondaryColor = source.color;
    }

    const isFilled = props.cellColors[cell.key] != null;
    const successLock = props.success && isFilled ? resolution * 0.72 : 0;
    const sparkIntensity = isFilled
      ? Math.max(0, cyanIntensity - 0.45) * (1 - resolution) + successLock * 0.55
      : 0;

    return {
      ...cell,
      cyanIntensity: Math.max(cyanIntensity * waveFade, successLock),
      secondaryIntensity: secondaryIntensity * waveFade,
      secondaryColor,
      sparkIntensity,
    };
  });
});

const coloredWaveCells = computed(() => animatedCells.value.filter(cell => cell.secondaryIntensity > 0.06));
</script>

<style scoped>
.oracle-wafer-animation {
  position: absolute;
  inset: 0;
  display: block;
  overflow: visible;
  pointer-events: none;
}
</style>
