<template>
  <div class="fight-rows">
    <template v-for="(ev, j) in (entry.fightLog || [])" :key="'fe-'+j">
      <template v-if="shownStep >= (Number(j) + 1)">
        <div class="fr-grid">
          <div class="cell who">You</div>
          <div class="cell outcome" :class="ev.hitLanded ? 'hit-you' : 'miss-you'"><strong>{{ ev.hitLanded ? 'HIT!' : 'MISS!' }}</strong></div>
          <div class="cell roll">
            <span class="roll-target">{{ ev.theirDodgeValue }}</span>
            <span class="roll-vs">vs</span>
            <span class="roll-self">{{ ev.myHitRoll }}</span>
          </div>
          <div class="cell after" v-html="ev.hitLanded ? hpChange('their', ev.theirHpBefore, ev.theirHpAfter) : ''"></div>
        </div>

        <div class="note-row stun-note" v-if="ev.stunTriggered" v-html="stunLine(ev)"></div>

        <template v-if="!ev.hitLanded || (ev.hitLanded && ev.theirHitValue > 0)">
          <div class="fr-grid">
            <div class="cell who">They</div>
            <div class="cell outcome" :class="(!ev.blocked && ev.damageReceived > 0) ? 'hit-they' : 'miss-they'"><strong>{{ ev.selfDestructed ? 'EXPLODE!' : ((!ev.blocked && ev.damageReceived > 0) ? 'HIT!' : 'MISS!') }}</strong></div>
            <div class="cell roll">
              <span class="roll-target">{{ ev.myBlockRoll }}</span>
              <span class="roll-vs">vs</span>
              <span class="roll-self">{{ ev.theirHitValue }}</span>
            </div>
            <div class="cell after" v-html="(!ev.blocked && ev.damageReceived > 0) ? hpChange('your', ev.myHpBefore, ev.myHpAfter) : ''"></div>
          </div>

          <div class="note-row reflect-note" v-if="ev.reflectedDamage > 0" v-html="reflectLine(ev)"></div>
        </template>

        <div class="note-row summon-note" v-if="ev.summonTriggered"><b>Another {{ entry.monsterName }} joins the fray!</b></div>
      </template>
    </template>
  </div>
  <div class="note-row regen-note" v-if="hasRegen && shownStep >= regenStep">
    Regenerated health: {{ entry.hpBeforeRegen }} → <b>{{ entry.hpAfterRegen }}</b>
  </div>
  <div class="note-row" v-show="entry.dieFromOvertime && shownStep >= overtimeStep">You die of overexertion.</div>
  <div class="note-row biopsy-note" v-show="useBiopsy && shownStep >= biopsyStep">You examine their body...</div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { FightEncounterLogEntry, FightEvent } from '../../logic/RaidLog';

const props = defineProps<{
  entry: FightEncounterLogEntry;
  shownStep: number;
}>();

const shownStep = computed(() => Math.max(0, props.shownStep || 0));
const rounds = computed(() => Math.max(0, props.entry?.fightLog?.length || 0));
const hasRegen = computed(() => (props.entry?.hpAfterRegen || 0) > (props.entry?.hpBeforeRegen || 0));
const useBiopsy = computed(() => biopsyUsed(props.entry));

const regenStep = computed(() => rounds.value + 1);
const overtimeStep = computed(() => rounds.value + (hasRegen.value ? 1 : 0) + 1);
const biopsyStep = computed(() => rounds.value + (hasRegen.value ? 1 : 0) + (props.entry?.dieFromOvertime ? 1 : 0) + 1);

function hpChange(who: 'their' | 'your', before: number, after: number, _terse = false): string {
  const label = who === 'your' ? 'Your hp' : 'Their hp';
  const b = Math.max(0, before || 0);
  const a = Math.max(0, after || 0);
  const arrow = '→';
  const cls = who === 'your' ? 'hp-your' : 'hp-their';
  const afterSpan = who === 'your' ? `<b>${a}</b>` : `<span class="hl"><b>${a}</b></span>`;
  const line = `${label} ${b} ${arrow} ${afterSpan}`;
  return `<span class="${cls}">${line}</span>`;
}

function reflectLine(ev: FightEvent): string {
  const on = ev.blocked ? 'miss' : 'hit';
  return `They receive damage reflection on ${on}. ${hpChange('their', ev.theirHpBefore, ev.theirHpAfter, true)}`;
}

function stunLine(ev: FightEvent): string {
  const before = ev.hitChanceBefore;
  const after = ev.hitChanceAfter;
  return `You stun the target. Chance to hit them: <b>${before}</b> → <b>${after}</b>`;
}

function biopsyUsed(entry: FightEncounterLogEntry): boolean {
  return !!(entry?.fightLog || []).find((ev: FightEvent) => !!ev.biopsyTriggered);
}
</script>
