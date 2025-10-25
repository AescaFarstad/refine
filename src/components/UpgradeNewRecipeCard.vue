<template>
  <div
    class="upgrade-card new-recipe-card"
    :class="{ purchased, locked: !!locked, purchasable: !purchased && !locked, unavailable: !purchased && (!!locked || !canAfford) }"
    role="button"
    :tabindex="purchased || locked ? -1 : 0"
    @click="onClick"
  >
    <div class="top-badge top-badge--big">New Recipe</div>
    <RecipeCard :recipe="recipe" :clickable="false" :highlight-insufficient="false" />
    <div v-if="!purchased" class="price" :class="{ insufficient: !canAfford }">{{ price }} ⧖</div>
  </div>
</template>

<script setup lang="ts">
import RecipeCard from './RecipeCard.vue';

const emit = defineEmits<{ (e: 'purchase'): void }>();
const props = defineProps<{ recipe: { id: string; name: string; qualityId: string; qualityDef: any; essList: Array<{ key: string; value: number }>; durationSec: number; timeClass?: 'terribly_slow' | 'slow' | 'normal' | 'fast' | 'ultra_fast' }; purchased: boolean; price: number; canAfford: boolean; locked?: boolean }>();

function onClick() {
  if (!props.purchased && !props.locked && props.canAfford) emit('purchase');
}
</script>

<style scoped>
.upgrade-card {
  border: 1px solid var(--panel-border);
  border-radius: 6px;
  background: rgba(255,255,255,0.02);
  box-shadow: inset 0 1px 0 var(--panel-shine);
  padding: 10px 12px 28px 12px;
  width: 320px;
  height: 120px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  position: relative;
}
.upgrade-card.purchasable { cursor: pointer; }
.upgrade-card.purchasable:hover { border-color: var(--accent-hover); box-shadow: 0 0 0 2px rgba(79,209,197,0.15) inset; }
.upgrade-card.purchased { opacity: 0.6; cursor: default; border-color: #10b981; }
.upgrade-card.purchased {
  background-image: repeating-linear-gradient(
    45deg,
    rgba(16, 185, 129, 0.32) 0 12px,
    transparent 12px 24px
  );
}
.upgrade-card.unavailable { border-color: #f87171; }
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
  border: 1px solid var(--accent-hover);
  border-top-left-radius: 0;
  border-top-right-radius: 0;
  border-bottom-left-radius: 6px;
  border-bottom-right-radius: 6px;
  background: rgba(79, 209, 197, 0.12);
  color: var(--accent-hover);
}
.top-badge--big { font-size: 18px; padding: 4px 12px; }
.rc-title { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px; position: relative; flex-wrap: nowrap; width: 100%; }
.price {
  position: absolute;
  left: 50%;
  bottom: -1px;
  transform: translateX(-50%);
  font-weight: 900;
  font-size: 20px;
  padding: 2px 10px 4px 10px;
  border: 1px solid currentColor;
  border-top-left-radius: 6px;
  border-top-right-radius: 6px;
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
  background: rgba(0,0,0,0.2);
  color: #9ae6b4;
}
.price.insufficient { color: #f87171; }
</style>
