import { createApp } from 'vue';
import App from './App.vue';
import { GameState } from './logic/GameState';
import { processInputs } from './logic/input/InputProcessor';
import * as Model from './logic/Model';
import { SyncUIFromGameState } from './logic/UIState';
import atlasStorage from './logic/AtlasStorage';
import { getRepresentation } from './logic/LogNumbers';
import { getHypRepresentation } from './logic/HypNumbers';
import { initResearchCells } from './logic/Research';
import { initDebug } from './logic/DebugInit';

getRepresentation(2000);
getHypRepresentation(2000);
// Create GameState first so UI state can assume its presence
const gameState = new GameState();

initResearchCells(gameState, gameState.lib.research);

initDebug(gameState);

void atlasStorage.loadItemsAtlas();

// Sync UI immediately so initial values render before mounting
SyncUIFromGameState(gameState);

const app = createApp(App);
app.mount('#app');

let lastTimestamp = 0;
function gameLoop(timestamp: number) {
  if (lastTimestamp === 0) {
    lastTimestamp = timestamp;
  }
  const deltaTime = (timestamp - lastTimestamp) / 1000; // seconds
  lastTimestamp = timestamp;

  processInputs(gameState);
  Model.update(gameState, Math.min(1, deltaTime));

  SyncUIFromGameState(gameState);

  requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);
