<template>
  <Teleport to="body">
    <div v-if="visible" class="modal-backdrop" @click.self="postpone" @pointerdown.stop>
      <div class="modal" @pointerdown.stop @click.stop>
        <section class="modal-body">
          <p class="modal-text">
            This will refund the time flux spent on all nexus upgrades and remove them. This can only be done once. Proceed?
          </p>
        </section>
        <footer class="modal-actions">
          <button class="btn proceed" type="button" @click="proceed">Proceed</button>
          <button class="btn" type="button" @click="postpone">Postpone</button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  (e: 'proceed'): void;
  (e: 'postpone'): void;
}>();

function proceed(): void {
  emit('proceed');
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
  width: 520px;
  max-width: 92vw;
  background: linear-gradient(180deg, rgba(20, 28, 40, 0.98), rgba(10, 15, 26, 0.94));
  border: 1px solid var(--panel-border);
  border-radius: 6px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.7), inset 0 1px 0 var(--panel-shine);
  padding: 16px;
  display: grid;
  gap: 16px;
}

.modal-body {
  display: grid;
}

.modal-text {
  margin: 0;
  font-size: 16px;
  line-height: 1.45;
  color: rgba(226, 232, 240, 0.95);
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
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

.btn.proceed {
  background: rgba(239, 68, 68, 0.14);
}

.btn.proceed:hover {
  background: rgba(239, 68, 68, 0.24);
}
</style>
