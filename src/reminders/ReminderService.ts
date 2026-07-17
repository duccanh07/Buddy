import type { ReminderConfig } from '../shared/types';
import { MIN_REMINDER_INTERVAL_SECONDS } from './constants';

/**
 * Determines if a reminder should trigger now.
 * Compares current time against schedule to handle sleep/wake correctly.
 */
export function shouldTrigger(
  reminder: ReminderConfig,
  now: Date = new Date()
): boolean {
  if (!reminder.enabled) return false;

  switch (reminder.scheduleType) {
    case 'interval':
      return shouldTriggerInterval(reminder, now);
    case 'daily':
      return shouldTriggerDaily(reminder, now);
    case 'once':
      return shouldTriggerOnce(reminder, now);
    default:
      return false;
  }
}

function shouldTriggerInterval(reminder: ReminderConfig, now: Date): boolean {
  const configuredSeconds = reminder.intervalSeconds ?? (reminder.intervalMinutes ?? 60) * 60;
  const intervalSeconds = Math.max(MIN_REMINDER_INTERVAL_SECONDS, configuredSeconds);
  const intervalMs = intervalSeconds * 1000;
  if (intervalMs <= 0) return false;

  if (!reminder.lastTriggeredAt) {
    // Never triggered — check if it's time based on creation (use scheduledAt as start if available)
    return true;
  }

  const lastTriggered = new Date(reminder.lastTriggeredAt).getTime();
  if (!Number.isFinite(lastTriggered)) return true;
  return now.getTime() - lastTriggered >= intervalMs;
}

function shouldTriggerDaily(reminder: ReminderConfig, now: Date): boolean {
  if (!reminder.scheduledAt) return false;

  // scheduledAt is HH:MM
  const [hours, minutes, seconds = 0] = reminder.scheduledAt.split(':').map(Number);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return false;
  if (!Number.isInteger(seconds)) return false;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59 || seconds < 0 || seconds > 59) {
    return false;
  }
  const scheduled = new Date(now);
  scheduled.setHours(hours, minutes, seconds, 0);

  // Already triggered today?
  if (reminder.lastTriggeredAt) {
    const lastTriggered = new Date(reminder.lastTriggeredAt);
    if (
      lastTriggered.getDate() === now.getDate() &&
      lastTriggered.getMonth() === now.getMonth() &&
      lastTriggered.getFullYear() === now.getFullYear()
    ) {
      return false; // Already triggered today
    }
  }

  // Trigger any time after today's scheduled time. This also catches reminders
  // missed while the machine was asleep or the app was suspended.
  const diffMs = now.getTime() - scheduled.getTime();
  return diffMs >= 0;
}

function shouldTriggerOnce(reminder: ReminderConfig, now: Date): boolean {
  if (!reminder.scheduledAt) return false;
  if (reminder.lastTriggeredAt) return false; // Already triggered

  const scheduled = new Date(reminder.scheduledAt);
  if (!Number.isFinite(scheduled.getTime())) return false;
  const diffMs = now.getTime() - scheduled.getTime();
  return diffMs >= 0;
}

/**
 * Returns ISO string for "now" — used to set lastTriggeredAt.
 */
export function getNowISO(): string {
  return new Date().toISOString();
}
