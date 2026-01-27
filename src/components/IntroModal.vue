<template>
  <div v-if="visible" class="modal-backdrop" :class="{ 'phase-3': shownCount >= 3 }">
    <div class="modal-halo" :class="{ visible: shownCount >= 4 }"></div>
    <div class="modal" :class="{ 'phase-2': shownCount >= 2, 'phase-3': shownCount >= 3, 'phase-4': shownCount >= 4 }">
      <section class="modal-body">
        <div class="intro-text">
          <p v-for="(part, idx) in textParts" :key="idx" class="intro-part" :class="{ visible: idx < shownCount }">
            {{ part }}
          </p>
        </div>
      </section>

      <footer class="modal-actions">
        <button v-if="!allShown" class="btn primary" @click="showNext">Next</button>
        <button v-else class="btn final" :class="{ visible: showFinalButton }" @click="dismiss">Escape the loop through the maze of time!</button>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { uiState } from '../logic/UIState';
import { globalInputQueue } from '../logic/Model';
import { CmdDismissIntro } from '../logic/input/InputCommands';

const textParts = [
  'Once you were full of regret.\nAnd fractured the time itself to visit the multiverses of your untaken decisions.',
  'Yet the entropy creeps fast.\nPeople vanish, buildings crumble, monsters hatch.',
  'It is now a struggle to scavenge for the resources needed to rejoin humanity.',
  'To come back to the universe where your life had meaning.',
  'Where your loved ones wait.',
];

const visible = computed(() => uiState.showIntroModal);
const shownCount = ref(1);
const showFinalButton = ref(false);
const allShown = computed(() => shownCount.value >= textParts.length);

function showNext(): void {
  if (shownCount.value < textParts.length) {
    shownCount.value++;
    if (shownCount.value >= textParts.length) {
      setTimeout(() => { showFinalButton.value = true; }, 1200);
    }
  }
}

function dismiss(): void {
  globalInputQueue.push(new CmdDismissIntro());
}
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  display: grid;
  place-items: center;
  z-index: 10000;
}

.modal-halo {
  position: absolute;
  width: 900px;
  height: 700px;
  border-radius: 50%;
  background: radial-gradient(ellipse at center, rgba(255, 220, 150, 0.35) 0%, rgba(255, 180, 100, 0.15) 30%, rgba(255, 150, 50, 0.05) 50%, transparent 70%);
  opacity: 0;
  transition: opacity 1.2s ease;
  pointer-events: none;
  z-index: 0;
}

.modal-halo.visible {
  opacity: 1;
}

.modal {
  position: relative;
  z-index: 1;
  width: 720px;
  max-width: 96vw;
  background: linear-gradient(180deg, rgb(20, 28, 40), rgb(10, 15, 26));
  border: 4px solid rgba(200, 210, 230, 0.6);
  border-radius: 6px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.7), inset 0 1px 0 var(--panel-shine);
  padding: 24px;
  display: grid;
  grid-template-rows: 1fr auto;
  gap: 24px;
  max-height: 90vh;
  transition: border 0.6s ease, backdrop-filter 0.8s ease, background 0.8s ease;
}

/* Falling bottom border element */
.modal::after {
  content: '';
  position: absolute;
  bottom: -4px;
  left: 0;
  right: 0;
  height: 4px;
  background: rgba(200, 210, 230, 0.6);
  border-radius: 0 0 6px 6px;
  transform-origin: center top;
}

/* Phase 2: thinner, partially dashed border, no bottom */
.modal.phase-2 {
  border: 2px dashed rgba(180, 190, 210, 0.5);
  border-top-style: solid;
  border-bottom: none;
}

.modal.phase-2::after {
  height: 2px;
  background: rgba(180, 190, 210, 0.5);
  animation: border-fall 1.2s cubic-bezier(0.55, 0, 1, 0.45) 2s forwards;
}

@keyframes border-fall {
  0% {
    transform: translateY(0) rotate(0deg);
    opacity: 1;
  }
  20% {
    transform: translateY(8px) rotate(0.5deg);
  }
  100% {
    transform: translateY(120px) rotate(8deg);
    opacity: 0;
  }
}

/* Phase 3: blurred background */
.modal-backdrop.phase-3 {
  backdrop-filter: blur(8px);
}

.modal.phase-3 {
  background: linear-gradient(180deg, rgb(20, 28, 40), rgb(10, 15, 26));
}

/* Phase 4: prepare for halo (border becomes more ethereal) */
.modal.phase-4 {
  border-color: rgba(255, 220, 180, 0.4);
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.7), inset 0 1px 0 var(--panel-shine), 0 0 60px rgba(255, 200, 120, 0.15);
}

.modal-body {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: 200px;
}

.intro-text {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.intro-part {
  color: rgba(255, 255, 255, 0.65);
  font-size: 18px;
  font-weight: 500;
  line-height: 1.6;
  white-space: pre-wrap;
  text-align: center;
  margin: 0;
  opacity: 0;
  transition: opacity 0.4s ease;
}

.intro-part.visible {
  opacity: 1;
}

.modal-actions {
  display: flex;
  justify-content: center;
  min-height: 44px;
  align-items: center;
}

.btn {
  cursor: pointer;
  border: 1px solid rgba(148, 163, 184, 0.35);
  border-radius: 6px;
  padding: 12px 20px;
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.9);
  font-weight: 700;
  font-size: 14px;
  letter-spacing: 0.02em;
  transition: filter 0.15s ease;
}

.btn.primary {
  height: 44px;
  background: rgba(79, 209, 197, 0.14);
  border-color: rgba(79, 209, 197, 0.45);
}

.btn.final {
  height: 44px;
  padding: 0 14px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  border-radius: 4px;
  border: 1px solid rgba(34, 197, 94, 0.5);
  background: rgba(34, 197, 94, 0.32);
  color: #86efac;
  opacity: 0;
  transition: opacity 0.8s ease, background 0.15s ease;
}

.btn.final:hover {
  background: rgba(34, 197, 94, 0.45);
}

.btn.final.visible {
  opacity: 1;
}

.btn:hover {
  filter: brightness(1.15);
}
</style>
