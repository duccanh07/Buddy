import type { ReminderConfig } from '../shared/types';
import { configRepository } from '../config/ConfigRepository';

/**
 * ReminderRepository holds in-memory reminders and syncs to disk.
 * The in-memory cache allows the scheduler to check frequently without disk I/O.
 */
export class ReminderRepository {
  private reminders: ReminderConfig[] = [];
  private loaded = false;

  async load(): Promise<void> {
    this.reminders = await configRepository.loadReminders();
    this.loaded = true;
  }

  getAll(): ReminderConfig[] {
    return this.reminders;
  }

  async saveAll(): Promise<void> {
    await configRepository.saveReminders(this.reminders);
  }

  updateLastTriggeredAt(id: string, iso: string): void {
    this.reminders = this.reminders.map((r) =>
      r.id === id ? { ...r, lastTriggeredAt: iso } : r
    );
    // Persist asynchronously — don't block the trigger
    this.saveAll().catch((err) => {
      console.error('[ReminderRepository] Failed to persist lastTriggeredAt:', err);
    });
  }

  setAll(reminders: ReminderConfig[]): void {
    this.reminders = reminders;
  }

  isLoaded(): boolean {
    return this.loaded;
  }
}

export const reminderRepository = new ReminderRepository();
