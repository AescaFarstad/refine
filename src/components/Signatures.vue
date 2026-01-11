<template>
  <div class="signatures">
    <div class="signatures-grid">
      <div
        v-for="sig in signaturesForLevel"
        :key="sig.id"
        class="sig-entry"
        :class="{ incomplete: !isCompleted(sig.id) }"
      >
        <canvas
          class="sig-canvas"
          width="80"
          height="65"
          :ref="(el) => setCanvasRef(sig.id, el as HTMLCanvasElement | null)"
        />
        <div class="sig-name">{{ sig.name }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, watch } from 'vue';
import type { SignatureDefinition, SignatureMolecule } from '../logic/SignatureLib';
import { uiState } from '../logic/UIState';
import { axialToPixel } from '../logic/HexMath';
import { clearCanvas, drawHexagon } from '../logic/DrawHex';

const canvases = new Map<string, HTMLCanvasElement>();

function setCanvasRef(id: string, el: HTMLCanvasElement | null): void {
  if (!el) {
    canvases.delete(id);
    return;
  }
  canvases.set(id, el);
}

const signaturesForLevel = computed<SignatureDefinition[]>(() => {
  const lib = uiState.lib!;
  const level = uiState.signatureLevel;
  const arr = Array.from(lib.signatures.values()).filter(s => s.level === level);
  arr.sort((a, b) => (a.group === b.group ? a.name.localeCompare(b.name) : a.group.localeCompare(b.group)));
  return arr;
});

const completedIdSet = computed(() => new Set(uiState.completedSignatureIds));

function isCompleted(id: string): boolean {
  return completedIdSet.value.has(id);
}

function getEssenceColor(essence: string): string {
  const colors: Record<string, string> = {
    red: '#ff4444',
    blue: '#4444ff',
    green: '#44ff44',
    yellow: '#ffdd44',
    indigo: '#4b0082',
    crimson: '#dc143c',
    emerald: '#50c878',
    gold: '#ffd700',
    gray: '#9ca3af',
    orange: '#fb923c',
    cyan: '#00ffff',
    magenta: '#ff00ff',
  };
  return colors[essence] || '#888888';
}

function drawSignatureMolecule(
  ctx: CanvasRenderingContext2D,
  molecule: SignatureMolecule,
  canvasW: number,
  canvasH: number,
  completed: boolean,
): void {
  clearCanvas(ctx);

  const baseHexSize = 11;
  const margin = 10;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const atom of molecule.atoms) {
    const p = axialToPixel({ x: atom.x, y: atom.y }, baseHexSize, { x: 0, y: 0 });
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }

  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);
  const scale = Math.min(
    (canvasW - margin * 2) / (spanX + baseHexSize * 2),
    (canvasH - margin * 2) / (spanY + baseHexSize * 2),
  );

  const hexSize = Math.max(8, baseHexSize * scale);
  const origin = {
    x: canvasW / 2 - (minX + maxX) / 2 * scale,
    y: canvasH / 2 - (minY + maxY) / 2 * scale,
  };

  for (const atom of molecule.atoms) {
    const center = axialToPixel({ x: atom.x, y: atom.y }, hexSize, origin);
    const essenceColor = getEssenceColor(atom.color);
    const radiusFactor = completed ? 0.82 : 0.58;
    drawHexagon(ctx, center, hexSize * radiusFactor, {
      fillColor: completed ? essenceColor : undefined,
      strokeColor: completed ? 'rgba(15, 23, 42, 0.9)' : essenceColor,
      lineWidth: 2,
    });
  }
}

function renderAll(): void {
  for (const sig of signaturesForLevel.value) {
    const canvas = canvases.get(sig.id);
    if (!canvas) continue;
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;
    drawSignatureMolecule(ctx, sig.molecule, canvas.width, canvas.height, isCompleted(sig.id));
  }
}

const stop = watch(
  () => [uiState.signatureLevel, uiState.completedSignatureIds, signaturesForLevel.value.length],
  async () => {
    await nextTick();
    renderAll();
  },
  { deep: true, immediate: true }
);

onMounted(async () => {
  await nextTick();
  renderAll();
});

onUnmounted(() => {
  stop();
  canvases.clear();
});
</script>

<style scoped>
.signatures {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.signatures-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

.title {
  font-weight: 700;
  letter-spacing: 0.02em;
}

.sub {
  color: var(--text-secondary);
  font-size: 12px;
}

.signatures-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, 80px);
  gap: 10px;
  justify-content: start;
}

.sig-entry {
  display: grid;
  grid-template-rows: auto auto;
  gap: 8px;
  justify-items: center;
  width: 80px;
}

.sig-canvas {
  width: 80px;
  height: 65px;
  display: block;
}

.sig-name {
  text-align: center;
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.1;
}
</style>
