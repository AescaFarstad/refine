<template>
  <div class="raid-card" :class="{ locked }">
    <header class="raid-header">
      <h3 class="raid-title">{{ def.name }}</h3>
      <div class="raid-duration meta">{{ def.durationMin }} min</div>
    </header>

    <div v-if="locked" class="locked-banner">Locked</div>

    <template v-else>
      <div class="quest-progress" :class="{ hidden: !showQuestProgress }">
        <div class="bar">
          <div class="fill" :style="{ width: showQuestProgress ? (questProgressPct + '%') : '0%' }" />
          <div class="label">Quest {{ questProgress }} / {{ questTarget }}</div>
        </div>
      </div>

      <div class="difficulty">
        <span class="label">Difficulty</span>
        <span class="value diff">{{ def.difficulty }}</span>
        <span class="vs">vs</span>
        <span class="value player">{{ Math.round(stats.effectiveStrength) }}</span>
        <span class="suffix">Strength</span>
      </div>

      <div class="equipment">
        <div class="eq-top">
          <div class="eq-title">Equipment:</div>
          <div class="eq-price">{{ equipmentPrice }}◈ Credits</div>
        </div>
        <div class="eq-buttons">
          <button class="eq" :class="{ active: equipment === 'light' }" :disabled="disabled" @click="$emit('select-equipment', def.id, 'light')">Light</button>
          <button class="eq" :class="{ active: equipment === 'medium' }" :disabled="disabled" @click="$emit('select-equipment', def.id, 'medium')">Balanced</button>
          <button class="eq" :class="{ active: equipment === 'overprice' }" :disabled="disabled" @click="$emit('select-equipment', def.id, 'overprice')">Overprice</button>
        </div>
      </div>

      <div class="focus">
        <div class="focus-title">Focus on:</div>
        <div class="sliders">
          <div class="row">
            <div class="name">Quest</div>
            <input class="range" type="range" min="50" max="150" step="1" v-model.number="sliders.quest" :disabled="disabled" />
            <div class="value">{{ questDelta }}</div>
          </div>
          <div class="row">
            <div class="name">Survive</div>
            <input class="range" type="range" min="50" max="150" step="1" v-model.number="sliders.survive" :disabled="disabled" />
            <div class="value">{{ stats.survivalChancePct }}% chance</div>
          </div>
          <div class="row">
            <div class="name">Loot</div>
            <input class="range" type="range" min="50" max="150" step="1" v-model.number="sliders.loot" :disabled="disabled" />
            <div class="value">{{ stats.lootRatePct }}% rate</div>
          </div>
        </div>
      </div>

      <div class="actions">
        <template v-if="isActive">
          <div class="active-progress">
            <div class="bar">
              <div class="fill active" :style="{ width: activeProgress + '%' }" />
              <div class="label">{{ Math.round(activeProgress) }}%</div>
            </div>
          </div>
        </template>
        <template v-else>
          <button
            v-if="!anyActive"
            class="time-advance-btn"
            type="button"
            @click="deploy"
          >
            <span class="btn-label">Deploy</span>
            <span class="icon-play" aria-hidden="true">▶</span>
          </button>
          <button v-else class="wait" disabled>Wait</button>
        </template>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { UIRaidDef } from '../logic/UIState';
import { computeRaidStatsUI } from '../logic/UIState';
import { QUEST_POINTS } from '../logic/GameState';
import { globalInputQueue } from '../logic/Model';
import { CmdAdvanceTime, CmdStartRaid } from '../logic/input/InputCommands';

const props = defineProps<{
  def: UIRaidDef;
  locked: boolean;
  questProgress: number;
  questsDone: number;
  sliders: { quest: number; survive: number; loot: number };
  isActive: boolean;
  anyActive: boolean;
  activeProgress: number;
  equipment: 'light' | 'medium' | 'overprice';
}>();

defineEmits<{
  (e: 'select-equipment', id: string, equipment: 'light' | 'medium' | 'overprice'): void;
}>();

const disabled = computed(() => props.isActive);
const stats = computed(() =>
  computeRaidStatsUI(
    props.def,
    props.sliders.quest,
    props.sliders.survive,
    props.sliders.loot,
    props.equipment,
  )
);
const questDelta = computed(() => {
  const n = Math.round(stats.value.questDeltaPct || 0);
  const sign = n > 0 ? '+' : '';
  return `${sign}${n}`;
});
const equipmentPrice = computed(() => stats.value.equipmentPrice);

// Quest target and percentage for progress bar (absolute, not percent label)
const questTarget = computed(() => Math.round(QUEST_POINTS * Math.pow(2, props.questsDone || 0)));
const questProgressPct = computed(() => {
  const target = questTarget.value || 1;
  const pct = (props.questProgress / target) * 100;
  return Math.max(0, Math.min(100, Math.round(pct)));
});

// Only show quest progress bar if there is any progress or completed quests
const showQuestProgress = computed(() => {
  return (props.questProgress || 0) > 0 || (props.questsDone || 0) > 0;
});

function deploy() {
  globalInputQueue.push(new CmdStartRaid({
    id: props.def.id,
    quest: props.sliders.quest,
    survive: props.sliders.survive,
    loot: props.sliders.loot,
    equipment: props.equipment,
    cost: equipmentPrice.value,
  }));
  // Immediately advance time after deploying to the raid
  globalInputQueue.push(new CmdAdvanceTime());
}
</script>

<style scoped>
.raid-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: rgba(25, 35, 50, 0.65);
  border: 1px solid var(--panel-border);
  border-radius: 4px;
  padding: 14px;
  box-sizing: border-box;
  height: 360px; /* fixed card height for consistent grid size */
  width: 320px;  /* fixed card width */
}
.raid-header { display: flex; align-items: baseline; justify-content: space-between; }
.raid-title { margin: 0; font-size: 16px; letter-spacing: 0.03em; }

.locked-banner {
  font-size: 22px;
  font-weight: 800;
  text-align: center;
  color: var(--text-disabled);
  padding: 24px 12px;
  border: 1px dashed var(--panel-border);
  border-radius: 4px;
}

.quest-progress .bar,
.active-progress .bar {
  position: relative;
  height: 18px;
  border: 1px solid var(--panel-border);
  border-radius: 3px;
  background: rgba(255,255,255,0.04);
  overflow: hidden;
}
.quest-progress.hidden { visibility: hidden; }
.quest-progress .fill { height: 100%; background: var(--accent-warm); }
.active-progress .fill.active { height: 100%; background: var(--accent); }
.bar .label { position: absolute; inset: 0; display: grid; place-items: center; font-weight: 700; font-size: 12px; }

.meta { color: var(--text-secondary); font-size: 13px; }

.difficulty {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  align-items: baseline;
  column-gap: 8px;
  font-size: 14px;
  font-weight: 700;
}
.difficulty .label { color: var(--text-secondary); text-align: left; }
.difficulty .value { font-size: 20px; font-weight: 900; letter-spacing: 0.01em; color: var(--accent); text-align: center; }
.difficulty .vs { opacity: 0.8; font-weight: 800; text-align: center; }
.difficulty .suffix { color: var(--text-secondary); text-align: right; font-weight: 700; }

.focus-title { font-weight: 700; margin-bottom: 4px; }
.sliders { display: grid; grid-template-columns: 64px 1fr 100px; gap: 4px 4px; align-items: center; }
.row { display: contents; }
.name { color: var(--text-secondary); }
.range { width: 100%; margin: 0; }
.value { text-align: right; font-variant-numeric: tabular-nums; }

.equipment { display: flex; flex-direction: column; gap: 8px; }
.eq-top { display: flex; align-items: center; justify-content: space-between; }
.eq-title { color: var(--text-secondary); }
.eq-price { color: var(--text-secondary); font-variant-numeric: tabular-nums; }
.eq-buttons { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.eq {
  padding: 6px 10px;
  background: rgba(255,255,255,0.04);
  border: 1px solid var(--panel-border);
  border-radius: 4px;
  color: var(--text-primary);
  cursor: pointer;
  width: 100%;
  text-align: center;
}
.eq.active {
  background: rgba(79, 209, 197, 0.14);
  border-color: var(--accent);
  color: var(--accent);
}

.actions { margin-top: auto; padding-top: 4px; }
.wait {
  width: 100%;
  padding: 10px 12px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  border-radius: 4px;
  border: 1px solid var(--panel-border);
}
.wait { background: rgba(255,255,255,0.04); color: var(--text-secondary); }

/* Shared advance-style button to match TopPanel */
.time-advance-btn {
  height: 32px;
  padding: 0 14px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  border-radius: 4px;
  border: 1px solid rgba(34,197,94,0.35);
  background: rgba(34,197,94,0.18);
  color: #86efac;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  justify-content: center;
}
.time-advance-btn:hover { background: rgba(34,197,94,0.28); }
.time-advance-btn:disabled {
  cursor: not-allowed;
  opacity: 0.55;
  background: rgba(34,197,94,0.10);
  border-color: rgba(34,197,94,0.22);
}
.time-advance-btn:disabled:hover { background: rgba(34,197,94,0.10); }
.time-advance-btn .icon-play {
  display: inline-block;
  font-size: 18px;
  line-height: 1;
  transform: translateY(-2px);
}
</style>
