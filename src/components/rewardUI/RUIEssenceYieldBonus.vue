<template>
  <div class="modal-backdrop">
    <div class="modal">
      <div class="modal-body">
        <div class="essence-display">
          <span class="essence-icon" :style="essenceStyle" />
        </div>
        <p class="description-text">
          <span class="essence-name" :style="{ color: accentColor }">{{ colorLabel }}</span>
          essence gains an additional property:
          <span class="bonus-value">+{{ bonusPct }}% yield</span>
        </p>
      </div>
      <footer class="modal-actions">
        <button class="btn primary" @click="close">OK</button>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import atlasStorage from '../../logic/AtlasStorage';
import type { Reward } from '../../logic/Reward';
import { ESSENCE_COLORS } from '../../logic/RenderConstants';

const props = defineProps<{
  params: { bonusPct: number; color: string };
}>();

const emit = defineEmits<{
  close: [rewards?: Reward[]]
}>();

const color = computed(() => props.params.color);
const bonusPct = computed(() => props.params.bonusPct);
const colorLabel = computed(() => color.value[0].toUpperCase() + color.value.slice(1));
const accentColor = computed(() => ESSENCE_COLORS[color.value] || '#ffffff');

const source = atlasStorage.getItemsSource()!;

const essenceStyle = computed(() => {
  const f = atlasStorage.getItemsFrame(color.value)!;
  const targetSize = 42;
  const scale = Math.min(targetSize / f.w, targetSize / f.h, 1);
  const displayW = f.w * scale;
  const displayH = f.h * scale;
  const atlasW = source.naturalWidth;
  const atlasH = source.naturalHeight;
  return {
    width: displayW + 'px',
    height: displayH + 'px',
    backgroundImage: `url(${source.src})`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: `-${f.x * scale}px -${f.y * scale}px`,
    backgroundSize: `${atlasW * scale}px ${atlasH * scale}px`,
  };
});

function close() {
  emit('close');
}
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2vh 2vw;
  z-index: 10000;
  overflow: hidden;
}

.modal {
  max-width: 96vw;
  min-width: 320px;
  background: linear-gradient(180deg, rgba(20, 28, 40, 0.98), rgba(10, 15, 26, 0.94));
  border: 1px solid var(--panel-border);
  border-radius: 6px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.7), inset 0 1px 0 var(--panel-shine);
  padding: 16px 18px;
}

.modal-body {
  min-height: 90px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
}

.essence-display {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 48px;
}

.essence-icon {
  display: inline-block;
}

.description-text {
  text-align: center;
  color: var(--text-secondary);
  margin: 0;
  font-size: 0.95rem;
  line-height: 1.6;
}

.essence-name {
  font-weight: 700;
  margin-right: 4px;
}

.bonus-value {
  color: var(--accent);
  font-weight: 700;
  text-shadow: 0 0 6px var(--accent);
  margin-left: 4px;
}

.modal-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 14px;
}

.btn {
  padding: 10px 14px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  border-radius: 4px;
  border: 1px solid var(--panel-border);
  cursor: pointer;
  background: rgba(255, 255, 255, 0.03);
  color: inherit;
}

.btn:hover {
  background: rgba(255, 255, 255, 0.08);
}

.btn.primary {
  background: rgba(79, 209, 197, 0.14);
  color: var(--accent);
}

.btn.primary:hover {
  background: rgba(79, 209, 197, 0.22);
}
</style>
