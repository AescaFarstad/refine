<template>
  <div class="panel all-items">
    <div class="header">
      <h3>All Items</h3>
      <span class="count" v-if="items?.length">{{ items.length }}</span>
    </div>
    <div class="grid-wrap">
      <ItemGrid :items="items" clickable @item-click="onPick" />
    </div>
  </div>
  
</template>

<script setup lang="ts">
import ItemGrid from './ItemGrid.vue';
const props = defineProps<{ items: Array<{ id: string; quantity: number }> }>();
const emit = defineEmits<{ (e: 'pick-item', id: string): void }>();

function onPick(id: string) {
  // Ensure the clicked item exists and has available quantity
  const it = props.items?.find(x => x.id === id);
  if (!it || (it.quantity || 0) <= 0) return;
  emit('pick-item', id);
}
</script>

<style scoped>
.all-items { height: 100%; display: flex; flex-direction: column; }
.header { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 8px; }
h3 { margin: 0; font-size: 16px; letter-spacing: 0.04em; }
.count { font-size: 12px; opacity: 0.8; }
.grid-wrap { flex: 1; min-height: 0; overflow: auto; }
</style>
