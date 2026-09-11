<template>
  <div class="dev-monsters">
    <button class="close-btn" type="button" @click="emit('close')">Close</button>

    <main class="tree" :aria-label="`Monster upgrade tree, ${monsterCount} monsters`">
      <table class="tree-table">
        <thead>
          <tr>
            <th>Monster</th>
            <th>Stats</th>
            <th>Features</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in monsterRows"
            :key="row.monster.id"
            class="tree-row"
          >
            <td>
              <div class="monster-cell">
                <span
                  v-for="n in row.depth"
                  :key="n"
                  class="indent"
                />
                <span
                  class="branch"
                  :class="{
                    terminal: row.children.length === 0,
                    explicit: !!row.parentUpgradeWasExplicit,
                    inferred: row.parentUpgradeWasExplicit === false,
                  }"
                >
                  <span v-if="row.parentUpgradeWasExplicit === true">explicit</span>
                  <span v-else-if="row.parentUpgradeWasExplicit === false">inferred</span>
                </span>
                <div>
                  <div class="monster-name">{{ row.monster.name }}</div>
                  <div class="monster-id">{{ row.monster.id }}</div>
                </div>
              </div>
            </td>

            <td>
              <div class="stats-cell">
                <span>hp {{ row.monster.hp }}</span>
                <span>dmg {{ row.monster.damage }}</span>
                <span>acc {{ row.monster.accuracy }}%</span>
                <span>dodge {{ row.monster.dodge }}%</span>
                <span v-if="row.monster.armor > 0">armor {{ row.monster.armor }}</span>
                <span v-if="row.monster.damageCap > 0">cap {{ row.monster.damageCap }}</span>
                <span>str {{ formatStrength(row.monster.strength) }}</span>
              </div>
            </td>

            <td>
              <div class="features-cell">
                <span v-if="row.monster.biopsyBuff !== 0">biopsy +{{ row.monster.biopsyBuff }}</span>
                <span v-for="feature in row.monster.features" :key="feature">{{ feature }}</span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { uiState, type ReadonlyLib } from '../logic/UIState';

type ReadonlyMonsterDefinition = ReadonlyLib['monsters'] extends ReadonlyMap<string, infer V> ? V : never;

interface MonsterTreeRow {
  monster: ReadonlyMonsterDefinition;
  depth: number;
  children: ReadonlyMonsterDefinition[];
  parentUpgradeWasExplicit: boolean | null;
}

const emit = defineEmits<{ (e: 'close'): void }>();

const monstersById = computed(() => uiState.lib!.monsters);
const monsterCount = computed(() => monstersById.value.size);

const childrenByMonsterId = computed(() => {
  const children = new Map<string, ReadonlyMonsterDefinition[]>();
  for (const monster of monstersById.value.values()) {
    if (!monster.inferredUpgrade) continue;
    const upgrade = monstersById.value.get(monster.inferredUpgrade)!;
    const existing = children.get(monster.id);
    if (existing) {
      existing.push(upgrade);
    } else {
      children.set(monster.id, [upgrade]);
    }
  }

  for (const childList of children.values()) {
    childList.sort(sortMonsters);
  }

  return children;
});

const monsterRows = computed<MonsterTreeRow[]>(() => {
  const childIds = new Set<string>();
  for (const monster of monstersById.value.values()) {
    if (monster.inferredUpgrade) childIds.add(monster.inferredUpgrade);
  }

  const roots = Array.from(monstersById.value.values())
    .filter(monster => !childIds.has(monster.id))
    .sort(sortMonsters);

  const rows: MonsterTreeRow[] = [];
  for (const root of roots) {
    pushMonsterRows(rows, root, 0, null);
  }
  return rows;
});

function pushMonsterRows(
  rows: MonsterTreeRow[],
  monster: ReadonlyMonsterDefinition,
  depth: number,
  parentUpgradeWasExplicit: boolean | null
): void {
  const children = childrenByMonsterId.value.get(monster.id) ?? [];
  rows.push({ monster, depth, children, parentUpgradeWasExplicit });
  for (const child of children) {
    pushMonsterRows(rows, child, depth + 1, monster.upgrade === child.id);
  }
}

function sortMonsters(a: ReadonlyMonsterDefinition, b: ReadonlyMonsterDefinition): number {
  if (a.strength !== b.strength) return a.strength - b.strength;
  return a.id < b.id ? -1 : 1;
}

function formatStrength(strength: number): string {
  return Math.round(strength).toLocaleString();
}
</script>

<style scoped>
.dev-monsters {
  position: relative;
  width: 100%;
  height: 100%;
  background: #080d16;
  color: var(--text-primary);
}

.close-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 3;
  border: 1px solid var(--panel-border);
  border-radius: 4px;
  padding: 6px 10px;
  background: rgba(20, 28, 40, 0.92);
  color: var(--text-primary);
  cursor: pointer;
}

.tree {
  height: 100%;
  overflow: auto;
  padding: 10px 56px 16px 14px;
}

.tree-table {
  width: max-content;
  border-collapse: separate;
  border-spacing: 18px 0;
  table-layout: auto;
}

th,
td {
  padding: 0;
  vertical-align: middle;
  white-space: nowrap;
}

th {
  position: sticky;
  top: -10px;
  z-index: 1;
  padding: 6px 0;
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-align: left;
  text-transform: uppercase;
  background: #080d16;
  border-bottom: 1px solid var(--panel-border);
}

td {
  padding: 7px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.tree-row:hover td {
  background: rgba(255, 255, 255, 0.035);
}

.tree-row td:first-child,
.tree-table th:first-child {
  padding-left: 0;
}

.tree-row td:last-child,
.tree-table th:last-child {
  padding-right: 0;
}

.monster-cell,
.stats-cell,
.features-cell {
  width: max-content;
}

.monster-cell {
  display: flex;
  align-items: center;
  min-width: 0;
}

.stats-cell,
.features-cell {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.features-cell {
  max-width: 360px;
  white-space: normal;
}

.stats-cell span,
.features-cell span {
  border-radius: 3px;
  padding: 2px 5px;
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-secondary);
  font-size: 11px;
}

.tree-row {
  width: max-content;
}

.indent {
  flex: 0 0 22px;
  align-self: stretch;
  border-left: 1px solid rgba(255, 255, 255, 0.1);
}

.branch {
  flex: 0 0 58px;
  height: 16px;
  margin-right: 6px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.06);
  color: var(--text-secondary);
  font-size: 10px;
  line-height: 16px;
  text-align: center;
}

.branch.terminal {
  background: rgba(248, 113, 113, 0.12);
}

.branch.explicit {
  background: rgba(79, 209, 197, 0.16);
  color: var(--accent);
}

.branch.inferred {
  background: rgba(251, 191, 36, 0.16);
  color: rgb(251, 191, 36);
}

.monster-name {
  font-weight: 700;
}

.monster-id {
  margin-top: 1px;
  color: var(--text-secondary);
  font-size: 11px;
  font-family: var(--font-mono);
}

@media (max-width: 760px) {
  .tree {
    padding: 8px 52px 14px 10px;
  }
}
</style>
