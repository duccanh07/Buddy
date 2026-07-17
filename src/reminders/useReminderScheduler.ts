import { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import type { ReminderConfig } from '../shared/types';
import { EVENTS } from '../shared/events';
import { reminderRepository } from './ReminderRepository';
import { reminderScheduler } from './ReminderScheduler';
import { usePetStore } from '../store/petStore';

/** Starts the reminder runtime only after the pet anchor and size are ready. */
export function useReminderScheduler(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let unlisten: (() => void) | undefined;

    const showReminder = (reminder: ReminderConfig) => {
      const state = usePetStore.getState();
      const bubble = { instanceId: Date.now(), message: reminder.content, autoCloseMs: 8000 };
      if (state.petState === 'dragging') {
        state.showBubble(bubble);
        return;
      }

      void invoke<'above' | 'below'>('set_pet_bubble_layout', {
        visible: true,
        petWidth: state.config.width,
        petHeight: state.config.height,
        scalePercent: state.config.reminderBubbleScale ?? 100,
      })
        .then((placement) => {
          const current = usePetStore.getState();
          current.setBubblePlacement(placement);
          current.showBubble(bubble);
        })
        .catch((error) => {
          console.error('[ReminderScheduler] Could not show reminder bubble:', error);
        });
    };

    async function initialize(): Promise<void> {
      await reminderRepository.load();
      if (cancelled) return;

      reminderScheduler.start(showReminder);
      unlisten = await listen<ReminderConfig[]>(EVENTS.REMINDERS_UPDATED, (event) => {
        reminderRepository.setAll(event.payload);
        reminderScheduler.checkNow();
      });
      if (cancelled) unlisten();
    }

    void initialize().catch((error) => {
      console.error('[ReminderScheduler] Initialization error:', error);
    });

    return () => {
      cancelled = true;
      unlisten?.();
      reminderScheduler.stop();
    };
  }, [enabled]);
}
