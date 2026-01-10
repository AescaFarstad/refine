<template>
  <span class="wrap" @mouseenter="open" @mouseleave="close">
    <button
      ref="anchorEl"
      type="button"
      class="trigger"
      :class="{ pulse: pulse }"
      aria-label="Essence cheat-sheet"
      @focus="open"
      @blur="close"
      @click="toggle"
    >
      Essence cheat-sheet
    </button>

    <div
      v-if="isOpen"
      class="tooltip"
      role="tooltip"
      :class="{ above: showAbove }"
      :style="{ top: pos.top + 'px', left: pos.left + 'px' }"
    >
      <div v-if="encounteredEssenceKeys.length === 0" class="empty">
        No essences encountered yet.
      </div>
      <div v-else class="list">
        <div v-for="k in encounteredEssenceKeys" :key="'cheat-' + k" class="row" :class="{ new: newEssences[k] }">
          <span v-if="getEssenceFrame(k) && source" class="icon" :style="essenceIconStyle(18, k)" />
          <span v-else class="letter">{{ essenceLetter(k) }}</span>
          <span class="name">{{ essenceDisplayName(k) }}</span>
          <span class="sep"></span>
          <span class="desc" v-html="essenceEffectHtml(k)"></span>
        </div>
      </div>
    </div>
  </span>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { uiState } from '../logic/UIState';
import { globalInputQueue } from '../logic/Model';
import { CmdMarkEssencesSeen } from '../logic/input/InputCommands';
import atlasStorage from '../logic/AtlasStorage';
import {
  CYAN_SUCCESS_BONUS_PCT,
  ESSENCE_CREDITS,
  ESSENCE_CHRONOTRACES,
  ESSENCE_TEMPORAL_FLUX,
  MAGENTA_SUCCESS_PENALTY_PCT,
} from '../logic/Const';
import { getResourceSpec } from '../logic/Resources';

const props = withDefaults(defineProps<{ pulse: boolean }>(), { pulse: false });
const pulse = computed(() => props.pulse);

const newEssences = ref<Record<string, true>>({});

const source = ref<HTMLImageElement | null>(atlasStorage.getItemsSource());
const ready = ref<boolean>(atlasStorage.isItemsAtlasLoaded());
onMounted(async () => {
  if (!ready.value) {
    try { await atlasStorage.loadItemsAtlas(); } catch (_e) { /* noop */ }
    ready.value = atlasStorage.isItemsAtlasLoaded();
    source.value = atlasStorage.getItemsSource();
  }
});

function getEssenceFrame(k: string) {
  return atlasStorage.getItemsFrame(k);
}

function essenceIconStyle(size: number, k: string): Record<string, string> {
  const f = atlasStorage.getItemsFrame(k);
  if (!source.value || !f) return {} as Record<string, string>;
  const scale = size / Math.max(f.w, f.h);
  const atlasW = source.value.naturalWidth;
  const atlasH = source.value.naturalHeight;
  return {
    width: size + 'px',
    height: size + 'px',
    backgroundImage: `url(${source.value.src})`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: `-${f.x * scale}px -${f.y * scale}px`,
    backgroundSize: `${atlasW * scale}px ${atlasH * scale}px`,
  } as Record<string, string>;
}

function essenceLetter(k: string): string {
  const m: Record<string, string> = { red: 'R', green: 'G', blue: 'B', yellow: 'Y' };
  return m[k] || k?.[0]?.toUpperCase?.() || '?';
}

const encounteredEssenceKeys = computed<string[]>(() => {
  const keys = (uiState.encounteredEssences || []).filter(Boolean);
  const uniq = Array.from(new Set(keys));
  const order = ['red', 'green', 'blue', 'yellow', 'cyan', 'magenta', 'orange', 'indigo', 'crimson', 'emerald', 'gold', 'gray'];
  const orderIdx: Record<string, number> = {};
  order.forEach((k, i) => { orderIdx[k] = i; });
  return uniq.sort((a, b) => {
    const ai = orderIdx[a];
    const bi = orderIdx[b];
    if (ai !== undefined || bi !== undefined) return (ai ?? 999) - (bi ?? 999);
    return a.localeCompare(b);
  });
});

function essenceDisplayName(k: string): string {
  const name: Record<string, string> = {
    red: 'Red',
    green: 'Green',
    blue: 'Blue',
    yellow: 'Yellow',
    orange: 'Orange',
    cyan: 'Cyan',
    magenta: 'Magenta',
    indigo: 'Indigo',
    crimson: 'Crimson',
    emerald: 'Emerald',
    gold: 'Gold',
    gray: 'Gray',
  };
  return name[k] || (k?.[0]?.toUpperCase?.() || '?') + (k?.slice?.(1) || '');
}

function resourceHtml(amount: number, resourceKey: 'credits' | 'chronotraces' | 'timeFlux'): string {
  const spec = getResourceSpec(resourceKey);
  return `<span style="color:${spec.color}">${amount}${spec.glyph}</span> ${spec.name.toLowerCase()}`;
}

function essenceEffectHtml(k: string): string {
  switch (k) {
    case 'red':
      return `gives ${resourceHtml(ESSENCE_CREDITS, 'credits')}`;
    case 'blue':
      return `gives ${resourceHtml(ESSENCE_CHRONOTRACES, 'chronotraces')}`;
    case 'green':
      return `gives ${resourceHtml(ESSENCE_TEMPORAL_FLUX, 'timeFlux')}`;
    case 'yellow':
      return '+1 effective count for adjacent';
    case 'orange':
      return 'Doubles adjacent';
    case 'cyan':
      return `${CYAN_SUCCESS_BONUS_PCT}% refining success`;
    case 'magenta':
      return `-${MAGENTA_SUCCESS_PENALTY_PCT}% refining success`;
    case 'indigo':
      return 'Converts adjacent clusters to blue';
    case 'crimson':
      return 'Converts adjacent clusters to red';
    case 'emerald':
      return 'Converts adjacent clusters to green';
    case 'gold':
      return 'Converts adjacent clusters to yellow';
    case 'gray':
      return 'Junk';
    default:
      return 'Effect unknown.';
  }
}

const anchorEl = ref<HTMLElement | null>(null);
const isOpen = ref(false);
const showAbove = ref(false);
const pos = ref({ top: 0, left: 0 });

function position(): void {
  const el = anchorEl.value;
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const margin = 10;
  const assumedW = 360;
  const assumedH = 280;

  const wantAbove = rect.bottom + margin + assumedH > window.innerHeight;
  showAbove.value = wantAbove;

  let left = rect.left;
  left = Math.min(left, window.innerWidth - assumedW - margin);
  left = Math.max(margin, left);

  const top = wantAbove ? rect.top - margin : rect.bottom + margin;
  pos.value = { top, left };
}

function open(): void {
  if (isOpen.value) return;
  isOpen.value = true;
  const seen = new Set(uiState.seenEssences);
  const next: Record<string, true> = {};
  for (const k of encounteredEssenceKeys.value) {
    if (!seen.has(k)) next[k] = true;
  }
  newEssences.value = next;
  globalInputQueue.push(new CmdMarkEssencesSeen());
  void nextTick(() => position());
  window.addEventListener('resize', position);
  window.addEventListener('scroll', position, true);
}

function close(): void {
  isOpen.value = false;
  newEssences.value = {};
  window.removeEventListener('resize', position);
  window.removeEventListener('scroll', position, true);
}

function toggle(): void {
  if (isOpen.value) close();
  else open();
}

onBeforeUnmount(() => close());
</script>

<style scoped>
.wrap { display: inline-flex; align-items: center; flex: 0 0 auto; }
.trigger {
  border: none;
  background: transparent;
  color: inherit;
  font-size: 18px;
  /* font-weight: 700; */
  line-height: 1;
  padding: 8px 6px;
  cursor: inherit;
  white-space: nowrap;
  text-decoration: underline dashed;
  text-underline-offset: 3px;
  opacity: 0.9;
}
.trigger:hover { opacity: 1; }
.trigger.pulse {
  border-radius: 8px;
  animation: pulse-essences 1700ms ease-in-out infinite;
}
@keyframes pulse-essences {
  0%, 100% { box-shadow: 0 0 0 0 rgba(56, 189, 248, 0); background: rgba(56, 189, 248, 0.0); }
  50% { box-shadow: 0 0 0 6px rgba(56, 189, 248, 0.12); background: rgba(56, 189, 248, 0.05); }
}
.tooltip {
  position: fixed;
  z-index: 5000;
  width: max-content;
  max-width: calc(100vw - 20px);
  max-height: min(60vh, 520px);
  overflow: auto;
  padding: 10px 10px;
  border-radius: 8px;
  border: 1px solid var(--panel-border);
  background: rgba(15, 23, 42, 0.98);
  color: #e5e7eb;
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.45);
  cursor: default;
  white-space: nowrap;
}
.tooltip.above { transform: translateY(-100%); }
.title { font-size: 14px; font-weight: 800; margin-bottom: 8px; color: #f8fafc; letter-spacing: 0.02em; }
.empty { font-size: 14px; opacity: 0.85; }
.list { display: flex; flex-direction: column; gap: 8px; }
.row {
  display: grid;
  grid-template-columns: 18px 55px 0px max-content;
  column-gap: 6px;
  align-items: center;
  justify-items: start;
  padding: 4px 6px;
  border-radius: 6px;
}
.row.new {
  background: rgba(34, 211, 238, 0.08);
  box-shadow: inset 0 0 0 1px rgba(34, 211, 238, 0.18);
}
.icon { display: inline-block; width: 18px; height: 18px; border-radius: 4px; }
.letter { display: inline-grid; place-items: center; width: 18px; height: 18px; font-weight: 900; font-size: 12px; border-radius: 4px; background: rgba(255,255,255,0.08); }
.icon, .letter { align-self: center; grid-column: 1; }
.name { font-size: 14px; font-weight: 800; line-height: 1.15; grid-column: 2; }
.sep { font-size: 14px; opacity: 0.75; text-align: center; grid-column: 3; }
.desc { font-size: 14px; opacity: 0.9; line-height: 1.25; grid-column: 4; }
</style>
