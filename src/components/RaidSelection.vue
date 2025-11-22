<template>
  <div class="raid-carousel">
    <div class="raid-cards">
      <button
        v-for="r in uiState.raids"
        :key="r.id"
        class="raid-card"
        :class="{ active: r.id === activeRaidId, locked: isLocked(r) }"
        type="button"
        :disabled="isLocked(r)"
        aria-disabled="true"
        @click="onSelectRaid(r.id)"
      >
        <div class="raid-title">{{ r.name }}</div>
        <div v-if="isLocked(r)" class="raid-locked">
          <span class="txt">reach {{ currentReach }} / {{ r.reachRequired }}</span>
        </div>
      </button>
    </div>
  </div>

</template>

<script setup lang="ts">
import { computed } from 'vue';
import { uiState, getGameState } from '../logic/UIState';
import { globalInputQueue } from '../logic/Model';
import { CmdSelectRaid } from '../logic/input/InputCommands';
import type { RaidDefinition } from '../logic/RaidLib';

const activeRaidId = computed(() => {
  if (uiState.activeRaidId) return uiState.activeRaidId;
  const firstUnlocked = uiState.raidOrder.find(id => {
    const r = uiState.raids.find(rr => rr.id === id);
    return r ? !isLocked(r as any) : false;
  });
  return firstUnlocked || '';
});

function isLocked(r: RaidDefinition): boolean {
  const gs = getGameState();
  const reach = gs?.reach || 0;
  return reach < Math.max(0, r.reachRequired || 0);
}

// Display helper: current reach value
const currentReach = computed(() => (getGameState()?.reach || 0));

function onSelectRaid(id: string) {
  if (!id) return;
  // Guard in UI as well: do not dispatch selection for locked raids
  const r = uiState.raids.find(rr => rr.id === id);
  if (!r || isLocked(r as any)) return;
  globalInputQueue.push(new CmdSelectRaid({ id }));
}
</script>

<style scoped>
.raid-carousel { padding: 10px; }
/* Fixed-width items, horizontally scrollable */
.raid-cards { display: grid; grid-auto-flow: column; grid-auto-columns: 200px; gap: 10px; overflow-x: auto; }
/* No borders; subtle base background; fixed height */
.raid-card { position: relative; height: 74px; border: none; outline: none; border-radius: 6px; background: rgba(255,255,255,0.03); color: var(--text-primary); cursor: pointer; display: grid; place-items: center; font-weight: 800; letter-spacing: 0.02em; overflow: hidden; }
/* Active: greenish background, no borders */
.raid-card.active { background: rgba(74, 222, 128, 0.15); }
.raid-card.locked {
  --locked-color: rgba(255,255,255,0.2);
  opacity: 0.7;
  cursor: not-allowed;
  border: 3px solid var(--locked-color);
}
.raid-card:disabled { cursor: not-allowed; }
.raid-title { font-size: 16px; }
.raid-card.locked::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  top: 22px; /* below the top reach bar */
  pointer-events: none;
  z-index: 1;
  border-radius: 0; /* rely on parent overflow for perfect match */
  background-image:
    repeating-linear-gradient(45deg, rgba(0, 0, 0, 0.38) 0, rgba(0, 0, 0, 0.38) 8px, transparent 8px, transparent 16px),
    repeating-linear-gradient(-45deg, rgba(0, 0, 0, 0.38) 0, rgba(0, 0, 0, 0.38) 8px, transparent 8px, transparent 16px);
  background-size: 20px 20px, 20px 20px;
}
.raid-locked {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--locked-color);
  font-weight: 800;
  padding: 0 8px;
  text-align: center;
  border-top-left-radius: 4px; /* slightly less rounding than card */
  border-top-right-radius: 4px;
  z-index: 2; /* above hatch overlay */
}
</style>
