<template>
  <div class="stat-line">
    <div :class="['stat', hpFlashClass]"><span class="label">Health</span> <span class="value">{{ hp }} ❤︎</span></div>
    <div :class="['stat', damageFlashClass]"><span class="label">Damage</span> <span class="value">{{ damage }} ✴</span></div>
    <div :class="['stat', bagsFlashClass]"><span class="label">Bags</span> <span class="value">{{ bagsCapacity }} ⌞ ⌝</span></div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, type Ref } from 'vue';
import { uiState, getGameState } from '../logic/UIState';

const hp = computed(() => {
  uiState.raidKey;
  const gs = getGameState();
  return gs.raid.hp | 0;
});

const damage = computed(() => {
  uiState.raidKey;
  const gs = getGameState();
  return gs.raid.damage;
});

const bagsCapacity = computed(() => {
  uiState.raidKey;
  uiState.volume;
  const gs = getGameState();
  return Math.max(0, gs.raid.bagsVolume);
});

const hpFlashClass = ref('');
const damageFlashClass = ref('');
const bagsFlashClass = ref('');

const hpFlashTimeout = ref<number | null>(null);
const damageFlashTimeout = ref<number | null>(null);
const bagsFlashTimeout = ref<number | null>(null);

function triggerFlash(flashClass: Ref<string>, direction: 'up' | 'down', timeoutRef: Ref<number | null>): void {
  flashClass.value = '';
  requestAnimationFrame(() => {
    flashClass.value = direction === 'up' ? 'flash-up' : 'flash-down';
    if (timeoutRef.value !== null) {
      clearTimeout(timeoutRef.value);
    }
    timeoutRef.value = window.setTimeout(() => {
      flashClass.value = '';
      timeoutRef.value = null;
    }, direction === 'up' ? 700 : 560);
  });
}

watch(hp, (next, prev) => {
  if (next === prev) return;
  triggerFlash(hpFlashClass, next > prev ? 'up' : 'down', hpFlashTimeout);
});

watch(damage, (next, prev) => {
  if (next === prev) return;
  triggerFlash(damageFlashClass, next > prev ? 'up' : 'down', damageFlashTimeout);
});

watch(bagsCapacity, (next, prev) => {
  if (next === prev) return;
  triggerFlash(bagsFlashClass, next > prev ? 'up' : 'down', bagsFlashTimeout);
});
</script>

<style scoped>
.stat-line { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-bottom: 12px; }
.stat {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  background: var(--raid-item-bg, rgba(255,255,255,0.08));
  border-radius: 6px;
  padding: 6px 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  text-align: center;
}
.stat::after {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  width: 40%;
  aspect-ratio: 1;
  border-radius: 999px;
  transform: translate(-50%, -50%) scale(0.08);
  opacity: 0;
  pointer-events: none;
}
.stat > * {
  position: relative;
  z-index: 1;
}
.stat.flash-up::after {
  background: radial-gradient(circle, rgba(156, 180, 208, 0.96) 0%, rgba(156, 180, 208, 0.72) 42%, rgba(156, 180, 208, 0) 74%);
  animation: stat-flash-up 700ms ease-out;
}
.stat.flash-down::after {
  background: radial-gradient(circle, rgba(186, 207, 230, 0.46) 0%, rgba(156, 180, 208, 0.35) 34%, rgba(116, 140, 166, 0.2) 52%, rgba(116, 140, 166, 0) 72%);
  animation: stat-flash-down 560ms ease-out;
}
.stat.flash-up .value {
  animation: stat-value-pop 700ms ease-out;
}
.stat.flash-down .value {
  animation: stat-value-soft 560ms ease-out;
}
.stat .label { color: var(--text-secondary); font-size: 14px; text-transform: uppercase; letter-spacing: 0.06em; margin-right: 0; }
.stat .value { font-weight: 800;  font-size: 18px; }

@keyframes stat-flash-up {
  0% { opacity: 0; transform: translate(-50%, -50%) scale(0.08); }
  18% { opacity: 1; transform: translate(-50%, -50%) scale(0.55); }
  100% { opacity: 0; transform: translate(-50%, -50%) scale(4.8); }
}
@keyframes stat-flash-down {
  0% { opacity: 0; transform: translate(-50%, -50%) scale(2.6); }
  24% { opacity: 0.52; transform: translate(-50%, -50%) scale(1.35); }
  100% { opacity: 0; transform: translate(-50%, -50%) scale(0.08); }
}
@keyframes stat-value-pop {
  0% { transform: scale(1); }
  30% { transform: scale(1.13); }
  100% { transform: scale(1); }
}
@keyframes stat-value-soft {
  0% { transform: scale(1); opacity: 1; }
  45% { transform: scale(0.97); opacity: 0.88; }
  100% { transform: scale(1); opacity: 1; }
}
</style>
