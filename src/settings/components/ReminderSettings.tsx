import React, { useState, useCallback, useMemo } from 'react';
import { useSettingsStore } from '../../store/settingsStore';
import type { ReminderConfig } from '../../shared/types';
import PetImage from '../../pet/components/PetImage';
import { createLegacyManifest } from '../../pet/animation/animationManifest';
import { Bell, BellOff, Pencil, Trash2 } from 'lucide-react';
import { MIN_REMINDER_INTERVAL_SECONDS } from '../../reminders/constants';

function generateId(): string {
  return `reminder-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

const REMINDER_TITLES = [
  'A little reminder',
  'Buddy says hi',
  'Quick reminder',
  'Just a heads-up',
  'Time for a moment',
];
const MESSAGE_PREVIEW_SCENE_SCALE = 0.62;
const MIN_MESSAGE_CARD_WIDTH = 200;
const MAX_MESSAGE_CARD_WIDTH = 360;

function generateRandomTitle(): string {
  const index = Math.floor(Math.random() * REMINDER_TITLES.length);
  return REMINDER_TITLES[index] ?? 'Buddy reminder';
}

const EMPTY_REMINDER: Omit<ReminderConfig, 'id'> = {
  title: '',
  content: '',
  enabled: true,
  scheduleType: 'interval',
  intervalSeconds: 3600,
  scheduledAt: undefined,
  lastTriggeredAt: undefined,
};

const getIntervalSeconds = (reminder: Partial<ReminderConfig>): number =>
  Math.max(0, Math.round(reminder.intervalSeconds ?? (reminder.intervalMinutes ?? 60) * 60));

const formatInterval = (reminder: Partial<ReminderConfig>): string => {
  const total = Math.max(MIN_REMINDER_INTERVAL_SECONDS, getIntervalSeconds(reminder));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return [hours > 0 ? `${hours}h` : '', minutes > 0 ? `${minutes}m` : '', `${seconds}s`]
    .filter(Boolean)
    .join(' ');
};

const ReminderSettings: React.FC = () => {
  const { draftConfig, reminders, isDirty, updateDraftConfig, addReminder, updateReminder, deleteReminder } =
    useSettingsStore();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<ReminderConfig, 'id'>>(EMPTY_REMINDER);
  const [formErrors, setFormErrors] = useState<string[]>([]);

  const openNewForm = useCallback(() => {
    setEditingId('__new__');
    setForm({ ...EMPTY_REMINDER });
    setFormErrors([]);
  }, []);

  const openEditForm = useCallback(
    (reminder: ReminderConfig) => {
      setEditingId(reminder.id);
      setForm({
        ...reminder,
        intervalSeconds: Math.max(MIN_REMINDER_INTERVAL_SECONDS, getIntervalSeconds(reminder)),
      });
      setFormErrors([]);
    },
    []
  );

  const closeForm = useCallback(() => {
    setEditingId(null);
    setFormErrors([]);
  }, []);

  const validateForm = useCallback((): boolean => {
    const errors: string[] = [];
    if (!form.content.trim()) errors.push('Message is required');
    if (form.scheduleType === 'interval') {
      if (getIntervalSeconds(form) < MIN_REMINDER_INTERVAL_SECONDS) {
        errors.push(`Interval must be at least ${MIN_REMINDER_INTERVAL_SECONDS} seconds`);
      }
    }
    if (form.scheduleType === 'once' || form.scheduleType === 'daily') {
      if (!form.scheduledAt) errors.push('Schedule time is required');
    }
    setFormErrors(errors);
    return errors.length === 0;
  }, [form]);

  const handleSave = useCallback(() => {
    if (!validateForm()) return;

    if (editingId === '__new__') {
      addReminder({
        ...form,
        title: generateRandomTitle(),
        id: generateId(),
        intervalMinutes: undefined,
        // An interval starts counting from creation instead of firing instantly.
        lastTriggeredAt: form.scheduleType === 'interval' ? new Date().toISOString() : undefined,
      });
    } else if (editingId) {
      updateReminder(editingId, {
        ...form,
        title: form.title.trim() || generateRandomTitle(),
        intervalMinutes: undefined,
      });
    }
    closeForm();
  }, [editingId, form, validateForm, addReminder, updateReminder, closeForm]);

  const scheduleTypeLabel: Record<ReminderConfig['scheduleType'], string> = {
    once: 'Once',
    daily: 'Daily',
    interval: 'Interval',
  };
  const messageScale = (draftConfig.reminderBubbleScale ?? 100) / 100;
  const previewMessage = form.content.trim()
    || reminders.find((reminder) => reminder.enabled)?.content
    || reminders[0]?.content
    || 'Đây là nội dung nhắc nhở của bạn.';
  const previewManifest = useMemo(
    () => draftConfig.animationManifest ?? createLegacyManifest(draftConfig),
    [draftConfig]
  );
  const previewAnimationKey = previewManifest.animations.idle
    ? 'idle'
    : Object.keys(previewManifest.animations)[0];
  const bubblePreviewScale = messageScale * MESSAGE_PREVIEW_SCENE_SCALE;
  const messageCardWidth = Math.min(
    MAX_MESSAGE_CARD_WIDTH,
    Math.max(MIN_MESSAGE_CARD_WIDTH, draftConfig.width)
  );
  const petPreviewWidth = Math.max(1, Math.round(draftConfig.width * MESSAGE_PREVIEW_SCENE_SCALE));
  const petPreviewHeight = Math.max(1, Math.round(draftConfig.height * MESSAGE_PREVIEW_SCENE_SCALE));
  const previewGap = Math.round((10 + 16 * messageScale) * MESSAGE_PREVIEW_SCENE_SCALE);

  return (
    <section className="settings-section">
      <h2 className="settings-section__title">Reminders</h2>

      <div className="form-group reminder-message-size">
        <label className="form-label" htmlFor="reminder-message-size">
          Message Size
          <span className="form-label__value">{draftConfig.reminderBubbleScale ?? 100}%</span>
        </label>
        <input
          id="reminder-message-size"
          aria-label="Message Size"
          className="form-slider"
          type="range"
          min={75}
          max={150}
          step={5}
          value={draftConfig.reminderBubbleScale ?? 100}
          onChange={(event) => updateDraftConfig({
            reminderBubbleScale: Number(event.target.value),
          })}
        />
        <div className="form-slider__labels">
          <span>Compact</span>
          <span>Large</span>
        </div>
        <div
          className="message-size-preview"
          aria-label="Message preview"
        >
          <div className="message-size-preview__scene" style={{ gap: `${previewGap}px` }}>
            <div
              className="message-size-preview__bubble-slot"
              style={{ height: `${Math.round(64 * bubblePreviewScale)}px` }}
            >
              <div
                className="message-size-preview__bubble"
                data-testid="message-size-preview"
                style={{
                  width: `${messageCardWidth}px`,
                  transform: `scale(${bubblePreviewScale})`,
                }}
              >
                <span className="message-size-preview__text">{previewMessage}</span>
                <span className="message-size-preview__progress" aria-hidden="true">
                  <svg viewBox="0 0 36 36">
                    <circle className="message-size-preview__track" cx="18" cy="18" r="15.9" />
                    <circle className="message-size-preview__value" cx="18" cy="18" r="15.9" />
                  </svg>
                </span>
              </div>
            </div>
            <div
              className="message-size-preview__pet"
              style={{ width: petPreviewWidth, height: petPreviewHeight }}
            >
              {draftConfig.imagePath ? (
                <PetImage
                  imagePath={draftConfig.imagePath}
                  width={petPreviewWidth}
                  height={petPreviewHeight}
                  alt="Pet in message preview"
                  spritesheetEnabled={draftConfig.spritesheetEnabled}
                  spritesheetCols={draftConfig.spritesheetCols}
                  spritesheetRows={draftConfig.spritesheetRows}
                  spritesheetFps={draftConfig.spritesheetFps}
                  spritesheetIdleFrame={draftConfig.spritesheetIdleFrame}
                  spritesheetWalkFrame={draftConfig.spritesheetWalkFrame}
                  spritesheetDragFrame={draftConfig.spritesheetDragFrame}
                  spritesheetSleepFrame={draftConfig.spritesheetSleepFrame}
                  animationManifest={previewManifest}
                  animationKey={previewAnimationKey}
                />
              ) : (
                <span className="message-size-preview__pet-placeholder" aria-label="Pet placeholder">🐾</span>
              )}
            </div>
          </div>
        </div>
        {isDirty && (
          <span className="form-toggle__desc">
            Preview will apply to your pet after Save Changes.
          </span>
        )}
      </div>

      {/* Reminder List */}
      <div className="reminder-list">
        {reminders.length === 0 && (
          <p className="reminder-list__empty">No reminders yet. Add one below!</p>
        )}
        {reminders.map((r) => (
          <div key={r.id} className={`reminder-item ${!r.enabled ? 'reminder-item--disabled' : ''}`}>
            <div className="reminder-item__info">
              <span className="reminder-item__title">{r.title}</span>
              <span className="reminder-item__meta">
                {scheduleTypeLabel[r.scheduleType]}
                {r.scheduleType === 'interval' && ` · every ${formatInterval(r)}`}
                {r.scheduleType === 'daily' && r.scheduledAt && ` · ${r.scheduledAt}`}
              </span>
            </div>
            <div className="reminder-item__actions">
              <button
                className="reminder-action"
                onClick={() => updateReminder(r.id, { enabled: !r.enabled })}
                title={r.enabled ? 'Disable' : 'Enable'}
                aria-label={r.enabled ? 'Disable reminder' : 'Enable reminder'}
                type="button"
              >
                {r.enabled ? <Bell size={17} /> : <BellOff size={17} />}
              </button>
              <button
                className="reminder-action"
                onClick={() => openEditForm(r)}
                title="Edit"
                aria-label="Edit reminder"
                type="button"
              >
                <Pencil size={17} />
              </button>
              <button
                className="reminder-action reminder-action--danger"
                onClick={() => deleteReminder(r.id)}
                title="Delete"
                aria-label="Delete reminder"
                type="button"
              >
                <Trash2 size={17} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {editingId === null && (
        <button
          className="btn btn--primary"
          onClick={openNewForm}
          type="button"
          id="add-reminder-btn"
        >
          + Add Reminder
        </button>
      )}

      {/* Add/Edit Form */}
      {editingId !== null && (
        <div className="reminder-form">
          <h3 className="reminder-form__title">
            {editingId === '__new__' ? 'New Reminder' : 'Edit Reminder'}
          </h3>

          {formErrors.length > 0 && (
            <ul className="form-errors">
              {formErrors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="reminder-content">Message</label>
            <textarea
              id="reminder-content"
              className="form-textarea"
              value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              placeholder="e.g. Time to stretch!"
              rows={3}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="reminder-type">Schedule Type</label>
            <select
              id="reminder-type"
              className="form-select"
              value={form.scheduleType}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  scheduleType: e.target.value as ReminderConfig['scheduleType'],
                }))
              }
            >
              <option value="interval">Repeat by interval</option>
              <option value="daily">Daily at specific time</option>
              <option value="once">Once at specific time</option>
            </select>
          </div>

          {form.scheduleType === 'interval' && (
            <div className="form-group">
              <span className="form-label">Interval</span>
              <div className="reminder-interval-fields">
                {([
                  ['Hours', Math.floor(getIntervalSeconds(form) / 3600), 23],
                  ['Minutes', Math.floor((getIntervalSeconds(form) % 3600) / 60), 59],
                  ['Seconds', getIntervalSeconds(form) % 60, 59],
                ] as const).map(([label, value, max]) => (
                  <label className="form-field" key={label}>
                    <span className="form-label form-label--small">{label}</span>
                    <input
                      className="form-input form-input--number"
                      type="number"
                      min={0}
                      max={max}
                      value={value}
                      onChange={(event) => {
                        const next = Math.max(0, Math.min(max, Number(event.target.value) || 0));
                        const current = getIntervalSeconds(form);
                        const hours = label === 'Hours' ? next : Math.floor(current / 3600);
                        const minutes = label === 'Minutes' ? next : Math.floor((current % 3600) / 60);
                        const seconds = label === 'Seconds' ? next : current % 60;
                        setForm((previous) => ({
                          ...previous,
                          intervalSeconds: hours * 3600 + minutes * 60 + seconds,
                          intervalMinutes: undefined,
                        }));
                      }}
                    />
                  </label>
                ))}
              </div>
              <span className="form-toggle__desc">
                Minimum {MIN_REMINDER_INTERVAL_SECONDS} seconds between messages.
              </span>
            </div>
          )}

          {(form.scheduleType === 'daily' || form.scheduleType === 'once') && (
            <div className="form-group">
              <label className="form-label" htmlFor="reminder-at">
                {form.scheduleType === 'daily' ? 'Time (HH:MM:SS)' : 'Date & Time (to seconds)'}
              </label>
              <input
                id="reminder-at"
                className="form-input"
                type={form.scheduleType === 'daily' ? 'time' : 'datetime-local'}
                step={1}
                value={form.scheduledAt ?? ''}
                onChange={(e) =>
                  setForm((f) => ({ ...f, scheduledAt: e.target.value }))
                }
              />
            </div>
          )}

          <div className="form-row form-row--end">
            <button className="btn btn--ghost" onClick={closeForm} type="button">
              Cancel
            </button>
            <button
              className="btn btn--primary"
              onClick={handleSave}
              type="button"
              id="save-reminder-btn"
            >
              {editingId === '__new__' ? 'Add' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
};

export default ReminderSettings;
