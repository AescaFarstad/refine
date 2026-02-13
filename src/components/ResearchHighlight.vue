<template>
  <div v-if="entries.length > 0" class="highlight-panel">
    <div
      v-for="entry in entries"
      :key="entry.id"
      class="highlight-cell-wrap"
      :class="{ 'highlight-cell-wrap-gap': entry.gapBefore }"
      @mouseenter="onEntryMouseEnter(entry)"
      @mouseleave="onEntryMouseLeave(entry.id)"
    >
      <button
        type="button"
        class="highlight-cell"
        :class="`highlight-cell-${entry.kind}`"
      >
        <span v-if="entry.icon.kind === 'glyph'" class="highlight-glyph">{{ entry.icon.key }}</span>
        <div v-else class="highlight-sprite" :style="getSpriteStyle(entry.icon.key)" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { getGameLib, getGameState, uiState } from '../logic/UIState';
import { getStatIcon } from '../logic/drawResearch';
import { getResourceSpecByAnyKey } from '../logic/Resources';
import atlasStorage from '../logic/AtlasStorage';
import { atlasSpriteStyle } from '../logic/AtlasSpriteStyle';
import { researchArchetypes } from '../data/research_archetypes';
import type { ResearchHighlightHover } from '../logic/ResearchHighlightHover';

type HighlightNodeKind = 'resource' | 'stat' | 'discovery';

type HighlightIcon =
  | { kind: 'glyph'; key: string }
  | { kind: 'itemImage'; key: string };

interface HighlightEntry {
  id: string;
  kind: HighlightNodeKind;
  icon: HighlightIcon;
  gapBefore: boolean;
  hoverTarget: ResearchHighlightHover;
}

const emit = defineEmits<{
  (e: 'entry-hover', hover: ResearchHighlightHover | null): void;
}>();

const atlasSource = atlasStorage.getItemsSource();
const archetypeOrder = Object.keys(researchArchetypes);
const hoveredEntryId = ref<string | null>(null);

const entries = computed<HighlightEntry[]>(() => {
  // reactive dependencies
  uiState.researchOwnedCount;
  uiState.researchRevealRadius;
  uiState.discoveryCounter;

  const gs = getGameState();
  const lib = getGameLib();

  const visibleResourceArchetypes = new Set<string>();
  const visibleStatArchetypes = new Set<string>();
  let hasDiscovery = false;

  for (let idx = 0; idx < gs.researchCells.length; idx++) {
    const cell = gs.researchCells[idx]!;
    if (!cell.revealed || cell.owned || cell.blocked) continue;

    const archetype = lib.research.archetypes.get(cell.archetypeId)!;
    const type = archetype.type;

    if (type === 'gear' || type === 'obstacle' || type === 'empty' || type === 'void') continue;

    if (type === 'discovery') {
      hasDiscovery = true;
      continue;
    }

    if (type === 'resource') {
      visibleResourceArchetypes.add(cell.archetypeId);
      continue;
    }

    visibleStatArchetypes.add(cell.archetypeId);
  }

  const resourceEntries: HighlightEntry[] = [];
  const statEntries: HighlightEntry[] = [];

  for (const archetypeId of archetypeOrder) {
    if (visibleResourceArchetypes.has(archetypeId)) {
      const archetype = lib.research.archetypes.get(archetypeId)!;
      const reward = archetype.rewards.find((rewardDef) => rewardDef.kind === 'resource')!;
      const spec = getResourceSpecByAnyKey(reward.resource);
      resourceEntries.push({
        id: `resource-${archetypeId}`,
        kind: 'resource',
        icon: { kind: 'glyph', key: spec.glyph },
        gapBefore: false,
        hoverTarget: { kind: 'resource', archetypeId },
      });
    }

    if (visibleStatArchetypes.has(archetypeId)) {
      const archetype = lib.research.archetypes.get(archetypeId)!;
      const reward = archetype.rewards.find((rewardDef) => rewardDef.kind === 'stat')!;
      const statIcon = getStatIcon(reward.stat);
      statEntries.push({
        id: `stat-${archetypeId}`,
        kind: 'stat',
        icon: statIcon.kind === 'glyph'
          ? { kind: 'glyph', key: statIcon.key }
          : { kind: 'itemImage', key: statIcon.key },
        gapBefore: false,
        hoverTarget: { kind: 'stat', archetypeId },
      });
    }
  }

  if (resourceEntries.length > 0 && statEntries.length > 0) {
    statEntries[0]!.gapBefore = true;
  }

  const allEntries = [...resourceEntries, ...statEntries];

  if (hasDiscovery) {
    allEntries.push({
      id: 'special-discovery',
      kind: 'discovery',
      icon: { kind: 'glyph', key: 'S' },
      gapBefore: false,
      hoverTarget: { kind: 'discovery' },
    });
  }

  return allEntries;
});

watch(entries, (nextEntries) => {
  const hoverId = hoveredEntryId.value;
  if (!hoverId) return;
  const stillVisible = nextEntries.some((entry) => entry.id === hoverId);
  if (stillVisible) return;
  hoveredEntryId.value = null;
  emit('entry-hover', null);
});

function onEntryMouseEnter(entry: HighlightEntry): void {
  hoveredEntryId.value = entry.id;
  emit('entry-hover', entry.hoverTarget);
}

function onEntryMouseLeave(entryId: string): void {
  if (hoveredEntryId.value !== entryId) return;
  hoveredEntryId.value = null;
  emit('entry-hover', null);
}

function getSpriteStyle(imageKey: string): Record<string, string> {
  const frame = atlasStorage.getItemsFrame(imageKey)!;
  return atlasSpriteStyle(atlasSource, frame, { size: 24, mode: 'fit', allowUpscale: false });
}
</script>

<style scoped>
.highlight-panel {
  position: absolute;
  top: 100px;
  right: 0;
  display: flex;
  flex-direction: column;
  gap: 0;
  pointer-events: auto;
  user-select: none;
  z-index: 24;
  background: rgba(10, 10, 18, 0.65);
  border-radius: 8px 0 0 8px;
  /* padding: 8px 0; */
}

.highlight-cell-wrap {
  position: relative;
  width: 62px;
  height: 50px;
}

.highlight-cell-wrap-gap {
  margin-top: 20px;
}

.highlight-cell-wrap::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 94px;
  height: 54px;
  transform: translate(-50%, -50%);
  background: linear-gradient(
    to left,
    rgba(248, 250, 252, 0.35),
    rgba(248, 250, 252, 0)
  );
  border-radius: 0 12px 12px 0;
  opacity: 0;
  pointer-events: none;
  transition: opacity 140ms ease;
}

.highlight-cell-wrap:hover::before {
  opacity: 1;
}

.highlight-cell {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 1;
  width: 42px;
  height: 42px;
  border: 0;
  padding: 0;
  margin: 0;
  color: rgba(248, 250, 252, 0.96);
  background: rgb(140, 110, 25);
  clip-path: polygon(50% 2%, 92% 25%, 92% 75%, 50% 98%, 8% 75%, 8% 25%);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: default;
  pointer-events: none;
}

.highlight-glyph {
  font-size: 24px;
  font-weight: 700;
  line-height: 1;
}

.highlight-sprite {
  image-rendering: pixelated;
  background-repeat: no-repeat;
}
</style>
