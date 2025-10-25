import type { Point2 } from "../logic/core/math";
import * as math from "../logic/core/math";
import { Chase, type ChaseSettings, type ChaseState, type Actor } from "./Chase";

const PER_CELL_DISCOUNT = 0.003;

interface ActorAnimation {
  startPos: Point2;
  endPos: Point2;
  startTime: number;
  duration: number;
}

export class IceMaze {
  public readonly dimensions: Point2;
  public readonly maxMoves: number;
  public movesMade: number = 0;

  public state: ChaseState;
  private settings: ChaseSettings;

  // Time in seconds (matching Model.ts convention)
  private currentTime: number = 0;

  // Animation tuning: seconds per grid cell traveled
  public animationSpeed: number = 0.08;
  public minAnimationDuration: number = 0.15; // minimum duration for smooth animations

  // Current animations
  private playerAnim: ActorAnimation | null = null;
  private demonAnims: Map<Actor, ActorAnimation> = new Map();

  // Hold solved state as "animating" to delay auto-advance
  private solveHoldUntil: number = 0;

  // Visual positions (computed, exposed directly)
  public playerVisualPos: Point2 = { x: 0, y: 0 };
  public demonVisualPos: Map<Actor, Point2> = new Map();

  // Visual key state (keys disappear when animation completes, not instantly)
  public visualTakenKeys: Array<boolean> = [];

  // Pending input (queued during animation)
  private pendingMove: Point2 | null = null;

  constructor(dimensions: Point2, maxMoves: number, seed: number) {
    this.dimensions = {
      x: Math.max(3, Math.floor(dimensions.x)),
      y: Math.max(3, Math.floor(dimensions.y)),
    };
    this.maxMoves = Math.max(0, Math.floor(maxMoves));

    this.settings = {
      seed: seed | 0,
      x: this.dimensions.x,
      y: this.dimensions.y,
      spawn: { x: 1, y: 1 },
      keys: [],
      spawnProbability: 0,
      maxDemons: 0,
      artefacts: [],
      fill: [],
    } as ChaseSettings;
    this.state = Chase.create(this.settings);
    this.playerVisualPos = { x: this.state.player.cell.x, y: this.state.player.cell.y };
    this.visualTakenKeys = this.state.takenKeys.slice();
  }

  update(deltaTime: number): void {
    this.currentTime += deltaTime;

    // Track if we were animating before this update (real anims only)
    const wasAnimatingReal = (this.playerAnim !== null || this.demonAnims.size > 0);

    // Update player animation and visual position
    if (this.playerAnim) {
      const elapsed = this.currentTime - this.playerAnim.startTime;
      if (elapsed >= this.playerAnim.duration) {
        this.playerVisualPos.x = this.state.player.cell.x;
        this.playerVisualPos.y = this.state.player.cell.y;
        this.playerAnim = null;
        // Sync visual key state when animation completes
        this.visualTakenKeys = this.state.takenKeys.slice();
      } else {
        const t = elapsed / this.playerAnim.duration;
        const eased = this.easeInOutCubic(t);
        this.playerVisualPos.x = math.lerp(this.playerAnim.startPos.x, this.playerAnim.endPos.x, eased);
        this.playerVisualPos.y = math.lerp(this.playerAnim.startPos.y, this.playerAnim.endPos.y, eased);
      }
    }

    // Update demon animations and visual positions
    for (const [actor, anim] of this.demonAnims.entries()) {
      const elapsed = this.currentTime - anim.startTime;
      if (elapsed >= anim.duration) {
        this.demonVisualPos.set(actor, { x: actor.cell.x, y: actor.cell.y });
        this.demonAnims.delete(actor);
      } else {
        const t = elapsed / anim.duration;
        const eased = this.easeInOutCubic(t);
        this.demonVisualPos.set(actor, {
          x: math.lerp(anim.startPos.x, anim.endPos.x, eased),
          y: math.lerp(anim.startPos.y, anim.endPos.y, eased),
        });
      }
    }

    // Determine if real animations finished this frame
    const animatingRealNow = (this.playerAnim !== null || this.demonAnims.size > 0);

    // If the level just finished real animations and is solved, start a short hold
    if (wasAnimatingReal && !animatingRealNow && Chase.isSolved(this.state) && this.solveHoldUntil <= this.currentTime) {
      this.solveHoldUntil = this.currentTime + 1; // seconds
    }

    // Apply pending move if real animations just finished (but not when solved)
    if (wasAnimatingReal && !animatingRealNow && this.pendingMove && !Chase.isSolved(this.state)) {
      const move = this.pendingMove;
      this.pendingMove = null;
      this.tryMove(move);
    }
  }

  reset(seed?: number): void {
    if (typeof seed === "number") this.settings.seed = seed | 0;
    this.movesMade = 0;
    this.state = Chase.create(this.settings);
    this.playerAnim = null;
    this.demonAnims.clear();
    this.demonVisualPos.clear();
    this.pendingMove = null;
    this.currentTime = 0;
    this.solveHoldUntil = 0;
    this.playerVisualPos = { x: this.state.player.cell.x, y: this.state.player.cell.y };
    this.visualTakenKeys = this.state.takenKeys.slice();
  }

  isAnimating(): boolean {
    return (
      this.playerAnim !== null ||
      this.demonAnims.size > 0 ||
      this.currentTime < this.solveHoldUntil
    );
  }

  tryMove(direction: Point2): boolean {
    // Store input as pending if animating
    if (this.isAnimating()) {
      this.pendingMove = { x: direction.x, y: direction.y };
      return false;
    }

    // No budget left
    if (this.movesMade >= this.maxMoves) return false;

    // Determine the full slide target and distance first. If we can't afford the
    // entire move, reject the input without changing state.
    const startCell = this.state.player.cell;
    const endCell = Chase.nextCell(startCell, direction, this.state.cells);
    if (!endCell) return false; // can't move in that direction

    const requiredDist = Math.abs(endCell.x - startCell.x) + Math.abs(endCell.y - startCell.y);
    const remaining = this.maxMoves - this.movesMade;
    if (requiredDist > remaining) return false; // insufficient budget for full slide

    const playerPrev = this.state.player.cell;
    const demonPrevPositions = new Map<Actor, Point2>();
    this.state.demons.forEach((d) => {
      demonPrevPositions.set(d, { x: d.cell.x, y: d.cell.y });
    });

    const moved = Chase.move(this.state, direction);
    
    if (moved) {
      // Deduct move budget by distance traveled
      this.movesMade += requiredDist;
      
      // Start player animation with distance-based duration (with minimum)
      const playerDist = Math.abs(this.state.player.cell.x - playerPrev.x) + Math.abs(this.state.player.cell.y - playerPrev.y);
      const animSpeed = this.animationSpeed - PER_CELL_DISCOUNT * playerDist;
      this.playerAnim = {
        startPos: { x: playerPrev.x, y: playerPrev.y },
        endPos: { x: this.state.player.cell.x, y: this.state.player.cell.y },
        startTime: this.currentTime,
        duration: Math.max(this.minAnimationDuration, playerDist * animSpeed),
      };

      // Start demon animations
      this.demonAnims.clear();
      this.state.demons.forEach((demon) => {
        const prevPos = demonPrevPositions.get(demon);
        if (prevPos && (prevPos.x !== demon.cell.x || prevPos.y !== demon.cell.y)) {
          const dist = Math.abs(demon.cell.x - prevPos.x) + Math.abs(demon.cell.y - prevPos.y);
          const animSpeed = this.animationSpeed - PER_CELL_DISCOUNT * dist;
          this.demonAnims.set(demon, {
            startPos: prevPos,
            endPos: { x: demon.cell.x, y: demon.cell.y },
            startTime: this.currentTime,
            duration: Math.max(this.minAnimationDuration, dist * animSpeed),
          });
        }
      });
    }
    
    return moved;
  }

  private easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  loadSettings(settings: Omit<ChaseSettings, "seed">, seed: number): void {
    this.dimensions.x = Math.max(3, Math.floor(settings.x));
    this.dimensions.y = Math.max(3, Math.floor(settings.y));
    this.settings = { ...settings, seed: seed | 0 } as ChaseSettings;
    this.reset();
  }
}

export default IceMaze;
