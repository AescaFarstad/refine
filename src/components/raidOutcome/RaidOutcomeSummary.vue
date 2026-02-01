<template>
  <section class="modal-footer-info">
    <div class="summary" v-if="raidSuccess && (gainedItems.length || discardedItems.length)">
      <div class="summary-row" v-if="gainedItems.length">
        <div class="summary-cap">Gained</div>
        <div class="summary-items">
          <ItemDisplay v-for="it in gainedItems" :key="'g-'+it.id" :id="it.id" :quantity="it.quantity" />
        </div>
      </div>
      <div class="summary-row" v-if="discardedItems.length">
        <div class="summary-cap">Discarded</div>
        <div class="summary-items dim">
          <ItemDisplay v-for="it in discardedItems" :key="'d-'+it.id" :id="it.id" :quantity="it.quantity" :minor="true" />
        </div>
      </div>
    </div>
    <section class="quest-rewards" v-if="raidSuccess && rewardChips.length">
      <div class="qr-chips">
        <span v-for="(chip, i) in rewardChips" :key="i" class="chip" :class="chip.class" :style="chip.style">{{ chip.text }}<span v-if="chip.value" class="chip-value">{{ chip.value }}</span></span>
      </div>
    </section>
    <section class="raid-changes" v-if="raidChangesPills.length || zoneChangeParsed">
      <div class="rc-row" v-if="raidChangesPills.length">
        <div class="rc-pills">
          <span v-for="(pill, i) in raidChangesPills" :key="i" class="rc-pill" :class="pill.positive ? 'positive' : 'negative'">{{ pill.label }}<span v-if="pill.value" class="rc-value">{{ pill.value }}</span></span>
        </div>
      </div>
      <div class="rc-row inline" v-if="zoneChangeParsed">
        <div class="rc-cap">Zone deterioration: </div>
        <span class="rc-pill negative">{{ zoneChangeParsed.label }}<span v-if="zoneChangeParsed.value" class="rc-value">{{ zoneChangeParsed.value }}</span></span>
      </div>
    </section>
    <section class="barely-in-time" v-if="raidSuccess && barelyInTime">
      <div class="bt">You barely escaped the collapsing zone.</div>
    </section>
    <section class="new-quests" v-if="raidSuccess && newQuests.length">
      <div class="nq" v-for="(quest, i) in newQuests" :key="i">
        <span class="nq-text">New investigation available: <strong class="nq-quest-name">{{ quest.name }}</strong></span>
        <div class="nq-hint" role="tooltip">
          <QuestHint :quest="quest" />
        </div>
      </div>
    </section>
  </section>
  <section class="death-note" v-if="!raidSuccess">
    <div class="zc">You died. The time loop resets.</div>
    <div class="reimbursed" v-if="reimbursedCredits > 0">
      Reimbursed: <strong>{{ reimbursedCredits }} CR</strong>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import ItemDisplay from '../ItemDisplay.vue';
import QuestHint from '../QuestHint.vue';
import { getGameLib, getGameState } from '../../logic/UIState';
import type { RaidOutcome } from '../../logic/GameState';
import { describeMutation, type RaidMutation } from '../../logic/RaidMutation';
import { getResourceSpec, type ResourceKey } from '../../logic/Resources';

type RewardChip = { text: string; value?: string; class: string; style?: Record<string, string> };
type RaidChangePill = { label: string; value: string; positive: boolean };

const props = defineProps<{
  outcome: RaidOutcome;
}>();

const raidSuccess = computed(() => props.outcome.success);
const gainedItems = computed(() => props.outcome.looted.filter(it => it.quantity > 0));
const discardedItems = computed(() => props.outcome.discarded.filter(it => it.quantity > 0));
const zoneChangeParsed = computed(() => props.outcome.zoneChange);
const barelyInTime = computed(() => props.outcome.barelyInTime);
const reimbursedCredits = computed(() => props.outcome.reimbursedCredits);

const newQuests = computed(() => {
  const ids = props.outcome.newQuestsAvailable;
  const lib = getGameLib()!;
  return ids.map(id => lib.quests.get(id)!);
});

const rewardChips = computed<RewardChip[]>(() => {
  const out: RewardChip[] = [];
  const rewards = props.outcome.rewardsApplied;
  const lib = getGameLib()!;

  const resourceTotals: Record<ResourceKey, number> = {
    skillPoints: 0,
    credits: 0,
    chronotraces: 0,
    timeFlux: 0,
    shardDust: 0,
  };
  const gearTotals: Record<string, number> = {};
  const unlockedRaidIds: string[] = [];
  for (const r of rewards) {
    if (r.kind === 'resource') {
      resourceTotals[r.resource] += r.amount;
    } else if (r.kind === 'countable_gear') {
      gearTotals[r.gearId] = (gearTotals[r.gearId] ?? 0) + r.amount;
    } else if (r.kind === 'unlock_raid') {
      unlockedRaidIds.push(r.raidId);
    }
  }

  const resourceKeys = ['skillPoints', 'credits', 'chronotraces', 'timeFlux', 'shardDust'] as const;
  for (const k of resourceKeys) {
    const v = resourceTotals[k];
    if (v > 0) out.push({ text: `+${v}${getResourceSpec(k).glyph}`, class: 'res', style: resourceChipStyle(k) });
  }

  for (const [gearId, amount] of Object.entries(gearTotals)) {
    const gearName = lib.gear.get(gearId)!.name;
    out.push({ text: gearName, value: `+${amount}`, class: 'gear', style: { background: 'rgba(50, 30, 60, 0.7)', borderColor: 'rgba(139, 92, 246, 0.35)' } });
  }

  for (const raidId of unlockedRaidIds) {
    const raidName = lib.raids.get(raidId)!.name;
    out.push({ text: 'Unlocked:', value: raidName, class: 'raid-unlock', style: { background: 'rgba(60, 50, 20, 0.7)', borderColor: 'rgba(251, 191, 36, 0.35)' } });
  }

  return out;
});

function resourceChipStyle(key: ResourceKey): Record<string, string> {
  const spec = getResourceSpec(key);
  return { color: spec.color, background: spec.bgColor };
}

function isMutationPositive(m: RaidMutation): boolean {
  switch (m.kind) {
    case 'LootMutation': return m.count > 0; // more loot sites = good
    case 'WalkMutation': return m.count < 0; // less walking = good
    case 'AddMonsterMutation': return m.count < 0; // fewer monsters = good
    case 'LootDifficultyMutation': return m.amount > 0; // higher loot chance = good
    case 'UpgradeMonsterMutation': return false; // stronger monsters = bad
    case 'QuestMutation': return m.count > 0; // more quests = good
    case 'ZoneCollapseTimeMutation': return m.amount > 0; // more time = good
  }
}

const raidChangesPills = computed<RaidChangePill[]>(() => {
  const out: RaidChangePill[] = [];
  const lc = props.outcome.lootChanceDeltaApplied;
  if (lc !== 0) {
    out.push({ label: 'Loot chance', value: `${lc >= 0 ? '+' : ''}${lc}%`, positive: lc > 0 });
  }
  const rb = props.outcome.lootingRarityBuffDeltaApplied;
  if (rb !== 0) {
    out.push({ label: 'Loot rarity', value: `${rb >= 0 ? '+' : ''}${rb}`, positive: rb > 0 });
  }
  if (props.outcome.raidMutationsApplied.length) {
    const gs = getGameState()!;
    for (const m of props.outcome.raidMutationsApplied) {
      const { label, value } = describeMutation(gs, m);
      out.push({ label, value, positive: isMutationPositive(m) });
    }
  }
  if (props.outcome.raidItemsAdded.length) {
    const lib = getGameLib()!;
    for (const id of props.outcome.raidItemsAdded) {
      out.push({ label: 'New drop:', value: lib.getItem(id).name, positive: true });
    }
  }
  return out;
});
</script>

<style scoped>
.modal-footer-info { margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--panel-border); }
.summary { margin-top: 16px; margin-bottom: 12px; display: grid; gap: 8px; }
.summary-row { display: grid; gap: 6px; }
.summary-cap { font-weight: 900; letter-spacing: 0.04em; opacity: 0.95; }
.summary-items { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 8px; }
.summary-items.dim { filter: grayscale(0.9); }
.summary-items.dim :deep(.item-cell) { opacity: 0.55; }

.new-quests { margin-top: 10px; display: grid; gap: 6px; }
.new-quests .nq { padding: 8px 10px; border-radius: 6px; background: rgba(250, 204, 21, 0.08); border: 1px solid rgba(250, 204, 21, 0.25); font-weight: 500; color: rgba(250, 204, 21, 0.95); position: relative; }
.nq-text { display: block; }
.nq-hint {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 0;
  display: none;
  z-index: 20;
  background: var(--hint-bg);
  border: 1px solid var(--hint-border);
  border-radius: 6px;
  padding: 10px 12px;
  min-width: 160px;
  width: max-content;
  max-width: 75vw;
  box-shadow: inset 0 1px 0 var(--panel-shine), 0 8px 24px rgba(0,0,0,0.5);
  pointer-events: none;
}
.nq-hint::before {
  content: '';
  position: absolute;
  top: 100%;
  left: 12px;
  width: 10px;
  height: 10px;
  background: var(--hint-bg);
  border-right: 1px solid var(--hint-border);
  border-bottom: 1px solid var(--hint-border);
  transform: rotate(45deg);
}
.nq:hover .nq-hint { display: block; }
.barely-in-time { margin-top: 10px; padding: 8px 10px; border: none; border-radius: 6px; background: rgba(251, 146, 60, 0.10); border: 1px solid rgba(251, 146, 60, 0.3); }
.barely-in-time .bt { font-weight: 500; color: #fb923c; font-style: italic; }
.quest-rewards { margin-top: 10px; }
.qr-chips { display: flex; flex-wrap: wrap; gap: 8px; }
.chip { display: inline-flex; align-items: baseline; padding: 4px 10px; border-radius: 4px; background: rgba(255,255,255,0.06); font-size: 13px; font-weight: 600; }
.chip.gear {
  color: #c4b5fd;
  padding: 6px 14px;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 400;
  letter-spacing: 0.02em;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}
.chip.raid-unlock {
  color: #fcd34d;
  padding: 6px 14px;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 400;
  letter-spacing: 0.02em;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}
.chip-value {
  font-weight: 800;
  filter: brightness(1.3);
  margin-left: 0.4em;
}

/* Raid changes section */
.raid-changes { margin-top: 10px; display: grid; gap: 8px; }
.rc-row { display: grid; gap: 8px; }
.rc-row.inline { display: flex; align-items: center; gap: 10px; }
.rc-cap { font-weight: 900; letter-spacing: 0.04em; font-size: 11px; text-transform: uppercase; color: rgba(79, 209, 197, 0.8); }
.rc-pills { display: flex; flex-wrap: wrap; gap: 8px; }
.rc-pill {
  display: inline-flex;
  align-items: center;
  padding: 6px 14px;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 400;
  letter-spacing: 0.02em;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
}
.rc-pill.positive {
  background: rgba(20, 60, 55, 0.7);
  color: #5eead4;
  border-color: rgba(79, 209, 197, 0.35);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}
.rc-pill.negative {
  background: rgba(60, 20, 20, 0.7);
  color: #fca5a5;
  border-color: rgba(239, 68, 68, 0.35);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}
.rc-pill .rc-value {
  font-weight: 800;
  filter: brightness(1.3);
  margin-left: 0.4em;
}
.death-note { margin-top: 10px; padding: 8px 10px; border: none; border-radius: 6px; background: rgba(255,255,255,0.03); }
.reimbursed { margin-top: 6px; color: #86efac; font-size: 0.95em; }
/* Ensure tooltips are always fully opaque when visible, even for dimmed items */
.summary-items.dim :deep(.tooltip-panel) {
  filter: none !important;
}
</style>
