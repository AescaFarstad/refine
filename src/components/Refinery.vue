<template>
  <div
    class="refinery panel"
    :class="{ selected }"
    @click="$emit('select')"
    @mouseenter="hover = true"
    @mouseleave="hover = false"
  >
    <div class="header">
      <span class="title">Refinery {{ index + 1 }}</span>
      <template v-if="!hasRecipe">
        <span class="status">Idle</span>
      </template>
      <template v-else>
        <div class="loaded-info">
          <span class="time">{{ timeRemainingLabel }}</span>
        </div>
      </template>
    </div>

    <!-- Start-here overlay when recipe can be started and refinery is idle -->
    <div v-if="!hasRecipe && canStartHere" class="start-hint" aria-live="polite">
      <span class="pulse-dot" aria-hidden="true"></span>
      <span class="label">Start here</span>
    </div>

    <!-- Essences line under header (reserved space even when empty) -->
    <div class="essence-line" :class="{ reserved: !hasRecipe }" :aria-hidden="!hasRecipe">
      <template v-if="hasRecipe">
        <span
          v-for="k in orderedKeys"
          :key="'e-' + k"
          class="essence-item"
        >
          <span v-if="getEssenceFrame(k) && source" class="ess-icon16" :style="essenceIconStyle(16, k)" />
          <span v-else class="ess-letter16">{{ essenceLetter(k) }}</span>
          <span class="qty">{{ ingredients?.[k] || 0 }}</span>
        </span>
      </template>
    </div>

    <div class="progress" :class="{ reserved: !hasRecipe }" :aria-hidden="!hasRecipe">
      <div class="bar">
        <div class="fill" :style="{ width: `${Math.max(0, Math.min(100, progressPct || 0))}%` }" />
      </div>
    </div>

    <div class="health-text" :class="{ reserved: !showHealth }" :aria-hidden="!showHealth">Health: {{ health }}%</div>

    <div
      v-if="hover && hasRecipe"
      class="hint"
      role="tooltip"
      @click.stop
    >
      <div class="hint-title">Refinement</div>
      <div class="hint-row">Expected credits: <span class="hl">{{ expectedCredits?.toLocaleString?.() ?? expectedCredits }}</span></div>
      <div class="hint-row">Expected chronotraces: <span class="hl">{{ expectedChrono?.toLocaleString?.() ?? expectedChrono }}</span></div>
      <div class="hint-row">Failure chance: <span class="hl">{{ failureChancePct }}%</span></div>
      <div class="hint-row" v-if="hasWaste">
        <div>Overflow waste:</div>
        <div class="waste-list">
          <span
            class="waste-item"
            v-for="(qty, k) in overflowWaste"
            :key="'w-' + k"
          >
            <span v-if="getEssenceFrame(k) && source" class="ess-icon16" :style="essenceIconStyle(16, k)" />
            <span v-else class="ess-letter16">{{ essenceLetter(k) }}</span>
            <span class="qty">{{ qty }}</span>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import atlasStorage from '../logic/AtlasStorage';
import { formatDurationHM } from '../logic/StringUtils';

const props = withDefaults(defineProps<{
  index: number;
  health: number;
  hasRecipe: boolean;
  selected?: boolean;
  canStartHere?: boolean;
  recipeId?: string;
  ingredients?: Record<string, number>;
  progressPct?: number;
  timeRemainingSec?: number;
  overflowWaste?: Record<string, number>;
  expectedCredits?: number;
  expectedChrono?: number;
  failureChancePct?: number;
}>(), {
  health: 100,
});

defineEmits<{ (e: 'select'): void }>();

const hover = ref(false);

const showHealth = computed(() => Math.round(props.health || 0) < 100);

function essenceLetter(k: string): string {
  const m: Record<string, string> = { red: 'R', green: 'G', blue: 'B', yellow: 'Y' };
  return m[k] || k?.[0]?.toUpperCase?.() || '?';
}

// Atlas state for essence icons
const source = ref<HTMLImageElement | null>(atlasStorage.getItemsSource());
const ready = ref<boolean>(atlasStorage.isItemsAtlasLoaded());
onMounted(async () => {
  if (!ready.value) {
    try { await atlasStorage.loadItemsAtlas(); } catch (_e) {/* noop */}
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
  };
}

const orderedKeys = computed<string[]>(() => {
  const ing = props.ingredients || {};
  const order = ['red', 'green', 'blue', 'yellow'];
  return Array.from(new Set([...order, ...Object.keys(ing)])).filter(k => (ing as any)[k] > 0);
});

const progressPct = computed(() => props.progressPct ?? 0);
const timeRemainingLabel = computed(() => formatDurationHM(props.timeRemainingSec));

const overflowWaste = computed<Record<string, number>>(() => props.overflowWaste || {});
const hasWaste = computed(() => Object.keys(overflowWaste.value).length > 0);

const expectedCredits = computed(() => props.expectedCredits ?? 0);
const expectedChrono = computed(() => props.expectedChrono ?? 0);
const failureChancePct = computed(() => Math.max(0, Math.round(props.failureChancePct || 0)));
</script>

<style scoped>
.refinery { cursor: pointer; min-width: 240px; position: relative; }
.refinery.selected { outline: 2px solid var(--accent); }
.header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.title { font-weight: 700; letter-spacing: 0.04em; opacity: 0.95; }
.status { font-size: 12px; opacity: 0.85; }
.loaded-info { display: inline-flex; align-items: center; gap: 10px; font-size: 12px; color: var(--text-secondary); }
.loaded-info .time { opacity: 0.9; }

.essence-line { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; min-height: 20px; }
.essence-item { display: inline-flex; align-items: center; gap: 4px; }
.ess-icon16 { display: inline-block; width: 16px; height: 16px; vertical-align: middle; }
.ess-letter16 { display: inline-grid; place-items: center; width: 16px; height: 16px; font-weight: 900; font-size: 12px; opacity: 0.9; border-radius: 3px; background: rgba(255,255,255,0.06); }
.qty { font-weight: 800; }

.progress { display: flex; align-items: center; gap: 8px; min-height: 8px; }
.bar { position: relative; height: 8px; background: rgba(255,255,255,0.06); border: 1px solid var(--panel-border); border-radius: 3px; overflow: hidden; flex: 1; }
.fill { position: absolute; inset: 0; width: 0; background: linear-gradient(90deg, var(--accent), var(--accent-hover)); }

.health-text { margin-top: 6px; font-size: 12px; opacity: 0.9; min-height: 16px; }

/* Reserve layout space when content is hidden */
.reserved { visibility: hidden; }

/* Start-here flashing overlay */
.start-hint {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  pointer-events: none; /* allow card click to pass through */
}
.start-hint .label {
  pointer-events: none;
  padding: 6px 10px;
  border-radius: 16px;
  border: 1px solid var(--panel-border);
  background: rgba(79, 209, 197, 0.12);
  color: var(--accent);
  font-weight: 900;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  box-shadow: 0 0 0 0 rgba(79, 209, 197, 0.5);
  animation: pulseGlow 1.8s ease-in-out infinite;
}
.pulse-dot {
  position: absolute;
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: var(--accent);
  top: 10px;
  right: 10px;
  filter: drop-shadow(0 0 6px var(--accent));
  animation: blink 1.2s ease-in-out infinite;
}
@keyframes pulseGlow {
  0% { box-shadow: 0 0 0 0 rgba(79, 209, 197, 0.45); }
  70% { box-shadow: 0 0 0 10px rgba(79, 209, 197, 0); }
  100% { box-shadow: 0 0 0 0 rgba(79, 209, 197, 0); }
}
@keyframes blink {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 1; }
}

.hint {
  position: absolute;
  right: 8px;
  top: calc(100% + 8px);
  background: var(--panel-bg);
  border: 1px solid var(--panel-border);
  color: var(--text-primary);
  padding: 8px 10px;
  border-radius: 4px;
  font-size: 12px;
  line-height: 1.3;
  box-shadow: 0 6px 20px rgba(0,0,0,0.35), inset 0 1px 0 var(--panel-shine);
  max-width: 280px;
  z-index: 20;
}
.hint::before {
  content: '';
  position: absolute;
  top: -6px;
  right: 18px;
  width: 0; height: 0;
  border-left: 6px solid transparent;
  border-right: 6px solid transparent;
  border-bottom: 6px solid var(--panel-bg);
}
.hint-title { font-weight: 800; letter-spacing: 0.02em; margin-bottom: 4px; }
.hint-row { display: flex; align-items: baseline; gap: 6px; margin-top: 2px; }
.waste-list { display: inline-flex; gap: 6px; flex-wrap: wrap; }
.waste-item { font-weight: 800; color: var(--text-secondary); }
.hl { color: var(--accent-hover); font-weight: 900; font-variant-numeric: tabular-nums; }
</style>
