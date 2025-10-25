<template>
  <div
    class="upgrade-card tier-card"
    :class="{ purchased, purchasable: !purchased, unavailable: !purchased && !canAfford }"
    role="button"
    :tabindex="purchased ? -1 : 0"
    @click="onClick"
  >
    <template v-if="!purchased">
      <div class="title">Unlock tier {{ tier + 1 }}</div>
    </template>
    <template v-else>
      <div class="title bought">Tier {{ tier + 1 }}</div>
    </template>
    <div v-if="!purchased" class="price" :class="{ insufficient: !canAfford }">{{ price }} ⧖</div>
  </div>
</template>

<script setup lang="ts">
const emit = defineEmits<{ (e: 'purchase'): void }>();
const props = defineProps<{ tier: number; purchased: boolean; price: number; canAfford: boolean }>();

function onClick() {
  if (!props.purchased && props.canAfford) emit('purchase');
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
  align-items: center;
  justify-content: center;
  position: relative;
}
.purchasable { cursor: pointer; }
.purchasable:hover { border-color: var(--accent-hover); box-shadow: 0 0 0 2px rgba(79,209,197,0.15) inset; }
.purchased { cursor: default; opacity: 0.8; border-color: #10b981; }
.unavailable { border-color: #f87171; }
.title { font-weight: 900; font-size: 20px; text-align: center; }
.title.bought { color: var(--text-secondary); }
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
