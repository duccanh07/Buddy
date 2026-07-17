import type { PetConfig, ReminderConfig, ValidationResult } from './types';
import { DEFAULT_PET_CONFIG } from '../config/defaultConfig';

const ALLOWED_EXTENSIONS = ['gif', 'webp', 'png'];
const ALLOWED_MIME_TYPES = ['image/gif', 'image/webp', 'image/png'];

// ========== Image Path Validation ==========

export function isValidImagePath(path: string): boolean {
  if (!path) return true; // empty is allowed (means no custom image)
  const lower = path.toLowerCase();
  const ext = lower.split('.').pop() ?? '';
  return ALLOWED_EXTENSIONS.includes(ext);
}

export function isValidMimeType(mimeType: string): boolean {
  return ALLOWED_MIME_TYPES.includes(mimeType);
}

// ========== PetConfig Validation ==========

export function validatePetConfig(
  raw: unknown
): ValidationResult<PetConfig> {
  const errors: string[] = [];

  if (typeof raw !== 'object' || raw === null) {
    return { valid: false, errors: ['Config must be an object'] };
  }

  const c = raw as Record<string, unknown>;

  // Merge with defaults for missing fields
  const config: PetConfig = {
    ...DEFAULT_PET_CONFIG,
    ...(c as Partial<PetConfig>),
  };

  // width
  if (typeof config.width !== 'number' || config.width <= 0) {
    errors.push('width must be a positive number');
    config.width = DEFAULT_PET_CONFIG.width;
  }

  // height
  if (typeof config.height !== 'number' || config.height <= 0) {
    errors.push('height must be a positive number');
    config.height = DEFAULT_PET_CONFIG.height;
  }

  // movementSpeed
  if (
    typeof config.movementSpeed !== 'number' ||
    config.movementSpeed < 10 ||
    config.movementSpeed > 500
  ) {
    errors.push('movementSpeed must be between 10 and 500 px/s');
    config.movementSpeed = DEFAULT_PET_CONFIG.movementSpeed;
  }

  // movementDurationMs
  if (
    typeof config.movementDurationMs !== 'number' ||
    config.movementDurationMs < 0
  ) {
    errors.push('movementDurationMs must be non-negative');
    config.movementDurationMs = DEFAULT_PET_CONFIG.movementDurationMs;
  }

  // movementIntervalMs
  if (
    typeof config.movementIntervalMs !== 'number' ||
    config.movementIntervalMs < 0
  ) {
    errors.push('movementIntervalMs must be non-negative');
    config.movementIntervalMs = DEFAULT_PET_CONFIG.movementIntervalMs;
  }

  if (
    typeof config.reminderBubbleScale !== 'number' ||
    config.reminderBubbleScale < 75 ||
    config.reminderBubbleScale > 150
  ) {
    errors.push('reminderBubbleScale must be between 75 and 150 percent');
    config.reminderBubbleScale = DEFAULT_PET_CONFIG.reminderBubbleScale;
  }

  // imagePath
  if (config.imagePath && !isValidImagePath(config.imagePath)) {
    errors.push('imagePath must be a GIF, WebP, or PNG file');
    config.imagePath = '';
  }

  return {
    valid: errors.length === 0,
    data: config,
    errors,
  };
}

// ========== ReminderConfig Validation ==========

export function validateReminderConfig(
  raw: unknown
): ValidationResult<ReminderConfig> {
  const errors: string[] = [];

  if (typeof raw !== 'object' || raw === null) {
    return { valid: false, errors: ['Reminder must be an object'] };
  }

  const r = raw as Record<string, unknown>;

  if (!r.id || typeof r.id !== 'string') {
    errors.push('id is required');
  }

  if (!r.title || typeof r.title !== 'string') {
    errors.push('title is required');
  }

  if (!r.content || typeof r.content !== 'string') {
    errors.push('content is required');
  }

  const validScheduleTypes = ['once', 'daily', 'interval'];
  if (!validScheduleTypes.includes(r.scheduleType as string)) {
    errors.push('scheduleType must be once, daily, or interval');
  }

  if (r.scheduleType === 'interval') {
    const intervalSeconds = typeof r.intervalSeconds === 'number'
      ? r.intervalSeconds
      : typeof r.intervalMinutes === 'number'
        ? r.intervalMinutes * 60
        : 0;
    if (!Number.isFinite(intervalSeconds) || intervalSeconds <= 0) {
      errors.push('intervalSeconds must be greater than 0');
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: r as unknown as ReminderConfig,
    errors: [],
  };
}
