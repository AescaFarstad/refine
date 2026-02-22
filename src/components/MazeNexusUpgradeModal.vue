<template>
  <Teleport to="body">
    <div v-if="visible" class="modal-backdrop" @click.self="postpone" @pointerdown.stop>
      <div class="modal" @pointerdown.stop @click.stop>
        <header class="modal-header">
          <h3 class="modal-title">Choose one upgrade</h3>
        </header>

        <section class="modal-body">
          <div class="nexus-choice-items">
            <MazeNexusMenuItem
              v-for="entry in choices"
              :key="`offer:${entry.id}:${entry.rotationStep}`"
              :id="entry.id"
              :item="entry.item"
              :rotation-step="entry.rotationStep"
              :price="entry.price"
              :can-afford="true"
              hint-position="top"
              mode="select"
              @select="select(entry.id)"
            />
          </div>
        </section>

        <footer class="modal-actions">
          <button class="btn" type="button" @click="postpone">Postpone</button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import type { NexusItemDefinition } from '../logic/NexusLib';
import type { DeepReadonly } from '../logic/UIState';
import MazeNexusMenuItem from './MazeNexusMenuItem.vue';

type UINexusItem = DeepReadonly<NexusItemDefinition>;

type UpgradeChoiceEntry = {
  id: string;
  item: UINexusItem;
  rotationStep: number;
  price: number;
};

defineProps<{
  visible: boolean;
  choices: UpgradeChoiceEntry[];
}>();

const emit = defineEmits<{
  (e: 'select', nexusItemId: string): void;
  (e: 'postpone'): void;
}>();

function select(nexusItemId: string): void {
  emit('select', nexusItemId);
}

function postpone(): void {
  emit('postpone');
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
  pointer-events: auto;
}

.modal {
  width: 980px;
  max-width: 96vw;
  background: linear-gradient(180deg, rgba(20, 28, 40, 0.98), rgba(10, 15, 26, 0.94));
  border: 1px solid var(--panel-border);
  border-radius: 6px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.7), inset 0 1px 0 var(--panel-shine);
  padding: 16px;
  display: grid;
  grid-template-rows: auto 1fr auto;
  gap: 16px;
  max-height: 90vh;
  pointer-events: auto;
  overflow: visible;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.modal-title {
  margin: 0;
  font-size: 18px;
  font-weight: 800;
  letter-spacing: 0.02em;
}

.modal-body {
  overflow: visible;
}

.nexus-choice-items {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  overflow: visible;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
}

.btn {
  padding: 10px 14px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  border-radius: 4px;
  border: 1px solid var(--panel-border);
  cursor: pointer;
  background: rgba(255, 255, 255, 0.03);
  color: inherit;
}

.btn:hover {
  background: rgba(255, 255, 255, 0.08);
}

@media (max-width: 980px) {
  .nexus-choice-items {
    grid-template-columns: 1fr;
  }
}
</style>
