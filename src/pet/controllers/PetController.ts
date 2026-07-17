import type { PetConfig, PetState, Direction, MonitorInfo } from '../../shared/types';
import { stateFromDirectionAndType, isWalking } from '../models/PetState';
import { moveStep } from '../services/MovementService';
import { getAnimationManifest, getRotatingActionKeys } from '../animation/animationManifest';
import {
  getCurrentMonitor,
  getWorkArea,
} from '../services/ScreenBoundaryService';

export interface PetControllerCallbacks {
  /** Called every frame with the updated position */
  onPositionChange: (x: number, y: number) => void;
  /** Called when state changes */
  onStateChange: (state: PetState) => void;
  /** Called when direction changes (for image flip) */
  onDirectionChange: (direction: Direction) => void;
  /** Selects a semantic animation independently from movement state. */
  onAnimationChange: (key: string | null) => void;
}

/**
 * PetController manages all movement logic independent of React.
 * It owns the requestAnimationFrame loop and all timers.
 *
 * Lifecycle:
 *   new PetController(config, callbacks)
 *   .start(initialX, initialY, monitors)
 *   .pause() / .resume()
 *   .stop()
 *   .dispose()
 */
export class PetController {
  private config: PetConfig;
  private callbacks: PetControllerCallbacks;

  // Position
  private x = 0;
  private y = 0;

  // Movement state
  private state: PetState = 'idle';
  private direction: Direction = 1;
  private monitors: MonitorInfo[] = [];
  private activeAnimationKey: string | null = null;
  private actionCursor = 0;

  // RAF loop
  private rafId: number | null = null;
  private lastTimestamp: number | null = null;

  // Phase tracking: 'moving' | 'resting'
  private _phase: 'moving' | 'resting' = 'resting';
  private phaseTimer: ReturnType<typeof setTimeout> | null = null;

  // Flags
  private isRunning = false;
  private isDragging = false;
  private isHovering = false;
  private isManuallPaused = false;
  private isDisposed = false;

  // Guard: only one animation loop
  private loopActive = false;

  constructor(config: PetConfig, callbacks: PetControllerCallbacks) {
    this.config = config;
    this.callbacks = callbacks;
  }

  // ========== Public API ==========

  start(initialX: number, initialY: number, monitors: MonitorInfo[]): void {
    if (this.isDisposed) return;
    if (this.isRunning) this.stop();

    this.x = initialX;
    this.y = initialY;
    this.monitors = monitors;
    this.isRunning = true;
    this.direction = 1;

    this.scheduleNextPhase();
  }

  pause(): void {
    if (this.isDisposed) return;
    this.isManuallPaused = true;
    this.stopMovementLoop();
    this.clearPhaseTimer();
    this.setAnimationKey(null);
    this.setState('idle');
  }

  resume(): void {
    if (this.isDisposed) return;
    this.isManuallPaused = false;
    if (this.isRunning) {
      this.scheduleNextPhase();
    }
  }

  stop(): void {
    this.isRunning = false;
    this.stopMovementLoop();
    this.clearPhaseTimer();
    this.setAnimationKey(null);
    this.setState('idle');
  }

  dispose(): void {
    if (this.isDisposed) return;
    this.isDisposed = true;
    this.stop();
  }

  // Called when config changes externally
  updateConfig(config: PetConfig): void {
    const wasAutoMove = this.config.autoMoveEnabled;
    const petChanged = this.config.imagePath !== config.imagePath;
    this.config = config;
    if (petChanged) this.actionCursor = 0;

    if (!wasAutoMove && config.autoMoveEnabled && this.isRunning && !this.isManuallPaused) {
      this.scheduleNextPhase();
    } else if (wasAutoMove && !config.autoMoveEnabled && this._phase === 'moving') {
      this.stopMovementLoop();
      this.clearPhaseTimer();
      this.scheduleNextPhase();
    }
  }

  getPhase(): 'moving' | 'resting' {
    return this._phase;
  }

  updateMonitors(monitors: MonitorInfo[]): void {
    this.monitors = monitors;
  }

  // Called by drag hook
  onDragStart(): void {
    this.isDragging = true;
    this.stopMovementLoop();
    this.clearPhaseTimer();
    this.setAnimationKey(null);
    this.setState('dragging');
  }

  onDragDirection(direction: Direction): void {
    if (this.direction === direction) return;
    this.direction = direction;
    this.callbacks.onDirectionChange(direction);
  }

  onDragEnd(x: number, y: number): void {
    // The immediate drop and the post-layout native confirmation can both
    // update this method. Never leave an older timer or RAF loop alive.
    this.stopMovementLoop();
    this.clearPhaseTimer();
    this.x = x;
    this.y = y;
    this.isDragging = false;
    this.setAnimationKey(null);
    this.setState('idle');

    // Resume movement after a short delay
    if (this.isRunning && !this.isManuallPaused) {
      this.phaseTimer = setTimeout(() => {
        this.phaseTimer = null;
        this.scheduleNextPhase();
      }, 800);
    }
  }

  onHoverStart(): void {
    if (this.isDragging) return;
    if (this.config.reactOnHover && isWalking(this.state)) {
      this.isHovering = true;
      this.stopMovementLoop();
      this.clearPhaseTimer();
      this.setAnimationKey(null);
      this.setState('hovering');
    }
  }

  onHoverEnd(): void {
    if (!this.isHovering) return;
    this.isHovering = false;
    if (this.state === 'hovering') {
      this.setState('idle');
      if (this.isRunning && !this.isManuallPaused) {
        this.scheduleNextPhase();
      }
    }
  }

  getCurrentPosition(): { x: number; y: number } {
    return { x: this.x, y: this.y };
  }

  getCurrentState(): PetState {
    return this.state;
  }

  // ========== Private — State Machine ==========

  private setState(newState: PetState): void {
    if (this.state === newState) return;
    this.state = newState;
    this.callbacks.onStateChange(newState);
  }

  private setAnimationKey(key: string | null): void {
    if (this.activeAnimationKey === key) return;
    this.activeAnimationKey = key;
    this.callbacks.onAnimationChange(key);
  }

  // ========== Private — Phase Scheduling ==========

  private scheduleNextPhase(): void {
    if (this.isDisposed || this.isDragging || this.isHovering || this.isManuallPaused) return;

    this.clearPhaseTimer();

    this._phase = 'resting';
    
    const manifest = getAnimationManifest(this.config);
    const actionKeys = getRotatingActionKeys(manifest);
    const actionKey = actionKeys[this.actionCursor % Math.max(1, actionKeys.length)] ?? 'idle';
    this.actionCursor += 1;
    this.setAnimationKey(actionKey);
    this.setState(actionKey === 'idle' ? 'idle' : 'special');

    this.phaseTimer = setTimeout(() => {
      this.phaseTimer = null;
      if (this.config.autoMoveEnabled) this.startMovingPhase();
      else this.scheduleNextPhase();
    }, Math.max(2200, this.config.movementIntervalMs));
  }

  private startMovingPhase(): void {
    if (this.isDisposed || this.isDragging || this.isHovering || this.isManuallPaused) return;
    if (!this.config.autoMoveEnabled) {
      this.scheduleNextPhase();
      return;
    }

    this._phase = 'moving';
    this.setAnimationKey(null);

    // Randomize movement type: 70% walk, 30% run
    const isRunning = Math.random() < 0.30;
    this.setState(stateFromDirectionAndType(this.direction, isRunning));
    this.callbacks.onDirectionChange(this.direction);

    // Start moving immediately from the current anchor. Crossfade stays in the
    // renderer — delaying RAF only masked position bugs and made starts lag.
    this.startMovementLoop();
    this.phaseTimer = setTimeout(() => {
      this.phaseTimer = null;
      this.stopMovementLoop();

      // Reverse direction for next move
      this.direction = (this.direction * -1) as Direction;
      this.callbacks.onDirectionChange(this.direction);

      // Go back to rest phase
      this.scheduleNextPhase();
    }, this.config.movementDurationMs);
  }

  // ========== Private — RAF Loop ==========

  private startMovementLoop(): void {
    if (this.loopActive) return; // Guard against multiple loops
    this.loopActive = true;
    this.lastTimestamp = null;
    this.rafId = requestAnimationFrame(this.loop);
  }

  private stopMovementLoop(): void {
    this.loopActive = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.lastTimestamp = null;
  }

  private loop = (timestamp: number): void => {
    if (!this.loopActive) return;

    if (this.lastTimestamp === null) {
      this.lastTimestamp = timestamp;
      this.rafId = requestAnimationFrame(this.loop);
      return;
    }

    const deltaMs = timestamp - this.lastTimestamp;
    this.lastTimestamp = timestamp;

    // Cap delta to 100ms to handle tab switching / sleep
    const deltaTime = Math.min(deltaMs, 100) / 1000;

    const monitor = getCurrentMonitor(
      this.x,
      this.y,
      this.config.width,
      this.config.height,
      this.monitors
    );
    // If the pet is temporarily between monitor coordinate spaces, wait for a
    // valid monitor instead of clamping it to the primary-screen boundary.
    if (!monitor) {
      this.rafId = requestAnimationFrame(this.loop);
      return;
    }
    const workArea = getWorkArea(monitor);

    const isRunning = this.state.startsWith('running');
    const logicalSpeed = isRunning ? this.config.movementSpeed * 1.8 : this.config.movementSpeed;
    const speed = logicalSpeed * (monitor?.scaleFactor ?? 1);

    const { newX, newDirection, hitBoundary } = moveStep(
      this.x,
      this.direction,
      speed,
      deltaTime,
      workArea,
      this.config.width * (monitor?.scaleFactor ?? 1)
    );

    if (hitBoundary && newDirection !== this.direction) {
      this.direction = newDirection;
      this.callbacks.onDirectionChange(newDirection);
      this.setState(stateFromDirectionAndType(newDirection, isRunning));
    }

    this.x = newX;
    this.callbacks.onPositionChange(this.x, this.y);

    this.rafId = requestAnimationFrame(this.loop);
  };

  // ========== Private — Timer Cleanup ==========

  private clearPhaseTimer(): void {
    if (this.phaseTimer !== null) {
      clearTimeout(this.phaseTimer);
      this.phaseTimer = null;
    }
  }
}
