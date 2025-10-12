<template>
  <div v-if="open && hasAny" class="modal-backdrop">
    <div class="modal">
      <header class="modal-header">
        <h3>Level Up</h3>
        <div class="available">Points available: <strong>{{ available }}</strong></div>
      </header>

      <section class="modal-body">
        <div class="options">
          <button class="btn primary" @click="choose('strength')">
            Increase Strength ({{ sNow }} → {{ sNext }})
          </button>
          <button class="btn primary" @click="choose('volume')">
            Increase Volume ({{ vNow }} → {{ vNext }})
          </button>
          <button class="btn primary" @click="choose('looting')">
            Increase Looting ({{ lNow }} → {{ lNext }})
          </button>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue';
import { uiState } from '../logic/UIState';
import { globalInputQueue } from '../logic/Model';
import { CmdLevelup, type LevelupStat } from '../logic/input/InputCommands';
import { LEVEL_UP_STRENGTH as STR, LEVEL_UP_VOLUME as VOL, LEVEL_UP_LOOTING as LTN } from '../logic/Const';

const open = computed(() => uiState.levelUpOpen);
const available = computed(() => uiState.levelupsAvailable || 0);
const hasAny = computed(() => available.value > 0);

const sNow = computed(() => Math.round(uiState.strength || 0));
const sNext = computed(() => sNow.value + STR);
const vNow = computed(() => Math.round(uiState.volume || 0));
const vNext = computed(() => vNow.value + VOL);
const lNow = computed(() => Math.round(uiState.looting || 0));
const lNext = computed(() => lNow.value + LTN);

watch(available, (n) => {
  if (n <= 0) uiState.levelUpOpen = false;
});

function choose(stat: LevelupStat) {
  if (!hasAny.value) return;
  globalInputQueue.push(new CmdLevelup(stat));
}

</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: grid;
  place-items: center;
  z-index: 10000;
}
.modal {
  width: min(520px, 92vw);
  background: linear-gradient(180deg, rgba(20, 28, 40, 0.98), rgba(10, 15, 26, 0.94));
  border: 1px solid var(--panel-border);
  border-radius: 6px;
  box-shadow: 0 24px 64px rgba(0,0,0,0.7), inset 0 1px 0 var(--panel-shine);
  padding: 16px;
}
.modal-header { display: flex; align-items: baseline; justify-content: space-between; }
.modal-header h3 { margin: 0; font-size: 18px; letter-spacing: 0.02em; }
.available { color: var(--text-secondary); }

.options { display: grid; gap: 10px; margin-top: 10px; }
.btn {
  padding: 10px 14px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  border-radius: 4px;
  border: 1px solid var(--panel-border);
  cursor: pointer;
}
.btn.primary { background: rgba(79, 209, 197, 0.14); color: var(--accent); }
.btn.primary:hover { background: rgba(79, 209, 197, 0.22); }

</style>
