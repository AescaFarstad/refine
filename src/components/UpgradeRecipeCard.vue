<template>
  <div
    class="upgrade-card recipe-upgrade-card"
    :class="{ purchased, locked: !!locked, purchasable: !purchased && !locked, unavailable: !purchased && (!!locked || !canAfford) }"
    role="button"
    :tabindex="purchased || locked ? -1 : 0"
    @click="onClick"
  >
    <div class="top-badge top-badge--big">{{ effect === 'modifyEssences' ? 'Recipe Modification' : 'Recipe Upgrade' }}</div>
    <div class="card-body">
      <template v-if="effect === 'modifyEssences'">
        <span class="ellipsis">…</span>
        <div class="ess-need" v-if="params && params.length">
          <div class="ess-unit" :class="'ess-' + e.key" v-for="e in params" :key="e.key">
            <span v-if="getEssenceFrame(e.key) && source" class="ess-icon48" :style="essenceIconStyle48(e.key)" />
            <span v-else class="ess-letter48">{{ essenceLetter(e.key) }}</span>
            <span class="ess-num48">{{ signed(e.value) }}</span>
          </div>
        </div>
        <span class="ellipsis">…</span>
      </template>
      <template v-else>
        <div class="quality-up">↑ Quality ↑</div>
      </template>
    </div>
    <div v-if="!purchased" class="price" :class="{ insufficient: !canAfford }">{{ price }} ⧖</div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import atlasStorage from '../logic/AtlasStorage';

const emit = defineEmits<{ (e: 'purchase'): void }>();
const props = defineProps<{ effect: 'modifyEssences' | 'increaseQuality'; params?: Array<{ key: string; value: number }>; purchased: boolean; price: number; canAfford: boolean; locked?: boolean }>();

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

function essenceIconStyle48(k: string): Record<string, string> {
  const f = atlasStorage.getItemsFrame(k);
  if (!source.value || !f) return {} as Record<string, string>;
  const scale = 48 / Math.max(f.w, f.h);
  const atlasW = source.value.naturalWidth;
  const atlasH = source.value.naturalHeight;
  return {
    width: '48px',
    height: '48px',
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

function signed(v: number): string {
  const s = Math.round(v);
  return (s > 0 ? '+' : '') + s;
}

function onClick() {
  if (!props.purchased && !props.locked && props.canAfford) emit('purchase');
}
</script>

<style scoped>
.upgrade-card {
  border-radius: 6px;
  background: rgba(255,255,255,0.02);
  box-shadow: inset 0 1px 0 var(--panel-shine);
  padding: 10px 12px 28px 12px;
  width: 320px;
  height: 120px;
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
}
.upgrade-card.purchasable { cursor: pointer; }
.upgrade-card.purchasable:hover { box-shadow: 0 0 0 2px rgba(79,209,197,0.15) inset; }
.upgrade-card.purchased { opacity: 0.6; cursor: default; }
.upgrade-card.purchased {
  background-image: repeating-linear-gradient(
    45deg,
    rgba(16, 185, 129, 0.32) 0 12px,
    transparent 12px 24px
  );
}
.upgrade-card.unavailable { }
.upgrade-card.locked::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  z-index: 2;
  background-image:
    repeating-linear-gradient(45deg, rgba(0, 0, 0, 0.38) 0, rgba(0, 0, 0, 0.38) 8px, transparent 8px, transparent 16px),
    repeating-linear-gradient(-45deg, rgba(0, 0, 0, 0.38) 0, rgba(0, 0, 0, 0.38) 8px, transparent 8px, transparent 16px);
  background-size: 20px 20px, 20px 20px;
}
.top-badge {
  position: absolute;
  top: -1px;
  left: 50%;
  transform: translateX(-50%);
  font-weight: 900;
  font-size: 12px;
  padding: 2px 8px;
  border-top-left-radius: 0;
  border-top-right-radius: 0;
  border-bottom-left-radius: 6px;
  border-bottom-right-radius: 6px;
  background: rgba(79, 209, 197, 0.12);
  color: var(--accent-hover);
  white-space: nowrap;
}
.top-badge--big { font-size: 18px; padding: 4px 16px; }
.card-body { display: flex; align-items: center; gap: 12px; flex: 1 1 auto; }
.ellipsis { opacity: 0.7; font-weight: 900; font-size: 22px; }
.ess-need { display: flex; align-items: center; gap: 12px; }
.ess-unit { display: inline-flex; align-items: center; gap: 8px; }
.ess-num48 { font-weight: 900; font-size: 48px; line-height: 48px; letter-spacing: -0.02em; }
.ess-icon48 { display: inline-block; width: 48px; height: 48px; border-radius: 4px; }
.ess-letter48 { display: inline-grid; place-items: center; width: 48px; height: 48px; font-weight: 900; font-size: 28px; opacity: 0.95; border-radius: 4px; }
.quality-up { font-weight: 900; font-size: 26px; letter-spacing: 0.02em; opacity: 0.9; }
.price {
  position: absolute;
  left: 50%;
  bottom: -1px;
  transform: translateX(-50%);
  font-weight: 900;
  font-size: 20px;
  padding: 2px 10px 4px 10px;
  border-top-left-radius: 6px;
  border-top-right-radius: 6px;
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
  background: rgba(0,0,0,0.2);
  color: #9ae6b4;
}
.price.insufficient { color: #f87171; }

/* Essence backgrounds for letter fallback only (no tint on icons) */
.ess-unit.ess-red .ess-letter48 { background: rgba(239,68,68,0.2); }
.ess-unit.ess-green .ess-letter48 { background: rgba(34,197,94,0.2); }
.ess-unit.ess-blue .ess-letter48 { background: rgba(59,130,246,0.2); }
.ess-unit.ess-yellow .ess-letter48 { background: rgba(234,179,8,0.2); }
</style>
