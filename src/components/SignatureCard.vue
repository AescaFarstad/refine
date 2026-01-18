<template>
  <button class="signature-card" type="button" @click="openModal">
    <div class="sig-display" :style="sigStyle" />
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import atlasStorage from '../logic/AtlasStorage';
import { globalInputQueue } from '../logic/Model';
import { CmdPreviewSignature } from '../logic/input/InputCommands';

const props = defineProps<{
  sigId: string;
  width: number;
  height: number;
}>();

const moleculesSource = atlasStorage.getMoleculesSource()!;

const sigStyle = computed(() => {
  const frame = atlasStorage.getMoleculesFrame(`sig:wafer:${props.sigId}`)!;
  const padding = Math.round(Math.min(props.width, props.height) * 0.12);
  const targetW = Math.max(1, props.width - padding * 2);
  const targetH = Math.max(1, props.height - padding * 2);
  const scale = Math.min(1, targetW / frame.w, targetH / frame.h);

  return {
    backgroundImage: `url(${moleculesSource.src})`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: `-${frame.x * scale}px -${frame.y * scale}px`,
    backgroundSize: `${moleculesSource.naturalWidth * scale}px ${moleculesSource.naturalHeight * scale}px`,
    width: `${Math.round(frame.w * scale)}px`,
    height: `${Math.round(frame.h * scale)}px`,
  };
});

function openModal(): void {
  globalInputQueue.push(new CmdPreviewSignature({ id: props.sigId }));
}
</script>

<style scoped>
.signature-card {
  width: 100%;
  height: 100%;
  border: 1px solid rgba(148, 163, 184, 0.35);
  border-radius: 8px;
  background: linear-gradient(180deg, rgba(23, 33, 47, 0.92), rgba(12, 18, 28, 0.95));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
  padding: 8px;
  display: grid;
  place-items: center;
  cursor: pointer;
  color: inherit;
}

.signature-card:focus-visible {
  outline: 2px solid rgba(129, 230, 217, 0.7);
  outline-offset: 2px;
}

.signature-card:hover {
  filter: brightness(1.05);
}

.sig-display {
  image-rendering: auto;
  background-repeat: no-repeat;
}
</style>
