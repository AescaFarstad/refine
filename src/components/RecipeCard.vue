<template>
  <div
    class="recipe-content"
    :class="[sizeClass, { clickable }]"
    :role="clickable ? 'button' : undefined"
    :tabindex="clickable ? 0 : -1"
    @click="clickable && onClick()"
  >
    <div class="rc-title">
      <div class="rc-duration">
        <span class="duration-badge">{{ formatDurationHM(recipe.durationSec) }}</span>
        <RecipeHint :quality-id="recipe.qualityId" :time-class="recipe.timeClass" :show-quality="false" :show-time-badge="true" />
      </div>
      <RecipeHint :quality-id="recipe.qualityId" :time-class="recipe.timeClass" />
    </div>

    <div class="rc-body">
      <div class="ess-need" v-if="recipe.essList.length">
        <div class="ess-unit" v-for="e in recipe.essList" :key="e.key">
          <span v-if="getEssenceFrame(e.key) && source" class="ess-icon48" :style="essenceIconStyle(iconSize, e.key)" />
          <span v-else class="ess-letter48">{{ essenceLetter(e.key) }}</span>
          <span class="ess-num48" :class="{ insufficient:highlightInsufficient && isInsufficient(e.key, e.value) }">{{ e.value }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import RecipeHint from './RecipeHint.vue';
import { formatDurationHM } from '../logic/StringUtils';
import atlasStorage from '../logic/AtlasStorage';

type TimeClass = 'terribly_slow' | 'slow' | 'normal' | 'fast' | 'ultra_fast';

type RecipeCardRecipe = {
  id: string;
  name: string;
  qualityId: string;
  qualityDef: any;
  essList: Array<{ key: string; value: number }>;
  durationSec: number;
  timeClass: TimeClass;
};

const props = withDefaults(defineProps<{
  recipe: RecipeCardRecipe;
  playerEssTotals?: Record<string, number>;
  clickable?: boolean;
  size?: 'default' | 'compact';
  highlightInsufficient?: boolean;
}>(), {
  playerEssTotals: () => ({}),
  clickable: true,
  size: 'default',
  highlightInsufficient: true,
});
const emit = defineEmits<{ (e: 'select', id: string): void }>();

const source = ref<HTMLImageElement | null>(atlasStorage.getItemsSource());
const ready = ref<boolean>(atlasStorage.isItemsAtlasLoaded());
onMounted(async () => {
  if (!ready.value) {
    try { await atlasStorage.loadItemsAtlas(); } catch (_e) {/* noop */}
    ready.value = atlasStorage.isItemsAtlasLoaded();
    source.value = atlasStorage.getItemsSource();
  }
});

function onClick() { emit('select', props.recipe.id); }

const sizeClass = computed(() => props.size === 'compact' ? 'size-compact' : 'size-default');
const iconSize = computed(() => props.size === 'compact' ? 32 : 48);

function getEssenceFrame(k: string) { return atlasStorage.getItemsFrame(k); }

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
  return m[k] || k[0]?.toUpperCase() || '?';
}

function isInsufficient(k: string, need: number): boolean {
  const have = props.playerEssTotals?.[k] || 0;
  return have < need;
}

</script>

<style scoped>
.recipe-content { transition: transform 120ms ease, box-shadow 120ms ease, background 120ms ease; }
.recipe-content.clickable { cursor: pointer; }

.rc-title { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px; position: relative; }
.rc-duration { display: inline-flex; align-items: center; gap: 8px; }

.duration-badge {
  display: inline-block;
  padding: 0;
  border-radius: 0;
  font-size: 16px;
  font-weight: 900;
  background: transparent;
  border: none;
  color: var(--text-secondary);
  white-space: nowrap;
}

.rc-body { display: flex; align-items: center; justify-content: flex-start; }
.ess-need { display: flex; align-items: center; gap: 12px; flex-wrap: nowrap; overflow-x: auto; }
.ess-unit { display: inline-flex; align-items: center; gap: 8px; }
.ess-num48 { font-weight: 900; font-size: 48px; line-height: 48px; letter-spacing: -0.02em; }
.ess-num48.insufficient { color: #e25b5b; }
.ess-icon48 { display: inline-block; width: 48px; height: 48px; }
.ess-letter48 { display: inline-grid; place-items: center; width: 48px; height: 48px; font-weight: 900; font-size: 28px; opacity: 0.9; border-radius: 4px; background: rgba(255,255,255,0.02); }

/* Compact variant overrides */
.size-compact .duration-badge { font-size: 14px; }
.size-compact .ess-icon48 { width: 32px; height: 32px; }
.size-compact .ess-letter48 { width: 32px; height: 32px; font-size: 18px; }
.size-compact .ess-num48 { font-size: 24px; line-height: 24px; }
</style>
