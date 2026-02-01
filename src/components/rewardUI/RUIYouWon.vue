<template>
  <div class="modal-backdrop">
    <div class="modal">
      <div class="modal-body">
        <h2 class="title">You won!</h2>
        <p class="description-text">
          (No, really, this is as far the game goes for now. The rest is yet to be implemented and balanced.)
        </p>
        <p class="thank-you">Thank you for playing!</p>
      </div>
      <footer class="modal-actions">
        <button class="btn primary" @click="close">OK</button>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Reward } from '../../logic/Reward';

defineProps<{
  params?: Record<string, unknown>;
}>();

const emit = defineEmits<{
  close: [rewards?: Reward[]]
}>();

function close() {
  emit('close');
}
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2vh 2vw;
  z-index: 10000;
  overflow: hidden;
}

.modal {
  max-width: 96vw;
  min-width: 320px;
  background: linear-gradient(180deg, rgba(20, 28, 40, 0.98), rgba(10, 15, 26, 0.94));
  border: 1px solid var(--panel-border);
  border-radius: 6px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.7), inset 0 1px 0 var(--panel-shine);
  padding: 16px 18px;
}

.modal-body {
  min-height: 90px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
}

.title {
  color: var(--accent);
  font-size: 1.5rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin: 0;
  text-shadow: 0 0 12px var(--accent);
}

.description-text {
  text-align: center;
  color: var(--text-secondary);
  margin: 0;
  font-size: 0.95rem;
  line-height: 1.6;
}

.thank-you {
  text-align: center;
  color: var(--text-primary);
  font-weight: 700;
  margin: 0;
  font-size: 1rem;
}

.modal-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 14px;
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

.btn.primary {
  background: rgba(79, 209, 197, 0.14);
  color: var(--accent);
}

.btn.primary:hover {
  background: rgba(79, 209, 197, 0.22);
}
</style>
