import React from 'react';
import { useSettingsStore } from '../../store/settingsStore';
import PetLibrary from './PetLibrary';
import PetSizeControl from './PetSizeControl';

const GeneralSettings: React.FC = () => {
  const { draftConfig, updateDraftConfig } = useSettingsStore();

  return (
    <section className="settings-section">
      <h2 className="settings-section__title">General</h2>

      {/* Pet Library UI */}
      <PetLibrary />

      <PetSizeControl />

      {/* Always on top */}
      <div className="form-group">
        <label className="form-toggle" htmlFor="always-on-top">
          <div className="form-toggle__info">
            <span className="form-toggle__label">Always on Top</span>
            <span className="form-toggle__desc">Pet stays above all other windows</span>
          </div>
          <div className={`toggle ${draftConfig.alwaysOnTop ? 'toggle--on' : ''}`}>
            <input
              id="always-on-top"
              type="checkbox"
              checked={draftConfig.alwaysOnTop}
              onChange={(e) => updateDraftConfig({ alwaysOnTop: e.target.checked })}
            />
            <div className="toggle__track">
              <div className="toggle__thumb" />
            </div>
          </div>
        </label>
      </div>

      {/* Start with system */}
      <div className="form-group">
        <label className="form-toggle" htmlFor="startup-enabled">
          <div className="form-toggle__info">
            <span className="form-toggle__label">Start with System</span>
            <span className="form-toggle__desc">Launch Buddy when you log in</span>
          </div>
          <div className={`toggle ${draftConfig.startupEnabled ? 'toggle--on' : ''}`}>
            <input
              id="startup-enabled"
              type="checkbox"
              checked={draftConfig.startupEnabled}
              onChange={(e) => updateDraftConfig({ startupEnabled: e.target.checked })}
            />
            <div className="toggle__track">
              <div className="toggle__thumb" />
            </div>
          </div>
        </label>
      </div>
    </section>
  );
};

export default GeneralSettings;
