import type { PetConfig, ReminderConfig } from '../shared/types';

export const DEFAULT_PET_CONFIG: PetConfig = {
  theme: 'system',
  activePetId: undefined,
  imagePath: '',
  width: 180,
  height: 180,
  preserveAspectRatio: true,
  alwaysOnTop: true,
  autoMoveEnabled: true,
  reactOnHover: true,
  movementSpeed: 80,       // 80 pixels/second
  movementDurationMs: 3000, // move for 3 seconds
  movementIntervalMs: 2000, // rest for 2 seconds between moves
  reminderBubbleScale: 100,
  initialX: undefined,
  initialY: undefined,
  startupEnabled: false,
  idleImagePath: undefined,
  walkingImagePath: undefined,
  hoverImagePath: undefined,
  sleepingImagePath: undefined,
  spritesheetEnabled: false,
  spritesheetCols: 4,
  spritesheetRows: 4,
  spritesheetFps: 8,
  spritesheetIdleFrame: 0,
  spritesheetWalkFrame: 1,
  spritesheetDragFrame: 2,
  spritesheetSleepFrame: 3,
};

export const DEFAULT_REMINDERS: ReminderConfig[] = [];
