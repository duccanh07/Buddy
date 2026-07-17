import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DEFAULT_PET_CONFIG } from '../config/defaultConfig';
import MovementSettings from '../settings/components/MovementSettings';
import { useSettingsStore } from '../store/settingsStore';

describe('MovementSettings', () => {
  beforeEach(() => {
    useSettingsStore.setState({
      draftConfig: { ...DEFAULT_PET_CONFIG },
      isDirty: false,
    });
  });

  it('shows a single slider and updates movement speed', () => {
    render(<MovementSettings />);

    const sliders = screen.getAllByRole('slider');
    expect(sliders).toHaveLength(1);

    fireEvent.change(sliders[0], { target: { value: '120' } });
    expect(useSettingsStore.getState().draftConfig.movementSpeed).toBe(120);
    expect(screen.getByText('120 px/s')).toBeTruthy();
  });
});
