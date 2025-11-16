<template>
  <div class="raid-setup">
    <div class="left panel">
      <RaidDetails />
    </div>
    <div class="right panel">
      <RaidQuests />
    </div>
  </div>
</template>

<script setup lang="ts">
import RaidDetails from './RaidDetails.vue';
import RaidQuests from './RaidQuests.vue';
</script>

<style scoped>
.raid-setup { display: grid; grid-template-columns: 3fr 2fr; gap: 12px; }
.right .section-title { font-weight: 800; text-transform: uppercase; font-size: 12px; letter-spacing: 0.08em; margin-bottom: 8px; }
</style>
