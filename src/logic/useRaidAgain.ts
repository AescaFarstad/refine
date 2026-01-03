import { computed } from 'vue';
import { uiState, getGameState } from './UIState';
import { globalInputQueue } from './Model';
import { CmdAknowledgeOutcome, CmdStartRaid } from './input/InputCommands';
import { formatDurationHM } from './StringUtils';

export function useRaidAgain() {
  const raidId = computed(() => uiState.lastOutcome!.id.trim());

  const raidGearPrice = computed(() => {
    const id = raidId.value;
    const gs = getGameState();
    const gearIds = gs.loadouts[id];
    let total = 0;
    for (const gearId of gearIds) {
      total += gs.lib.gear.get(gearId)!.price;
    }
    return total;
  });

  const questWasCompleted = computed(() => uiState.lastOutcome!.questsCompleted.length > 0);

  const canAffordRaidAgain = computed(() => uiState.credits >= raidGearPrice.value);

  const survivalChance = computed(() => Math.max(0, Math.min(100, Math.round(uiState.raidSurvivalPct))));
  const estimatedTime = computed(() => formatDurationHM(Math.max(0, uiState.raidTimeEstimateSec)));
  const raidAgainButtonLabel = computed(() => `Raid Again (~${survivalChance.value}% / ~${estimatedTime.value})`);

  const canRaidAgain = computed(() => !questWasCompleted.value && canAffordRaidAgain.value);

  const raidAgainDisabledReason = computed(() => {
    if (questWasCompleted.value) return 'Investigation completed - you may need to choose another one';
    if (!canAffordRaidAgain.value) return `Not enough credits (need ${raidGearPrice.value})`;
    return '';
  });

  function raidAgain() {
    globalInputQueue.push(new CmdAknowledgeOutcome());
    globalInputQueue.push(new CmdStartRaid({ id: raidId.value }));
  }

  return {
    raidAgain,
    canRaidAgain,
    raidAgainButtonLabel,
    raidAgainDisabledReason,
    raidGearPrice,
    questWasCompleted,
    canAffordRaidAgain,
  };
}
