import React from 'react';
import { useSettingsStore } from '../../store/settingsStore';

const MovementSettings: React.FC = () => {
  const { draftConfig, updateDraftConfig } = useSettingsStore();

  return (
    <section className="settings-section">
      <h2 className="settings-section__title">Movement</h2>

      {/* Auto Move Toggle */}
      <div className="form-group">
        <label className="form-toggle" htmlFor="auto-move">
          <div className="form-toggle__info">
            <span className="form-toggle__label">Auto Movement</span>
            <span className="form-toggle__desc">Pet walks around the screen automatically</span>
          </div>
          <div className={`toggle ${draftConfig.autoMoveEnabled ? 'toggle--on' : ''}`}>
            <input
              id="auto-move"
              type="checkbox"
              checked={draftConfig.autoMoveEnabled}
              onChange={(e) => updateDraftConfig({ autoMoveEnabled: e.target.checked })}
            />
            <div className="toggle__track">
              <div className="toggle__thumb" />
            </div>
          </div>
        </label>
      </div>

      {/* React on Hover */}
      <div className="form-group">
        <label className="form-toggle" htmlFor="react-on-hover">
          <div className="form-toggle__info">
            <span className="form-toggle__label">React on Hover</span>
            <span className="form-toggle__desc">Pet pauses when you hover over it</span>
          </div>
          <div className={`toggle ${draftConfig.reactOnHover ? 'toggle--on' : ''}`}>
            <input
              id="react-on-hover"
              type="checkbox"
              checked={draftConfig.reactOnHover}
              onChange={(e) => updateDraftConfig({ reactOnHover: e.target.checked })}
            />
            <div className="toggle__track">
              <div className="toggle__thumb" />
            </div>
          </div>
        </label>
      </div>

      {/* Movement Speed */}
      <div className="form-group">
        <label className="form-label" htmlFor="movement-speed">
          Movement Speed
          <span className="form-label__value">{draftConfig.movementSpeed} px/s</span>
        </label>
        <input
          id="movement-speed"
          type="range"
          className="form-slider"
          min={10}
          max={300}
          step={5}
          value={draftConfig.movementSpeed}
          onChange={(e) =>
            updateDraftConfig({ movementSpeed: parseInt(e.target.value, 10) })
          }
          disabled={!draftConfig.autoMoveEnabled}
        />
        <div className="form-slider__labels">
          <span>Slow (10)</span>
          <span>Fast (300)</span>
        </div>
      </div>

    </section>
  );
};

export default MovementSettings;
