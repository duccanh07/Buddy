import React, { useEffect, useMemo, useState } from 'react';
import { useSettingsStore } from '../../store/settingsStore';
import PetImage from '../../pet/components/PetImage';
import { createLegacyManifest } from '../../pet/animation/animationManifest';

/**
 * PetPreview shows a live preview of the pet with current draft settings.
 */
const PetPreview: React.FC = () => {
  const { draftConfig } = useSettingsStore();
  const manifest = useMemo(
    () => draftConfig.animationManifest ?? createLegacyManifest(draftConfig),
    [draftConfig]
  );
  const animationKeys = useMemo(() => Object.keys(manifest.animations), [manifest]);
  const [animationKey, setAnimationKey] = useState('idle');

  useEffect(() => {
    if (!animationKeys.includes(animationKey)) {
      setAnimationKey(animationKeys[0] ?? 'idle');
    }
  }, [animationKey, animationKeys]);

  const previewScale = Math.min(
    1,
    180 / Math.max(1, draftConfig.width),
    180 / Math.max(1, draftConfig.height)
  );
  const previewWidth = Math.round(draftConfig.width * previewScale);
  const previewHeight = Math.round(draftConfig.height * previewScale);

  return (
    <div className="pet-preview">
      <h3 className="pet-preview__title">Preview</h3>
      <div
        className="pet-preview__frame"
        style={{ width: previewWidth, height: previewHeight }}
      >
        {draftConfig.imagePath ? (
          <PetImage
            imagePath={draftConfig.imagePath}
            width={previewWidth}
            height={previewHeight}
            alt="Pet preview"
            spritesheetEnabled={draftConfig.spritesheetEnabled}
            spritesheetCols={draftConfig.spritesheetCols}
            spritesheetRows={draftConfig.spritesheetRows}
            spritesheetFps={draftConfig.spritesheetFps}
            spritesheetIdleFrame={draftConfig.spritesheetIdleFrame}
            spritesheetWalkFrame={draftConfig.spritesheetWalkFrame}
            spritesheetDragFrame={draftConfig.spritesheetDragFrame}
            spritesheetSleepFrame={draftConfig.spritesheetSleepFrame}
            animationManifest={manifest}
            animationKey={animationKey}
          />
        ) : (
          <div className="pet-preview__placeholder">
            <span>🐾</span>
            <p>No image selected</p>
          </div>
        )}
      </div>
      <p className="pet-preview__size">
        {draftConfig.width} × {draftConfig.height} px
      </p>
      {draftConfig.spritesheetEnabled && animationKeys.length > 0 && (
        <label className="pet-preview__animation">
          <span>Animation</span>
          <select
            value={animationKey}
            onChange={(event) => setAnimationKey(event.target.value)}
          >
            {animationKeys.map((key) => (
              <option key={key} value={key}>{key}</option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
};

export default PetPreview;
