import { createApp } from 'vue';
import App from './App.vue';
import { GameState } from './logic/GameState';
import { processInputs } from './logic/input/InputProcessor';
import * as Model from './logic/Model';
import { getGameStateMutable, replaceGameState, SyncUIFromGameState } from './logic/UIState';
import atlasStorage from './logic/AtlasStorage';
import { ensureMoleculeAtlas } from './logic/MoleculeAtlas';
import { ensureNexusAtlas } from './logic/NexusAtlas';
import { getRepresentation } from './logic/LogNumbers';
import { getHypRepresentation } from './logic/HypNumbers';
import { initDebug } from './logic/CheatInit';
import { flushAutosave, loadAutosave, setAutosaveEnabled } from './logic/SaveLoad';
import { loadGameStateFromDevSlot } from './logic/dev/TestSaveLoad';
import { readURLSettings } from './URLSettings';

getRepresentation(2000);
getHypRepresentation(2000);

(async () => {
  const urlSettings = readURLSettings();
  setAutosaveEnabled(!urlSettings.noSave);

  let initialGameState: GameState;
  if (urlSettings.loadSlotIndex !== null) {
    const result = await loadGameStateFromDevSlot(urlSettings.loadSlotIndex);
    if (!result.exists) {
      throw new Error(`Dev save slot ${urlSettings.loadSlotIndex + 1} is empty`);
    }
    if (result.loadFailed || result.loadedState === null) {
      throw new Error(`Failed to load dev save slot ${urlSettings.loadSlotIndex + 1}: ${result.loadFailureReason}`);
    }
    initialGameState = result.loadedState;
  } else {
    const loaded = loadAutosave();
    initialGameState = loaded !== false
      ? loaded
      : (urlSettings.seed === null ? new GameState() : new GameState(urlSettings.seed));
  }

  if (!urlSettings.noSave) {
    window.addEventListener('pagehide', () => {
      flushAutosave();
    });
    window.addEventListener('beforeunload', () => {
      flushAutosave();
    });
  }

  initDebug(initialGameState);

  await atlasStorage.loadItemsAtlas();
  await atlasStorage.loadLocationsAtlas();
  await ensureMoleculeAtlas();
  await ensureNexusAtlas(initialGameState.lib.nexusItems);

  // Sync UI immediately so initial values render before mounting
  replaceGameState(initialGameState);

  const app = createApp(App);
  app.mount('#app');

  let lastTimestamp = 0;
  function gameLoop(timestamp: number) {
    if (lastTimestamp === 0) {
      lastTimestamp = timestamp;
    }
    const deltaTime = (timestamp - lastTimestamp) / 1000; // seconds
    lastTimestamp = timestamp;

    const gameState = getGameStateMutable();
    processInputs(gameState);
    Model.update(gameState, Math.min(1, deltaTime));

    SyncUIFromGameState(gameState);

    requestAnimationFrame(gameLoop);
  }

  requestAnimationFrame(gameLoop);
})();
