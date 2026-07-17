import React from 'react';
import { useSettingsStore } from '../../store/settingsStore';

const PetSizeControl: React.FC = () => {
  const { draftConfig, updateDraftConfig } = useSettingsStore();

  const handleSizeChange = (size: number) => {
    const manifest = draftConfig.animationManifest;
    const aspectRatio = manifest
      ? manifest.frameWidth / manifest.frameHeight
      : draftConfig.width / Math.max(1, draftConfig.height);
    updateDraftConfig({
      width: Math.max(1, Math.round(size * aspectRatio)),
      height: size,
    });
  };

  return (
    <div className="form-group">
      <label className="form-label" htmlFor="pet-size">
        Pet Size
        <span className="form-label__value">{draftConfig.height} px</span>
      </label>
      <input
        id="pet-size"
        type="range"
        className="form-slider"
        min={64}
        max={320}
        step={4}
        value={Math.min(320, Math.max(64, draftConfig.height))}
        onChange={(event) => handleSizeChange(Number(event.target.value))}
      />
      <div className="form-slider__labels">
        <span>Small (64)</span>
        <span>Large (320)</span>
      </div>
      <span className="form-toggle__desc">
        Width follows the pet frame aspect ratio automatically.
      </span>
    </div>
  );
};

export default PetSizeControl;
