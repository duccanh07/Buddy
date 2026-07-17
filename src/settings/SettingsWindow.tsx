import React, { useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { emit } from '@tauri-apps/api/event';
import { enable as enableAutostart, disable as disableAutostart } from '@tauri-apps/plugin-autostart';
import { useSettingsStore } from '../store/settingsStore';
import { usePetStore } from '../store/petStore';
import { petConfigService } from '../config/PetConfigService';
import { configRepository } from '../config/ConfigRepository';
import { EVENTS } from '../shared/events';
import GeneralSettings from './components/GeneralSettings';
import MovementSettings from './components/MovementSettings';
import ReminderSettings from './components/ReminderSettings';
import PetPreview from './components/PetPreview';
import { Settings, Move, Bell, Sun, Moon } from 'lucide-react';
import { isPermissionGranted, requestPermission } from '@tauri-apps/plugin-notification';

const SettingsWindow: React.FC = () => {
  const {
    draftConfig,
    setDraftConfig,
    reminders,
    setReminders,
    activeTab,
    setActiveTab,
    isSaving,
    setSaving,
    saveError,
    setSaveError,
    isDirty,
    resetDraft,
    updateDraftConfig,
  } = useSettingsStore();

  const { config: savedConfig } = usePetStore();

  // Load config into draft on mount
  useEffect(() => {
    async function loadData() {
      try {
        const config = await petConfigService.loadConfig();
        setDraftConfig(config);
        const loadedReminders = await configRepository.loadReminders();
        setReminders(loadedReminders);
      } catch (err) {
        console.error('[SettingsWindow] Failed to load config:', err);
      }
    }
    loadData();
  }, [setDraftConfig, setReminders]);

  // Apply Theme
  useEffect(() => {
    const theme = draftConfig.theme || 'system';
    const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    
    if (isDark) {
      document.body.classList.remove('theme-light');
    } else {
      document.body.classList.add('theme-light');
    }
  }, [draftConfig.theme]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveError(null);

    try {
      await petConfigService.saveConfig(draftConfig);
      await configRepository.saveReminders(reminders);
      await emit(EVENTS.REMINDERS_UPDATED, reminders);

      // Ask from this user-initiated Save action so macOS/Windows can display
      // native notifications when the scheduler fires.
      if (!(await isPermissionGranted())) {
        await requestPermission();
      }

      // Handle startup setting
      if (draftConfig.startupEnabled) {
        await enableAutostart();
      } else {
        await disableAutostart();
      }

      // Update always-on-top immediately
      await invoke('set_pet_always_on_top', { enabled: draftConfig.alwaysOnTop });

      // Update pet window size
      await invoke('set_pet_window_size', {
        width: draftConfig.width,
        height: draftConfig.height,
        scalePercent: draftConfig.reminderBubbleScale ?? 100,
      });

      // Update the library profile in pets.json
      if (draftConfig.activePetId) {
        await invoke('update_pet_profile', {
          id: draftConfig.activePetId,
          width: draftConfig.width,
          height: draftConfig.height,
          preserveAspectRatio: draftConfig.preserveAspectRatio,
          spritesheetEnabled: draftConfig.spritesheetEnabled || false,
          spritesheetCols: draftConfig.spritesheetCols || 4,
          spritesheetRows: draftConfig.spritesheetRows || 4,
          spritesheetFps: draftConfig.spritesheetFps || 8,
          spritesheetIdleFrame: draftConfig.spritesheetIdleFrame ?? 0,
          spritesheetWalkFrame: draftConfig.spritesheetWalkFrame ?? 1,
          spritesheetDragFrame: draftConfig.spritesheetDragFrame ?? 2,
          spritesheetSleepFrame: draftConfig.spritesheetSleepFrame ?? 3,
          spriteVersionNumber: draftConfig.spriteVersionNumber,
          animationManifest: draftConfig.animationManifest,
        });
      }

      // Emit config updated event to pet window
      await emit(EVENTS.PET_CONFIG_UPDATED, draftConfig);

      resetDraft(draftConfig);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setSaveError(msg);
      console.error('[SettingsWindow] Save error:', err);
    } finally {
      setSaving(false);
    }
  }, [draftConfig, reminders, setSaving, setSaveError, resetDraft]);

  const handleResetDraft = useCallback(async () => {
    resetDraft(savedConfig);
    setReminders(await configRepository.loadReminders());
  }, [savedConfig, resetDraft, setReminders]);

  const handleShowPet = useCallback(async () => {
    await invoke('show_pet_window');
  }, []);

  const handleHidePet = useCallback(async () => {
    await invoke('hide_pet_window');
  }, []);

  const handleResetPosition = useCallback(async () => {
    await emit(EVENTS.PET_RESET_POSITION, null);
  }, []);

  const handleExit = useCallback(async () => {
    const { exit } = await import('@tauri-apps/plugin-process');
    await exit(0);
  }, []);



  return (
    <div className="settings-window">
      {/* Header */}
      <header className="settings-header">
        <div className="settings-header__logo">
          <span className="settings-header__icon">🐾</span>
          <h1 className="settings-header__title">Buddy Settings</h1>
        </div>
        <div className="settings-header__actions" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            className="btn btn--ghost btn--sm"
            onClick={() => {
              const currentTheme = draftConfig.theme || 'system';
              const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
              updateDraftConfig({ theme: nextTheme });
            }}
            type="button"
            title="Toggle Light/Dark Mode"
            style={{ padding: '6px', borderRadius: '50%' }}
          >
            {draftConfig.theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button
            className="btn btn--ghost btn--sm"
            onClick={handleShowPet}
            type="button"
            id="show-pet-btn"
          >
            Show Pet
          </button>
          <button
            className="btn btn--ghost btn--sm"
            onClick={handleHidePet}
            type="button"
            id="hide-pet-btn"
          >
            Hide Pet
          </button>
          <button
            className="btn btn--ghost btn--sm"
            onClick={handleResetPosition}
            type="button"
            id="reset-position-btn"
          >
            Reset Position
          </button>
          <button
            className="btn btn--danger btn--sm"
            onClick={handleExit}
            type="button"
            id="exit-btn"
          >
            Exit
          </button>
        </div>
      </header>

      <div className="settings-body">
        {/* Sidebar Tabs */}
        <nav className="settings-tabs" aria-label="Settings sections">
          <button
            className={`settings-tab ${activeTab === 'general' ? 'settings-tab--active' : ''}`}
            onClick={() => setActiveTab('general')}
          >
            <Settings size={18} style={{ marginRight: '8px' }} /> General
          </button>
          <button
            className={`settings-tab ${activeTab === 'movement' ? 'settings-tab--active' : ''}`}
            onClick={() => setActiveTab('movement')}
          >
            <Move size={18} style={{ marginRight: '8px' }} /> Movement
          </button>
          <button
            className={`settings-tab ${activeTab === 'reminders' ? 'settings-tab--active' : ''}`}
            onClick={() => setActiveTab('reminders')}
          >
            <Bell size={18} style={{ marginRight: '8px' }} /> Reminders
          </button>
        </nav>

        {/* Main content + preview */}
        <div className="settings-content">
          <div className="settings-main">
            {activeTab === 'general' && <GeneralSettings />}
            {activeTab === 'movement' && <MovementSettings />}
            {activeTab === 'reminders' && <ReminderSettings />}
          </div>

          {/* Preview panel (only for general) */}
          {activeTab === 'general' && (
            <aside className="settings-preview-panel">
              <PetPreview />
            </aside>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="settings-footer">
        {saveError && (
          <p className="settings-footer__error">⚠️ {saveError}</p>
        )}
        {isDirty && !isSaving && (
          <p className="settings-footer__unsaved">Unsaved changes</p>
        )}
        <div className="settings-footer__actions">
          <button
            className="btn btn--ghost"
            onClick={handleResetDraft}
            disabled={!isDirty || isSaving}
            type="button"
            id="discard-btn"
          >
            Discard
          </button>
          <button
            className="btn btn--primary"
            onClick={handleSave}
            disabled={isSaving}
            type="button"
            id="save-btn"
          >
            {isSaving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </footer>
    </div>
  );
};

export default SettingsWindow;
