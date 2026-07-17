import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import ReminderSettings from '../settings/components/ReminderSettings';
import { useSettingsStore } from '../store/settingsStore';
import { DEFAULT_PET_CONFIG } from '../config/defaultConfig';

describe('ReminderSettings', () => {
  beforeEach(() => {
    useSettingsStore.setState({
      draftConfig: { ...DEFAULT_PET_CONFIG },
      reminders: [],
      isDirty: false,
    });
  });

  it('creates an interval with second precision', () => {
    render(<ReminderSettings />);
    fireEvent.click(screen.getByRole('button', { name: '+ Add Reminder' }));
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Stand up' } });
    fireEvent.change(screen.getByLabelText('Hours'), { target: { value: '0' } });
    fireEvent.change(screen.getByLabelText('Minutes'), { target: { value: '0' } });
    fireEvent.change(screen.getByLabelText('Seconds'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(useSettingsStore.getState().reminders[0]).toMatchObject({
      content: 'Stand up',
      intervalSeconds: 10,
      intervalMinutes: undefined,
    });
    expect(useSettingsStore.getState().reminders[0].title).toBeTruthy();
    expect(useSettingsStore.getState().reminders[0].lastTriggeredAt).toBeTruthy();
  });

  it('blocks intervals shorter than the message display cycle', () => {
    render(<ReminderSettings />);
    fireEvent.click(screen.getByRole('button', { name: '+ Add Reminder' }));
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Wait' } });
    fireEvent.change(screen.getByLabelText('Hours'), { target: { value: '0' } });
    fireEvent.change(screen.getByLabelText('Minutes'), { target: { value: '0' } });
    fireEvent.change(screen.getByLabelText('Seconds'), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(screen.getByText('Interval must be at least 10 seconds')).toBeTruthy();
    expect(useSettingsStore.getState().reminders).toHaveLength(0);
  });

  it('enables seconds in daily time inputs', () => {
    render(<ReminderSettings />);
    fireEvent.click(screen.getByRole('button', { name: '+ Add Reminder' }));
    fireEvent.change(screen.getByLabelText('Schedule Type'), { target: { value: 'daily' } });

    expect(screen.getByLabelText('Time (HH:MM:SS)').getAttribute('step')).toBe('1');
  });

  it('adjusts the complete message card scale', () => {
    render(<ReminderSettings />);
    fireEvent.change(screen.getByLabelText('Message Size'), { target: { value: '125' } });

    expect(useSettingsStore.getState().draftConfig.reminderBubbleScale).toBe(125);
    expect(screen.getByText('125%')).toBeTruthy();
    expect(screen.getByTestId('message-size-preview').getAttribute('style')).toContain('scale(0.775)');
  });
});
