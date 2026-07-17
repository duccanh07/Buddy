import { invoke } from '@tauri-apps/api/core';
import type { PetConfig, ReminderConfig } from '../shared/types';
import { DEFAULT_PET_CONFIG, DEFAULT_REMINDERS } from './defaultConfig';
import { ConfigError } from '../shared/errors';

/**
 * ConfigRepository handles raw read/write to persistent storage via Tauri commands.
 * It does NOT perform business logic — that belongs in PetConfigService.
 */
export class ConfigRepository {
  async loadPetConfig(): Promise<PetConfig> {
    try {
      const raw = await invoke<PetConfig>('load_config');
      return raw;
    } catch (err) {
      console.error('[ConfigRepository] Failed to load pet config:', err);
      return { ...DEFAULT_PET_CONFIG };
    }
  }

  async savePetConfig(config: PetConfig): Promise<void> {
    try {
      await invoke('save_config', { config });
    } catch (err) {
      throw new ConfigError('Failed to save pet config', err);
    }
  }

  async loadReminders(): Promise<ReminderConfig[]> {
    try {
      const raw = await invoke<ReminderConfig[]>('load_reminders');
      return Array.isArray(raw) ? raw : [];
    } catch (err) {
      console.error('[ConfigRepository] Failed to load reminders:', err);
      return [...DEFAULT_REMINDERS];
    }
  }

  async saveReminders(reminders: ReminderConfig[]): Promise<void> {
    try {
      await invoke('save_reminders', { reminders });
    } catch (err) {
      throw new ConfigError('Failed to save reminders', err);
    }
  }
}

export const configRepository = new ConfigRepository();
