import SeededRandom from "../logic/core/SeededRandom";
import type { Point2 } from "../logic/core/math";

export interface ChaseSettings {
  seed: number;
  x: number;
  y: number;
  spawn: Point2;
  keys: Array<Point2>;
  spawnProbability: number;
  maxDemons: number;
  artefacts: Array<{ type: number; x: number; y: number }>;
  fill: Array<Point2>;
}

export interface Cell extends Point2 {
  isObstacle: boolean;
  navIndex: number;
  keyDistances: Array<number>;
}

export enum ActorType {
  PLAYER,
  DEMON,
  AMMO,
  BOSS,
  GOAL,
}

export class Actor {
  public cell!: Cell;
  public type!: ActorType;
  public previousCell: Cell | null = null;
  public closeIn: number = -1;
  public target: Cell | null = null;
}

export enum ArtefactType {
  BOMB,
  EYE,
  FREEZE,
}

export class Artefact {
  public cell!: Cell;
  public type!: ArtefactType;
  public taken: boolean = false;
}

export class ChaseState {
  public cells!: Array<Array<Cell>>;
  public demons: Array<Actor> = [];
  public player!: Actor;
  public random!: SeededRandom;
  public navigatable: Array<Cell> = [];
  public keys: Array<Cell> = [];
  public takenKeys: Array<boolean> = [];
  public keysCollected: number = 0;
  public turn: number = 0;
  public spawnProbability: number = 0;
  public maxDemons: number = 0;
  public failed: boolean = false;
  public numEyes: number = 0;
  public freezeLeft: number = 0;
  public artefacts: Array<Artefact> = [];
}

const UP: Point2 = { x: 0, y: -1 };
const LEFT: Point2 = { x: -1, y: 0 };
const DOWN: Point2 = { x: 0, y: 1 };
const RIGHT: Point2 = { x: 1, y: 0 };
export const DIRECTIONS: ReadonlyArray<Point2> = [UP, LEFT, DOWN, RIGHT];

function randomIndex(rng: SeededRandom, length: number): number {
  return Math.floor(rng.get_in_range(0, length));
}

function randomChoice<T>(rng: SeededRandom, arr: Array<T>): T {
  return arr[randomIndex(rng, arr.length)];
}

function pickRandomCell(rng: SeededRandom, cells: Array<Array<Cell>>): Cell {
  const x = randomIndex(rng, cells.length);
  const col = cells[x];
  const y = randomIndex(rng, col.length);
  return col[y];
}

export namespace Chase {
  export function create(settings: ChaseSettings) {
    const result = new ChaseState();
    result.random = new SeededRandom(settings.seed);
    result.cells = [];
    for (let i = 0; i < settings.x; i++) {
      result.cells.push([]);
      for (let j = 0; j < settings.y; j++) {
        const cell: Cell = {
          x: i,
          y: j,
          keyDistances: [],
          isObstacle: i == 0 || i == settings.x - 1 || j == 0 || j == settings.y - 1,
          navIndex: 0,
        };
        if (settings.fill.find((f) => f.x == i && f.y == j)) cell.isObstacle = true;
        result.cells[i].push(cell);
      }
    }

    spawnPlayer(result, settings);
    buildNav(result.player.cell, result.cells);

    result.navigatable = [];
    result.cells.forEach((c) => (result.navigatable = result.navigatable.concat(c.filter((cc) => cc.navIndex == 1))));

    result.keysCollected = 0;
    result.keys = settings.keys.map((k) => result.cells[k.x][k.y]);
    result.takenKeys = result.keys.map(() => false);

    floodFillDistances(result);

    result.numEyes = 0;
    result.turn = 0;
    result.freezeLeft = 0;
    result.maxDemons = settings.maxDemons;
    result.spawnProbability = settings.spawnProbability;

    result.demons = [];
    result.artefacts = [];
    settings.artefacts.forEach((a) => {
      const artefact = new Artefact();
      artefact.type = a.type as ArtefactType;
      artefact.cell = result.cells[a.x][a.y];
      result.artefacts.push(artefact);
    });

    return result;
  }
  function spawnPlayer(state: ChaseState, settings: ChaseSettings) {
    let cell: Cell | null = null;
    // Use provided spawn; fallback to random navigable if invalid
    if (
      settings.spawn &&
      settings.spawn.x >= 0 && settings.spawn.x < state.cells.length &&
      settings.spawn.y >= 0 && settings.spawn.y < state.cells[0].length
    ) {
      const c = state.cells[settings.spawn.x][settings.spawn.y];
      if (!c.isObstacle) cell = c;
    }
    while (!cell || cell.isObstacle) cell = pickRandomCell(state.random, state.cells);
    const player = new Actor();
    player.type = ActorType.PLAYER;
    player.cell = cell;
    state.player = player;
  }
  function spawnDemon(state: ChaseState) {
    const demon = new Actor();
    demon.type = ActorType.DEMON;

    const bannedCells: Array<Cell | null> = state.demons.map((d) => d.cell);
    bannedCells.push(state.player.cell);
    DIRECTIONS.forEach((d) => {
      bannedCells.push(nextCell(state.player.cell, d, state.cells));
    });

    let cell: Cell | null = null;
    while (!cell || bannedCells.indexOf(cell) != -1) cell = randomChoice(state.random, state.navigatable);
    demon.cell = cell;
    state.demons.push(demon);
  }
  export function isSolved(state: ChaseState) {
    return state.keys.length == state.keysCollected;
  }
  export function move(state: ChaseState, direction: Point2) {
    const next = nextCell(state.player.cell, direction, state.cells);

    if (next) {
      state.player.previousCell = state.player.cell;
      state.player.cell = next;

      const artefacts = state.artefacts.filter((a) => !a.taken && a.cell == state.player.cell);
      if (artefacts.length) triggerArtefact(artefacts[0], state);

      const keyIndex = state.keys.indexOf(state.player.cell);
      if (keyIndex != -1 && !state.takenKeys[keyIndex]) {
        state.takenKeys[keyIndex] = true;
        state.keysCollected++;
      }

      state.turn++;
      state.freezeLeft--;
      if (state.demons.length && state.freezeLeft < 0) {
        const plans: Array<any> = [];
        const playerMoves1 = advanceFrontier([state.player.cell], state.cells);
        const playerMoves2 = advanceFrontier(playerMoves1, state.cells);
        const arg = [[state.player], playerMoves1, playerMoves2] as Array<Array<any>>;

        state.demons.forEach((d) => moveDemon(d, state.cells, arg, state.random, state.demons, plans));
      }

      if (state.freezeLeft >= 0) {
        state.demons.forEach((d) => (d.previousCell = null));
      }

      if (state.freezeLeft < 0 && state.random.get() < state.spawnProbability && state.demons.length < state.maxDemons)
        spawnDemon(state);

      if (state.freezeLeft < 0 && state.demons.some((d) => d.cell == state.player.cell)) state.failed = true;

      return true;
    } else {
      return false;
    }
  }
  function triggerArtefact(artefact: Artefact, state: ChaseState) {
    artefact.taken = true;
    if (artefact.type == ArtefactType.EYE) state.numEyes++;
    else if (artefact.type == ArtefactType.BOMB) state.demons.length = 0;
    else if (artefact.type == ArtefactType.FREEZE) state.freezeLeft = 4;
  }
  function moveDemon(
    demon: Actor,
    cells: Array<Array<Cell>>,
    playerPositions: Array<Array<Cell>>,
    random: SeededRandom,
    demons: Array<Actor>,
    plans: Array<any>
  ) {
    const myIndex = demons.indexOf(demon);
    let demonFrontier: Array<Cell> = [demon.cell];
    let moveOptions: Array<[Cell, number]> = [];
    let firstFrontier: Array<Cell> = [];
    for (let i = 0; i < playerPositions.length && moveOptions.length == 0; i++) {
      demonFrontier = advanceFrontier(demonFrontier, cells);
      if (i == 0) firstFrontier = demonFrontier;
      demonFrontier.forEach((df) => {
        if (playerPositions[i].indexOf(df) != -1) moveOptions.push([df, i]);
      });
    }
    let isRandom = false;
    if (!moveOptions.length) {
      moveOptions = firstFrontier.map((f) => [f, 0]);
      isRandom = true;
    }

    const notPresent = moveOptions.filter((op) => !demons.some((d, i) => d.cell == op[0] && myIndex < i));
    if (notPresent.length > 0 && notPresent.length != moveOptions.length) moveOptions = notPresent;

    const notOverlapping = moveOptions.filter((mo) => !plans.some((p) => p[0] == mo[0] && p[1] == mo[1]));
    if (notOverlapping.length > 0 && notOverlapping.length != moveOptions.length) moveOptions = notOverlapping;

    const optionIndex = Math.floor(random.get_in_range(0, moveOptions.length));

    if (!isRandom) {
      demon.closeIn = moveOptions[optionIndex][1];
      demon.target = moveOptions[optionIndex][0];
      plans.push(moveOptions[optionIndex]);
    } else {
      demon.closeIn = -1;
      demon.target = null;
    }
    moveTowards(moveOptions[optionIndex][0], moveOptions[optionIndex][1], demon, cells);
  }
  function moveTowards(cell: Cell, delay: number, actor: Actor, cells: Array<Array<Cell>>) {
    const path = seek(actor.cell, cell, delay, cells);
    actor.previousCell = actor.cell;
    actor.cell = path![path!.length - 1];
  }
  function seek(from: Cell, to: Cell, turns: number, cells: Array<Array<Cell>>): Array<Cell> | null {
    if (turns == 0) {
      const sameX = from.x == to.x;
      const sameY = from.y == to.y;
      if (sameX == sameY) return null; // both same (same cell) or both different (diagonal)
      const dx = Math.sign(to.x - from.x);
      const dy = Math.sign(to.y - from.y);
      return nextCell(from, { x: dx, y: dy }, cells) == to ? [to] : null;
    }

    const frontier = advanceFrontier([from], cells);
    for (let i = 0; i < frontier.length; i++) {
      const path = seek(frontier[i], to, turns - 1, cells);
      if (path) {
        path.push(frontier[i]);
        return path;
      }
    }
    return null;
  }
  export function advanceFrontier(frontier: Array<Cell>, cells: Array<Array<Cell>>) {
    const newFrontier: Array<Cell> = [];
    frontier.forEach((c) => {
      DIRECTIONS.forEach((d) => {
        const next = nextCell(c, d, cells);
        if (next && newFrontier.indexOf(next) == -1) newFrontier.push(next);
      });
    });
    return newFrontier;
  }
  function buildNav(start: Point2, cells: Array<Array<Cell>>) {
    cells.forEach((c) => c.forEach((cc) => (cc.navIndex = 0)));
    const frontier: Array<Cell> = [cells[start.x][start.y]];
    while (frontier.length) setNavIndexRoutine(frontier, 1, cells);
  }
  function setNavIndexRoutine(frontier: Array<Cell>, index: number, cells: Array<Array<Cell>>) {
    const current = frontier.pop()!;
    current.navIndex = index;
    DIRECTIONS.forEach((d) => {
      const next = nextCell(current, d, cells);
      if (next && next.navIndex == 0 && frontier.indexOf(next) == -1) frontier.push(next);
    });
  }
  export function nextCell(start: Point2, direction: Point2, cells: Array<Array<Cell>>): Cell | null {
    let nx = start.x;
    let ny = start.y;
    while (!cells[nx][ny].isObstacle) {
      nx += direction.x;
      ny += direction.y;
    }
    nx -= direction.x;
    ny -= direction.y;
    if (nx === start.x && ny === start.y) return null;
    return cells[nx][ny];
  }
  function floodFillDistances(state: ChaseState) {
    let frontier = state.keys.slice();
    frontier.forEach((f, i) => {
      f.keyDistances[i] = 0;
    });
    while (frontier.length > 0) {
      const newFrontier: Array<Cell> = [];
      frontier.forEach((f) => {
        DIRECTIONS.forEach((d, ind) => {
          const antiD = DIRECTIONS[(ind + 2) % DIRECTIONS.length];
          if (!state.cells[f.x + antiD.x][f.y + antiD.y].isObstacle) return;
          let cell: Cell | null = f;
          while (!cell || !cell.isObstacle) {
            cell = state.cells[cell.x + d.x][cell.y + d.y];
            if (cell.navIndex == 1) {
              let expanded = false;
              state.keys.forEach((k, i) => {
                if (isNaN(cell!.keyDistances[i]) || cell!.keyDistances[i] > f.keyDistances[i] + 1) {
                  expanded = true;
                  cell!.keyDistances[i] = f.keyDistances[i] + 1;
                }
              });
              if (expanded) newFrontier.push(cell);
            }
          }
        });
      });
      frontier = newFrontier;
    }
  }
}
