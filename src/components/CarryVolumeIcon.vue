<template>
  <span class="carry-volume-icon" :style="spriteStyle" aria-hidden="true" />
</template>

<script setup lang="ts">
import { CARRY_VOLUME_FRAME } from '../logic/CarryVolumeIcon';
import atlasStorage from '../logic/AtlasStorage';

const source = atlasStorage.getMoleculesSource();
const frame = atlasStorage.getMoleculesFrame(CARRY_VOLUME_FRAME)!;
const spriteStyle = {
  maskImage: `url(${source.src})`,
  maskPosition: `-${frame.x / frame.w}em -${frame.y / frame.h}em`,
  maskSize: `${source.naturalWidth / frame.w}em ${source.naturalHeight / frame.h}em`,
  maskRepeat: 'no-repeat',
};
</script>

<style scoped>
.carry-volume-icon {
  display: inline-block;
  width: 1em;
  height: 1em;
  vertical-align: -0.125em;
  flex-shrink: 0;
  background-color: currentColor;
}
</style>
