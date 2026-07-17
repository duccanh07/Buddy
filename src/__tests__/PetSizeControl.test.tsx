import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import PetSizeControl from '../settings/components/PetSizeControl';
import { useSettingsStore } from '../store/settingsStore';
import { DEFAULT_PET_CONFIG } from '../config/defaultConfig';
import { createCodexManifest } from '../pet/animation/animationManifest';

describe('PetSizeControl', () => {
  beforeEach(() => {
    useSettingsStore.setState({
      draftConfig: { ...DEFAULT_PET_CONFIG },
      isDirty: false,
    });
  });

  it('updates the pet size from the slider', () => {
    render(<PetSizeControl />);
    fireEvent.change(screen.getByRole('slider'), { target: { value: '240' } });

    expect(useSettingsStore.getState().draftConfig).toMatchObject({
      width: 240,
      height: 240,
    });
    expect(useSettingsStore.getState().isDirty).toBe(true);
    expect(screen.getByText('240 px')).toBeTruthy();
  });

  it('uses the native frame aspect ratio from the manifest', () => {
    useSettingsStore.setState({
      draftConfig: {
        ...DEFAULT_PET_CONFIG,
        width: 192,
        height: 208,
        animationManifest: createCodexManifest(192, 208, 11),
      },
    });

    render(<PetSizeControl />);
    fireEvent.change(screen.getByRole('slider'), { target: { value: '260' } });

    expect(useSettingsStore.getState().draftConfig).toMatchObject({
      width: 240,
      height: 260,
    });
  });
});
