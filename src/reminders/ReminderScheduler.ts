import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification';
import type { ReminderConfig } from '../shared/types';
import { shouldTrigger, getNowISO } from './ReminderService';
import { reminderRepository } from './ReminderRepository';

type OnTriggerCallback = (reminder: ReminderConfig) => void;

/**
 * ReminderScheduler polls reminders at a regular interval.
 * Uses timestamp comparison (not long-running setInterval as sole source)
 * to handle machine sleep/wake correctly.
 */
export class ReminderScheduler {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private readonly POLL_INTERVAL_MS = 250; // Check precisely enough for second-level schedules
  private onTrigger: OnTriggerCallback | null = null;
  private isDisposed = false;

  /**
   * Start polling for reminders.
   * @param onTrigger - callback fired when a reminder should trigger
   */
  start(onTrigger: OnTriggerCallback): void {
    if (this.isDisposed) return;
    this.stop();
    this.onTrigger = onTrigger;

    // Immediate first check
    this.checkNow();

    this.intervalId = setInterval(() => {
      this.checkNow();
    }, this.POLL_INTERVAL_MS);
  }

  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  dispose(): void {
    if (this.isDisposed) return;
    this.isDisposed = true;
    this.stop();
    this.onTrigger = null;
  }

  checkNow(): void {
    if (this.isDisposed) return;

    const reminders = reminderRepository.getAll();
    const now = new Date();

    for (const reminder of reminders) {
      if (shouldTrigger(reminder, now)) {
        this.trigger(reminder);
      }
    }
  }

  private trigger(reminder: ReminderConfig): void {
    // Mark as triggered immediately to prevent double-fire
    const updatedAt = getNowISO();
    reminderRepository.updateLastTriggeredAt(reminder.id, updatedAt);

    // Fire callback (shows speech bubble)
    this.onTrigger?.(reminder);

    void this.sendNativeNotification(reminder);
  }

  private async sendNativeNotification(reminder: ReminderConfig): Promise<void> {
    try {
      let granted = await isPermissionGranted();
      if (!granted) granted = (await requestPermission()) === 'granted';
      if (!granted) return;
      sendNotification({
        title: reminder.title,
        body: reminder.content,
      });
    } catch (err) {
      console.error('[ReminderScheduler] Notification error:', err);
    }
  }
}

export const reminderScheduler = new ReminderScheduler();
