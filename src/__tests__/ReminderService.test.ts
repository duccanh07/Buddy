import { describe, it, expect } from 'vitest';
import { shouldTrigger, getNowISO } from '../reminders/ReminderService';
import type { ReminderConfig } from '../shared/types';

function makeReminder(overrides: Partial<ReminderConfig> = {}): ReminderConfig {
  return {
    id: 'test-1',
    title: 'Test',
    content: 'Test content',
    enabled: true,
    scheduleType: 'interval',
    intervalMinutes: 60,
    ...overrides,
  };
}

describe('ReminderService', () => {
  // Test 7: Reminder does not trigger twice (duplicate prevention)
  describe('interval reminders', () => {
    it('enforces the minimum interval for legacy fast reminders', () => {
      const reminder = makeReminder({
        intervalSeconds: 5,
        intervalMinutes: undefined,
        lastTriggeredAt: '2026-07-16T12:00:00.000Z',
      });
      expect(shouldTrigger(reminder, new Date('2026-07-16T12:00:05.000Z'))).toBe(false);
      expect(shouldTrigger(reminder, new Date('2026-07-16T12:00:10.000Z'))).toBe(true);
    });

    it('triggers when never triggered before', () => {
      const reminder = makeReminder({ scheduleType: 'interval', intervalMinutes: 60 });
      expect(shouldTrigger(reminder)).toBe(true);
    });

    it('does NOT trigger when interval has not passed', () => {
      const now = new Date();
      const recentlyTriggered = new Date(now.getTime() - 30 * 60 * 1000); // 30 min ago
      const reminder = makeReminder({
        scheduleType: 'interval',
        intervalMinutes: 60,
        lastTriggeredAt: recentlyTriggered.toISOString(),
      });
      expect(shouldTrigger(reminder, now)).toBe(false);
    });

    // Test 9: Reminder does not trigger twice
    it('triggers again after interval has passed', () => {
      const now = new Date();
      const triggeredLongAgo = new Date(now.getTime() - 90 * 60 * 1000); // 90 min ago
      const reminder = makeReminder({
        scheduleType: 'interval',
        intervalMinutes: 60,
        lastTriggeredAt: triggeredLongAgo.toISOString(),
      });
      expect(shouldTrigger(reminder, now)).toBe(true);
    });

    it('does NOT trigger when disabled', () => {
      const reminder = makeReminder({ enabled: false });
      expect(shouldTrigger(reminder)).toBe(false);
    });
  });

  describe('daily reminders', () => {
    it('respects the seconds component of a daily time', () => {
      const reminder = makeReminder({ scheduleType: 'daily', scheduledAt: '09:30:15' });
      expect(shouldTrigger(reminder, new Date('2026-07-16T09:30:14'))).toBe(false);
      expect(shouldTrigger(reminder, new Date('2026-07-16T09:30:15'))).toBe(true);
    });

    it('triggers at the correct time today (within window)', () => {
      const now = new Date();
      const nowTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const reminder = makeReminder({
        scheduleType: 'daily',
        scheduledAt: nowTime,
      });
      expect(shouldTrigger(reminder, now)).toBe(true);
    });

    // Test 9: Reminder does not trigger twice (daily)
    it('does NOT trigger if already triggered today', () => {
      const now = new Date();
      const nowTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const reminder = makeReminder({
        scheduleType: 'daily',
        scheduledAt: nowTime,
        lastTriggeredAt: new Date().toISOString(), // same day
      });
      expect(shouldTrigger(reminder, now)).toBe(false);
    });

    it('does NOT trigger if scheduled time has not arrived', () => {
      const future = new Date();
      future.setHours(future.getHours() + 2);
      const futureTime = `${String(future.getHours()).padStart(2, '0')}:${String(future.getMinutes()).padStart(2, '0')}`;
      const reminder = makeReminder({
        scheduleType: 'daily',
        scheduledAt: futureTime,
      });
      expect(shouldTrigger(reminder)).toBe(false);
    });

    it('catches a daily reminder missed while the app was asleep', () => {
      const now = new Date('2026-07-16T15:30:00');
      const reminder = makeReminder({ scheduleType: 'daily', scheduledAt: '09:00' });
      expect(shouldTrigger(reminder, now)).toBe(true);
    });
  });

  describe('once reminders', () => {
    it('triggers when scheduled time has arrived', () => {
      const justNow = new Date(Date.now() - 5000); // 5 seconds ago
      const reminder = makeReminder({
        scheduleType: 'once',
        scheduledAt: justNow.toISOString(),
      });
      expect(shouldTrigger(reminder, new Date())).toBe(true);
    });

    // Test 9: once reminder does NOT trigger twice
    it('does NOT trigger twice (once already triggered)', () => {
      const justNow = new Date(Date.now() - 5000);
      const reminder = makeReminder({
        scheduleType: 'once',
        scheduledAt: justNow.toISOString(),
        lastTriggeredAt: new Date().toISOString(),
      });
      expect(shouldTrigger(reminder)).toBe(false);
    });

    it('does NOT trigger for future scheduled time', () => {
      const future = new Date(Date.now() + 3_600_000); // 1 hour from now
      const reminder = makeReminder({
        scheduleType: 'once',
        scheduledAt: future.toISOString(),
      });
      expect(shouldTrigger(reminder)).toBe(false);
    });

    it('catches an overdue one-time reminder after wake', () => {
      const reminder = makeReminder({
        scheduleType: 'once',
        scheduledAt: '2026-07-16T09:00:00',
      });
      expect(shouldTrigger(reminder, new Date('2026-07-16T15:30:00'))).toBe(true);
    });
  });

  it('getNowISO returns valid ISO string', () => {
    const iso = getNowISO();
    const parsed = new Date(iso);
    expect(parsed).toBeInstanceOf(Date);
    expect(isNaN(parsed.getTime())).toBe(false);
  });
});
