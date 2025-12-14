import { Connections, IndependentStat } from './Stat';
import { Stats } from './Stats';
import { GameState } from '../GameState';

export interface HypotheticalState {
  key: string;
  connections: Connections;
}

export namespace Hypothetical {

  export function createHypotheticalForAttributeUpgrade(gameState: GameState, attributeStat: IndependentStat, amount: number = 1): void {
    const key = `attr_${attributeStat.name}_${amount}`;
    if (gameState.hypothetical?.key === key) {
      return;
    }

    const newConnections = Stats.cloneConnections(gameState.connections);
    const clonedStat = Stats.getStatAsserted<IndependentStat>(attributeStat.name, newConnections);

    Stats.setIndependentStat(clonedStat, clonedStat.value + amount, newConnections);

    gameState.hypothetical = { key, connections: newConnections };
  }

  export function createHypotheticalForSkillUpgrade(gameState: GameState, skillStat: IndependentStat, amount: number = 1): void {
    const key = `skill_${skillStat.name}_${amount}`;
    if (gameState.hypothetical?.key === key) {
      return;
    }

    const newConnections = Stats.cloneConnections(gameState.connections);
    const clonedStat = Stats.getStatAsserted<IndependentStat>(skillStat.name, newConnections);

    Stats.setIndependentStat(clonedStat, clonedStat.value + amount, newConnections);

    gameState.hypothetical = { key, connections: newConnections };
  }  export function createHypotheticalForSpecUpgrade(gameState: GameState, specStat: IndependentStat, amount: number = 1): void {
    const key = `spec_${specStat.name}_${amount}`;
    if (gameState.hypothetical?.key === key) {
      return;
    }

    const newConnections = Stats.cloneConnections(gameState.connections);
    const clonedStat = Stats.getStatAsserted<IndependentStat>(specStat.name, newConnections);

    Stats.setIndependentStat(clonedStat, clonedStat.value + amount, newConnections);

    gameState.hypothetical = { key, connections: newConnections };
  }

  export function clearHypothetical(gameState: GameState): void {
    if (gameState.hypothetical) {
      gameState.hypothetical = null;
    }
  }
} 