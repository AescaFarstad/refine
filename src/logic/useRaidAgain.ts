import { computed } from 'vue';
import { uiState, getGameState, ReadonlyGameState } from './UIState';
import { formatDurationHM } from './StringUtils';
import { questIsActive } from './RaidMutation';
import { startRaidWithPerkFlow } from './startRaidWithPerkFlow';

export function hasMissingRequiredQuestGear(gs: ReadonlyGameState, raidId: string): boolean {
  const loadout = gs.loadouts[raidId] ?? [];
  const equipped = new Set(loadout);
  let missing = false;
  gs.lib.quests.forEach((q) => {
    if (missing) return;
    if (!q.gearRequired.length) return;
    if (!questIsActive(gs, q, raidId)) return;
    for (const gearId of q.gearRequired) {
      if (!equipped.has(gearId)) {
        missing = true;
        return;
      }
    }
  });
  return missing;
}

export function getRaidGearCost(gs: ReadonlyGameState, raidId: string): number {
  const gearIds = gs.loadouts[raidId] ?? [];
  const raidEntry = gs.unlockedRaids.find(r => r.id === raidId);
  const seen = new Set<string>();
  let total = 0;
  for (const gearId of gearIds) {
    if (seen.has(gearId)) continue;
    seen.add(gearId);
    const gear = gs.lib.gear.get(gearId)!;
    const priceAdjustment = raidEntry?.gearPriceAdjustments?.[gearId] ?? 0;
    total += Math.max(0, gear.price + priceAdjustment);
  }
  return Math.max(0, Math.floor(total));
}

export function getRaidStartFailureReason(gs: ReadonlyGameState, raidId: string): string {
  if (!raidId) return 'No raid selected.';
  const unlocked = gs.unlockedRaids.some(r => r.id === raidId);
  if (!unlocked) return 'Raid not unlocked.';
  if (hasMissingRequiredQuestGear(gs, raidId)) return 'Gear required for the selected objective is not equipped.';
  const cost = getRaidGearCost(gs, raidId);
  if (cost > 0 && gs.credits < cost) return `Not enough credits (need ${cost})`;
  return '';
}

export function useRaidAgain() {
  const raidId = computed(() => uiState.lastOutcome!.id.trim());

  const raidGearPrice = computed(() => {
    // to trigger re-calc even if raidId is same as before
    const _tracker = uiState.lastOutcome;
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    uiState.raidKey;

    const id = raidId.value;
    const gs = getGameState();
    return getRaidGearCost(gs, id);
  });

  const questWasCompleted = computed(() => uiState.lastOutcome!.questsCompleted.length > 0);

  const canAffordRaidAgain = computed(() => uiState.credits >= raidGearPrice.value);
  const missingRequiredQuestGear = computed(() => {
    // Touch reactive keys so recompute happens on gear/quest changes
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    uiState.raidKey;
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    uiState.activeQuests.length;
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    uiState.lastOutcome;
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    uiState.questPrereqsVersion;

    return hasMissingRequiredQuestGear(getGameState(), raidId.value);
  });

  const survivalChance = computed(() => Math.max(0, Math.min(100, Math.round(uiState.raidSurvivalPct))));
  const estimatedTime = computed(() => formatDurationHM(Math.max(0, uiState.raidTimeEstimateSec)));
  const raidAgainButtonLabel = computed(() => `Raid Again (~${survivalChance.value}% / ~${estimatedTime.value})`);

  const raidStartFailureReason = computed(() => {
    return getRaidStartFailureReason(getGameState(), raidId.value);
  });

  const canRaidAgain = computed(() => /* !questWasCompleted.value && */ raidStartFailureReason.value === '');

  const raidAgainDisabledReason = computed(() => {
    return raidStartFailureReason.value;
  });

  function raidAgain() {
    startRaidWithPerkFlow(raidId.value, true);
  }

  return {
    raidAgain,
    canRaidAgain,
    raidAgainButtonLabel,
    raidAgainDisabledReason,
    raidGearPrice,
    questWasCompleted,
    canAffordRaidAgain,
    missingRequiredQuestGear,
  };
}
