<template>
  <div
    class="upgrade-card gear-card"
    :class="{ purchased, locked: !!locked, purchasable: !purchased && !locked, unavailable: !purchased && (!!locked || !canAfford) }"
    role="button"
    :tabindex="purchased || locked ? -1 : 0"
    @click="onClick"
  >
    <div class="top-badge">Gear</div>
    <div class="gear-list">
      <div class="gear-entry" v-for="(id, idx) in gearIds" :key="id">
        <div v-if="source && getFrame(id)" class="gear-sprite-wrap">
          <div class="gear-sprite" :style="spriteStyle(id)" />
        </div>
        <div class="gear-name">{{ gearNames[idx] || id }}</div>
      </div>
    </div>
    <div v-if="!purchased" class="price" :class="{ insufficient: !canAfford }">{{ price }} ⧖</div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import atlasStorage from '../logic/AtlasStorage';
import gearData from '../data/gear';

const emit = defineEmits<{ (e: 'purchase'): void }>();
const props = defineProps<{ gearIds: string[]; gearNames: string[]; purchased: boolean; price: number; canAfford: boolean; locked?: boolean }>();

// Atlas state for gear images
const source = ref<HTMLImageElement | null>(atlasStorage.getItemsSource());
onMounted(async () => {
  if (!atlasStorage.isItemsAtlasLoaded()) {
    try {
      await atlasStorage.loadItemsAtlas();
    } catch (_e) { /* noop */ }
    source.value = atlasStorage.getItemsSource();
  }
});

function getFrame(gearId: string) {
  const imageKey = getImageKey(gearId);
  if (!imageKey) return null;
  return atlasStorage.getItemsFrame(imageKey);
}

function getImageKey(gearId: string): string | undefined {
  // Look up the gear definition to get the image key
  const gearDef = (gearData as Record<string, { image?: string }>)[gearId];
  return gearDef?.image;
}

function spriteStyle(gearId: string): Record<string, string> {
  const f = getFrame(gearId);
  if (!source.value || !f) return {};
  const atlasW = source.value.naturalWidth;
  const atlasH = source.value.naturalHeight;
  // Scale to fit within 48x48 container while maintaining aspect ratio
  const containerSize = 48;
  const scale = Math.min(containerSize / f.w, containerSize / f.h, 1); // Don't upscale, only downscale
  const displayW = f.w * scale;
  const displayH = f.h * scale;
  return {
    width: displayW + 'px',
    height: displayH + 'px',
    backgroundImage: `url(${source.value.src})`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: `-${f.x * scale}px -${f.y * scale}px`,
    backgroundSize: `${atlasW * scale}px ${atlasH * scale}px`,
  };
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
  min-height: 120px;
  display: flex;
  flex-direction: column;
  justify-content: center;
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
  font-size: 14px;
  padding: 2px 10px;
  border-top-left-radius: 0;
  border-top-right-radius: 0;
  border-bottom-left-radius: 6px;
  border-bottom-right-radius: 6px;
  background: rgba(79, 209, 197, 0.12);
  color: var(--accent-hover);
}
.gear-list {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 4px 0;
}
.gear-entry {
  display: flex;
  align-items: center;
  gap: 8px;
}
.gear-sprite-wrap {
  flex-shrink: 0;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.gear-sprite {
  flex-shrink: 0;
  image-rendering: auto;
}
.gear-name {
  font-weight: 800;
  font-size: 14px;
  text-align: left;
}
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
</style>
