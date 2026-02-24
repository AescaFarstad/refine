<template>
  <div class="placement-template-wrap">
    <svg
      class="placement-template-wafer"
      :viewBox="wafer.viewBox"
    >
      <g
        v-for="cell in wafer.cells"
        :key="cell.key"
        class="placement-template-cell"
        @click.stop="toggle(cell.cell)"
      >
        <polygon
          :points="cell.points"
          :class="{ active: selectedSet.has(cell.key) }"
        />
      </g>
    </svg>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { axialToPixel } from '../logic/HexMath';
import { UNIT_HEX_POINTS } from '../logic/DrawHex';
import type { Point2 } from '../logic/ItemLib';
import {
  RESEARCH_PLACEMENT_TEMPLATE_CELLS,
  researchPlacementTemplateCellKey,
} from '../logic/researchPlacementTemplate';

type WaferSvgCell = {
  key: string;
  cell: Point2;
  points: string;
};

const model = defineModel<Point2[]>({ required: true });

const selectedSet = computed(() => {
  const s = new Set<string>();
  for (const cell of model.value) {
    s.add(researchPlacementTemplateCellKey(cell));
  }
  return s;
});

const wafer = (() => {
  const hexSize = 7;
  const padding = 2;
  const cells: WaferSvgCell[] = [];
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const cell of RESEARCH_PLACEMENT_TEMPLATE_CELLS) {
    const center = axialToPixel(cell, hexSize);
    const points = UNIT_HEX_POINTS.map((corner) => {
      const x = center.x + corner.x * hexSize;
      const y = center.y + corner.y * hexSize;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      return `${x},${y}`;
    }).join(' ');

    cells.push({
      key: researchPlacementTemplateCellKey(cell),
      cell: { x: cell.x, y: cell.y },
      points,
    });
  }

  const viewBox = `${minX - padding} ${minY - padding} ${maxX - minX + padding * 2} ${maxY - minY + padding * 2}`;
  return { viewBox, cells };
})();

function toggle(cell: Point2): void {
  const selected = new Set(selectedSet.value);
  const key = researchPlacementTemplateCellKey(cell);
  if (selected.has(key)) {
    selected.delete(key);
  } else {
    selected.add(key);
  }

  const next: Point2[] = [];
  for (const allowedCell of RESEARCH_PLACEMENT_TEMPLATE_CELLS) {
    const allowedKey = researchPlacementTemplateCellKey(allowedCell);
    if (!selected.has(allowedKey)) continue;
    next.push({ x: allowedCell.x, y: allowedCell.y });
  }
  model.value = next;
}
</script>

<style scoped>
.placement-template-wrap {
  position: absolute;
  top: 0;
  right: 0;
}

.placement-template-label {
  opacity: 0.75;
  font-weight: 600;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.placement-template-wafer {
  width: 74px;
  height: 56px;
  display: block;
}

.placement-template-cell {
  cursor: pointer;
}

.placement-template-cell polygon {
  fill: rgba(15, 23, 42, 0.9);
  stroke: rgba(148, 163, 184, 0.7);
  stroke-width: 1.1;
}

.placement-template-cell polygon.active {
  fill: rgba(56, 189, 248, 0.32);
  stroke: rgba(125, 211, 252, 0.98);
}
</style>
