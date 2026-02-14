<template>
  <div class="hint-root">
    <div class="hint-body">
      <div class="unlock-text">
        <template v-if="!cell.owned">Unlock: </template>
        <span class="disc-name">{{ title }}</span>
      </div>
      <div v-if="description" class="disc-desc">{{ description }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { getGameState, uiState } from '../../logic/UIState';
import { isResearchArchetypeRevealedByDiscovery } from '../../logic/ResearchLib';
import type { ReadonlyResearchArchetype, ReadonlyResearchCell, ReadonlyResearchNodeInstance } from '../../logic/UIState';

const props = defineProps<{
  cell: ReadonlyResearchCell;
  node: ReadonlyResearchNodeInstance | null;
  archetype: ReadonlyResearchArchetype | null;
}>();

const isRevealedByDiscovery = computed(() => {
  uiState.discoveryCounter;
  const arch = props.archetype!;
  return isResearchArchetypeRevealedByDiscovery(arch, getGameState().discoveries);
});

const title = computed(() => {
  const arch = props.archetype!;
  if (props.cell.owned && arch.ownedTitle) return arch.ownedTitle;
  if (isRevealedByDiscovery.value) return arch.revealedTitle;
  return arch.title;
});
const description = computed(() => {
  const arch = props.archetype!;
  if (props.cell.owned && arch.ownedDescription) return arch.ownedDescription;
  if (isRevealedByDiscovery.value) return arch.revealedDescription;
  return arch.description;
});
</script>

<style scoped>
.hint-root {
  text-align: left;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.03em;
  min-width: 220px;
}

.hint-body {
  margin-top: 2px;
  font-size: 14px;
  font-weight: 600;
}

.unlock-text {
  white-space: nowrap;
}

.disc-name {
  color: rgba(34, 197, 94, 0.95);
  font-weight: 700;
}

.disc-desc {
  margin-top: 6px;
  font-size: 13px;
  font-weight: 500;
  opacity: 0.9;
  max-width: 320px;
}
</style>
