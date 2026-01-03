<template>
  <template v-if="entry.skipped">
    <div class="note-row">Bags are full. Skipping search.</div>
  </template>
  <template v-else>
    <template v-if="entry.source === 'monster' && entry.biopsyChance > 0 && !entry.biopsySuccess && shownStep >= 1">
      <div class="note-row dimmed">The monster's remains were scattered and spoiled (<b>{{ entry.biopsyChance }}</b> vs {{ entry.biopsyRoll }})</div>
    </template>
    <template v-else>
      <div class="loot-cols" :class="{ hasItem: !!entry.itemId && shownStep >= 1 }">
        <div class="lc col1">
          <template v-if="shownStep >= 1">
            <template v-if="entry.source === 'monster' && entry.biopsyChance > 0">
              <div class="line outcome">Found <b>{{ itemName(entry.itemId) }}</b>! (<b>{{ entry.biopsyChance }}</b> vs {{ entry.biopsyRoll }})</div>
            </template>
            <template v-else>
              <template v-if="entry.itemId">
                <div class="line outcome">Found <b>{{ itemName(entry.itemId) }}</b>!</div>
              </template>
              <template v-else>
                <div class="line outcome dimmed">No valuables here</div>
              </template>
            </template>
          </template>

          <template v-if="entry.itemId && (entry.source === 'monster' ? shownStep >= 1 : shownStep >= 2)">
            <div class="line bags">
              <template v-if="!entry.discarded">
                Bags volume: <b>{{ entry.volumeAfter }} / {{ entry.capacity }}</b>
              </template>
              <template v-else>
                Bags volume: <b>{{ entry.volumeBefore }} / {{ entry.capacity }}</b>. Need {{ entry.requiredVolume }} more. Discarded.
              </template>
            </div>
          </template>
          <template v-else-if="entry.itemId">
            <div class="line bags placeholder">&nbsp;</div>
          </template>
        </div>

        <div class="lc colR" v-if="entry.itemId">
          <div class="colR-grid" :class="{ notyet: shownStep < 1 }">
            <div class="vol" v-if="shownStep >= 1">Volume: {{ itemVolume(entry.itemId) }}</div>
            <div class="icon-wrap">
              <ItemDisplay :id="entry.itemId" :minor="true" :class="{ 'loot-kept': !entry.discarded }" />
            </div>
          </div>
        </div>
      </div>
    </template>
  </template>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { LootEncounterLogEntry } from '../../logic/RaidLog';
import { getGameLib } from '../../logic/UIState';
import ItemDisplay from '../ItemDisplay.vue';

const props = defineProps<{
  entry: LootEncounterLogEntry;
  shownStep: number;
}>();

const shownStep = computed(() => Math.max(0, props.shownStep || 0));

function itemName(id?: string): string {
  const itemId = (id || '').trim();
  if (!itemId) return '';
  return getGameLib().getItem(itemId).name;
}

function itemVolume(id?: string): number {
  const itemId = (id || '').trim();
  if (!itemId) return 0;
  return getGameLib().getItem(itemId).volume;
}
</script>
