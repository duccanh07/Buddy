/**
 * Tauri event name constants.
 * Never hard-code event strings elsewhere — always use these constants.
 */

export const EVENTS = {
  PET_CONFIG_UPDATED: 'pet-config-updated',
  PET_SHOW: 'pet-show',
  PET_HIDE: 'pet-hide',
  PET_PAUSE: 'pet-pause',
  PET_RESUME: 'pet-resume',
  PET_RESET_POSITION: 'pet-reset-position',
  REMINDER_TRIGGERED: 'reminder-triggered',
  REMINDERS_UPDATED: 'reminders-updated',
  PET_STATE_CHANGED: 'pet-state-changed',
} as const;

export type EventName = typeof EVENTS[keyof typeof EVENTS];
