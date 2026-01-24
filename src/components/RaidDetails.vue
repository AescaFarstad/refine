<template>
  <div class="raid-details">
    <RaidDetailStats />
    <template v-if="selectedRaid">
      <RaidDetailMonsters :raid="selectedRaid" :loot-count="lootCount" />
      <RaidDetailLoot :raid="selectedRaid" :loot-count="lootCount" />
      <RaidDetailTravel :raid="selectedRaid" />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { uiState } from '../logic/UIState';
import type { RaidDefinition } from '../logic/RaidLib';
import RaidDetailStats from './RaidDetailStats.vue';
import RaidDetailMonsters from './RaidDetailMonsters.vue';
import RaidDetailLoot from './RaidDetailLoot.vue';
import RaidDetailTravel from './RaidDetailTravel.vue';

const selectedRaid = computed<RaidDefinition | undefined>(() => {
  uiState.raidKey;
  return uiState.raids.find(r => r.id === uiState.activeRaidId);
});

const lootCount = computed(() => {
  uiState.raidKey;
  const raid = selectedRaid.value;
  if (!raid) return 0;
  let loot = 0;
  for (const e of raid.encounters) {
    if (e.encounter.type !== 'LootEncounter') continue;
    loot += Math.max(0, Math.floor(e.count));
  }
  return loot;
});
</script>

<style scoped>
.raid-details { --raid-table-first-col: 130px; }
</style>
