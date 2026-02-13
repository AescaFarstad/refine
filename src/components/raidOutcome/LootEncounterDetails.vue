<template>
  <template v-if="entry.skipped">
    <div class="note-row" v-if="entry.skipReason === 'zone_collapsing'">Zone collapsing. Skipping search.</div>
    <div class="note-row dimmed" v-else-if="entry.kind === 'LootEncounter'">
      Bags are full.<br />
      Skipping search, but taking note about this place.<br />
      Next raid: <b style="color: white">+1%</b> chance to loot an item.
    </div>
    <div class="note-row dimmed" v-else>Bags are full. Skipping search.</div>
  </template>
  <template v-else>
    <template v-if="isMonsterLoot && entry.biopsyChance > 0 && !entry.biopsySuccess && shownStep >= 1">
      <div class="note-row dimmed" v-if="entry.explosiveTriggered">
        The monster's remains were spoiled by explosion (<b>{{ entry.explosiveChance }}</b> vs {{ entry.explosiveRoll }}). Biopsy was not attempted.
      </div>
      <div class="note-row dimmed" v-else-if="entry.explosiveChance > 0">
        Explosive check passed (<b>{{ entry.explosiveChance }}</b> vs {{ entry.explosiveRoll }}), but biopsy failed (<b>{{ entry.biopsyChance }}</b> vs {{ entry.biopsyRoll }}).
      </div>
      <div class="note-row dimmed" v-else>
        The monster's remains were scattered or spoiled (<b>{{ entry.biopsyChance }}</b> vs {{ entry.biopsyRoll }})
      </div>
    </template>
    <template v-else>
      <div class="loot-cols" :class="{ hasItem: !!entry.itemId && shownStep >= 1 }">
        <div class="lc col1">
          <template v-if="shownStep >= 1">
            <template v-if="isMonsterLoot && entry.biopsyChance > 0">
              <div class="line outcome" v-if="entry.explosiveChance > 0">
                Found <b>{{ itemName(entry.itemId) }}</b>! (explosive <b>{{ entry.explosiveChance }}</b> vs {{ entry.explosiveRoll }}, biopsy <b>{{ entry.biopsyChance }}</b> vs {{ entry.biopsyRoll }})
              </div>
              <div class="line outcome" v-else>
                Found <b>{{ itemName(entry.itemId) }}</b>! (<b>{{ entry.biopsyChance }}</b> vs {{ entry.biopsyRoll }})
              </div>
            </template>
            <template v-else>
              <template v-if="entry.itemId">
                <div class="line outcome">Found <b>{{ itemName(entry.itemId) }}</b>!</div>
              </template>
              <template v-else>
                <div class="line outcome dimmed">
                  No valuables here
                  <span class="roll-info">
                    (<span class="roll-target">{{ entry.checkValue }}</span>
                    <span class="roll-vs">vs</span>
                    <span class="roll-self">{{ entry.myRoll }}</span>)
                  </span>
                </div>
              </template>
            </template>
          </template>

          <template v-if="entry.itemId && (isMonsterLoot ? shownStep >= 1 : shownStep >= 2)">
            <div class="line bags">
              <template v-if="!entry.discarded">
                Bags volume: <b>{{ entry.volumeAfter }} / {{ entry.capacity }}</b>
                <template v-if="entry.replacedItemId">. Not enough...<br /> Must drop something. Replaced <b>{{ itemName(entry.replacedItemId) }}</b>.</template>
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
              <div class="replaced-item-wrap" :class="{ empty: !entry.replacedItemId }">
                <ItemDisplay v-if="entry.replacedItemId" :id="entry.replacedItemId" :minor="true" class="replaced-item" />
              </div>
              <ItemDisplay :id="entry.itemId" :minor="true" :class="{ 'loot-kept': !entry.discarded, 'loot-discarded': !!entry.discarded }" />
            </div>
          </div>
        </div>
      </div>
    </template>
    <div class="note-row time-regen" v-if="hasTimeRegen">
      Regenerated {{ timeRegenAmount }} hp: {{ entry.timeRegenHpBefore }} → <b>{{ entry.timeRegenHpAfter }}</b> over the last {{ formatDuration(entry.timeRegenDurationSec) }}
    </div>
  </template>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { LootEncounterLogEntry, MonsterLootEncounterLogEntry } from '../../logic/RaidLog';
import { getGameLib } from '../../logic/UIState';
import ItemDisplay from '../ItemDisplay.vue';

const props = defineProps<{
  entry: LootEncounterLogEntry | MonsterLootEncounterLogEntry;
  shownStep: number;
}>();

const shownStep = computed(() => Math.max(0, props.shownStep || 0));
const isMonsterLoot = computed(() => props.entry.kind === 'MonsterLootEncounter');

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

const hasTimeRegen = computed(() => (props.entry.timeRegenHpAfter || 0) > (props.entry.timeRegenHpBefore || 0));
const timeRegenAmount = computed(() => (props.entry.timeRegenHpAfter || 0) - (props.entry.timeRegenHpBefore || 0));

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  if (m < 1) return `${sec} seconds`;
  if (m === 1) return '1 minute';
  return `${m} minutes`;
}
</script>

<style scoped>
.time-regen { margin-top: 8px; }
</style>
