<template>
  <div class="raids">
    <div class="grid">
      <RaidCard
        v-for="item in displayRaids"
        :key="item.def.id"
        :def="item.def"
        :locked="item.locked"
        :quest-progress="item.questProgress"
        :quests-done="item.questsDone"
        :sliders="slidersFor(item.def.id)"
        :is-active="isRaidActive(item.def.id)"
        :any-active="isAnyRaidActive"
        :active-progress="activeProgress"
        :equipment="equipmentFor(item.def.id)"
        @select-equipment="selectEquipment"
      />
    </div>
  </div>
  
</template>

<script setup lang="ts">
import RaidCard from './RaidCard.vue';
import { computed } from 'vue';
import { displayRaids, uiState, ensureSliders, isRaidActive, isAnyRaidActive, getEquipment, setEquipment, type EquipmentType } from '../logic/UIState';

const slidersFor = (id: string) => {
  ensureSliders(id);
  return uiState.sliders[id];
};

const activeProgress = computed(() => uiState.activeRaidProgress);
const equipmentFor = (id: string) => getEquipment(id);

function selectEquipment(id: string, equipment: EquipmentType) {
  setEquipment(id, equipment);
}
</script>

<style scoped>
.raids { display: block; }
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
}
</style>
