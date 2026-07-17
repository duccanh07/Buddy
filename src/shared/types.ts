// ========== Pet State ==========

export type PetState =
  | 'idle'
  | 'walking-left'
  | 'walking-right'
  | 'running-left'
  | 'running-right'
  | 'dragging'
  | 'hovering'
  | 'sleeping'
  | 'special'
  | 'showing-reminder';

// ========== Animation ========== 

export interface PetAnimation {
  /** Absolute frame indexes in row-major order. */
  frames: number[];
  fps?: number;
  loop: boolean;
  transition?: 'immediate' | 'finish-loop';
}

export interface AnimationManifest {
  version: number;
  frameWidth: number;
  frameHeight: number;
  columns: number;
  rows: number;
  defaultFps: number;
  animations: Record<string, PetAnimation>;
}

// ========== Config Types ==========

export interface PetProfile {
  id: string;
  name: string;
  imagePath: string;
  width: number;
  height: number;
  preserveAspectRatio: boolean;
  spritesheetEnabled: boolean;
  spritesheetCols: number;
  spritesheetRows: number;
  spritesheetFps: number;
  spritesheetIdleFrame: number;
  spritesheetWalkFrame: number;
  spritesheetDragFrame: number;
  spritesheetSleepFrame: number;
  spriteVersionNumber?: number;
  animationManifest?: AnimationManifest;
}

export interface PetConfig {
  theme: 'system' | 'light' | 'dark';
  activePetId?: string;
  
  // These properties are still used as the "runtime" loaded configuration for the active pet
  imagePath: string;
  width: number;
  height: number;
  preserveAspectRatio: boolean;
  
  alwaysOnTop: boolean;
  autoMoveEnabled: boolean;
  reactOnHover: boolean;
  movementSpeed: number;       // pixels per second
  movementDurationMs: number;  // how long each movement phase lasts
  movementIntervalMs: number;  // pause between movements
  reminderBubbleScale: number; // notification card scale percentage
  initialX?: number;
  initialY?: number;
  startupEnabled: boolean;
  // Per-state image overrides (optional, Phase 2)
  idleImagePath?: string;
  walkingImagePath?: string;
  hoverImagePath?: string;
  sleepingImagePath?: string;
  spritesheetEnabled?: boolean;
  spritesheetCols?: number;
  spritesheetRows?: number;
  spritesheetFps?: number;
  spritesheetIdleFrame?: number;
  spritesheetWalkFrame?: number;
  spritesheetDragFrame?: number;
  spritesheetSleepFrame?: number;
  spriteVersionNumber?: number;
  animationManifest?: AnimationManifest;
}

export interface ReminderConfig {
  id: string;
  title: string;
  content: string;
  enabled: boolean;
  scheduleType: 'once' | 'daily' | 'interval';
  scheduledAt?: string;       // ISO 8601 for once, HH:MM:SS for daily
  intervalMinutes?: number;   // legacy interval value
  intervalSeconds?: number;   // canonical interval with second precision
  lastTriggeredAt?: string;   // ISO 8601, used to prevent duplicate triggers
}

// ========== Monitor / Screen ==========

export interface MonitorInfo {
  name: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  scaleFactor: number;
  workX: number;
  workY: number;
  workWidth: number;
  workHeight: number;
  isPrimary: boolean;
}

export interface WorkArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ========== Pet Position ==========

export interface PetPosition {
  x: number;
  y: number;
}

// ========== Movement Direction ==========

export type Direction = -1 | 1;

// ========== Speech Bubble ==========

export interface BubbleContent {
  instanceId?: number;
  title?: string;
  message: string;
  autoCloseMs?: number;
}

// ========== Validation Result ==========

export interface ValidationResult<T> {
  valid: boolean;
  data?: T;
  errors: string[];
}
