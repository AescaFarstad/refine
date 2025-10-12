<template>
  <div class="item-grid" :class="{ minor, clickable }">
    <div
      v-for="it in items"
      :key="it.id"
      class="grid-item"
      :class="{ clickable }"
      @click="onItemClick(it.id)"
    >
      <ItemDisplay
        :id="it.id"
        :quantity="it.quantity"
        :minor="minor"
      />
    </div>
  </div>
  
  
</template>

<script setup lang="ts">
import ItemDisplay from './ItemDisplay.vue';

const props = defineProps<{ items: Array<{ id: string; quantity: number }>; minor?: boolean; clickable?: boolean }>();
const emit = defineEmits<{ (e: 'item-click', id: string): void }>();

function onItemClick(id: string) {
  if (!props.clickable) return;
  emit('item-click', id);
}
</script>

<style scoped>
.item-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
  gap: 8px;
}
.item-grid.minor {
  opacity: 0.85;
  grid-template-columns: repeat(auto-fill, minmax(48px, 1fr));
  gap: 6px;
}
.grid-item.clickable { cursor: pointer; }
</style>
