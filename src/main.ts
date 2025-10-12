import { createApp } from 'vue';
import App from './App.vue';
import { GameState } from './logic/GameState';
import { processInputs } from './logic/input/InputProcessor';
import * as Model from './logic/Model';
import { SyncUIFromGameState } from './logic/UIState';

const app = createApp(App);
app.mount('#app');

const gameState = new GameState();

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
