import { create } from 'zustand';
import type { PetConfig, ReminderConfig } from '../shared/types';
import { DEFAULT_PET_CONFIG } from '../config/defaultConfig';

interface SettingsStore {
  // Form state (draft, not yet saved)
  draftConfig: PetConfig;
  setDraftConfig: (config: PetConfig) => void;
  updateDraftConfig: (partial: Partial<PetConfig>) => void;

  // Reminders
  reminders: ReminderConfig[];
  setReminders: (reminders: ReminderConfig[]) => void;
  addReminder: (reminder: ReminderConfig) => void;
  updateReminder: (id: string, partial: Partial<ReminderConfig>) => void;
  deleteReminder: (id: string) => void;

  // UI state
  activeTab: 'general' | 'movement' | 'reminders';
  setActiveTab: (tab: 'general' | 'movement' | 'reminders') => void;

  isSaving: boolean;
  setSaving: (saving: boolean) => void;

  saveError: string | null;
  setSaveError: (error: string | null) => void;

  isDirty: boolean;
  setDirty: (dirty: boolean) => void;

  // Reset draft to match current saved config
  resetDraft: (savedConfig: PetConfig) => void;
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  draftConfig: { ...DEFAULT_PET_CONFIG },
  setDraftConfig: (draftConfig) => set({ draftConfig, isDirty: false }),
  updateDraftConfig: (partial) =>
    set((state) => ({
      draftConfig: { ...state.draftConfig, ...partial },
      isDirty: true,
    })),

  reminders: [],
  setReminders: (reminders) => set({ reminders }),
  addReminder: (reminder) =>
    set((state) => ({ reminders: [...state.reminders, reminder], isDirty: true })),
  updateReminder: (id, partial) =>
    set((state) => ({
      reminders: state.reminders.map((r) =>
        r.id === id ? { ...r, ...partial } : r
      ),
      isDirty: true,
    })),
  deleteReminder: (id) =>
    set((state) => ({
      reminders: state.reminders.filter((r) => r.id !== id),
      isDirty: true,
    })),

  activeTab: 'general',
  setActiveTab: (activeTab) => set({ activeTab }),

  isSaving: false,
  setSaving: (isSaving) => set({ isSaving }),

  saveError: null,
  setSaveError: (saveError) => set({ saveError }),

  isDirty: false,
  setDirty: (isDirty) => set({ isDirty }),

  resetDraft: (savedConfig) =>
    set({ draftConfig: { ...savedConfig }, isDirty: false }),
}));
