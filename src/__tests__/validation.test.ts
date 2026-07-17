import { describe, it, expect } from 'vitest';
import { validatePetConfig, validateReminderConfig, isValidImagePath } from '../shared/validation';
import { DEFAULT_PET_CONFIG } from '../config/defaultConfig';

// Test 8: Config error falls back to default
describe('validatePetConfig', () => {
  it('returns default config for null input', () => {
    const result = validatePetConfig(null);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('returns default config for empty object', () => {
    const result = validatePetConfig({});
    expect(result.valid).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data!.width).toBe(DEFAULT_PET_CONFIG.width);
  });

  it('accepts valid config', () => {
    const config = { ...DEFAULT_PET_CONFIG };
    const result = validatePetConfig(config);
    expect(result.valid).toBe(true);
    expect(result.data?.width).toBe(DEFAULT_PET_CONFIG.width);
  });

  it('rejects invalid width and falls back to default', () => {
    const config = { ...DEFAULT_PET_CONFIG, width: -10 };
    const result = validatePetConfig(config);
    expect(result.errors.some((e) => e.includes('width'))).toBe(true);
    expect(result.data!.width).toBe(DEFAULT_PET_CONFIG.width);
  });

  it('rejects invalid height and falls back to default', () => {
    const config = { ...DEFAULT_PET_CONFIG, height: 0 };
    const result = validatePetConfig(config);
    expect(result.errors.some((e) => e.includes('height'))).toBe(true);
    expect(result.data!.height).toBe(DEFAULT_PET_CONFIG.height);
  });

  it('rejects movementSpeed out of bounds', () => {
    const config = { ...DEFAULT_PET_CONFIG, movementSpeed: 999 };
    const result = validatePetConfig(config);
    expect(result.errors.some((e) => e.includes('movementSpeed'))).toBe(true);
    expect(result.data!.movementSpeed).toBe(DEFAULT_PET_CONFIG.movementSpeed);
  });

  it('rejects negative movementDurationMs', () => {
    const config = { ...DEFAULT_PET_CONFIG, movementDurationMs: -100 };
    const result = validatePetConfig(config);
    expect(result.errors.some((e) => e.includes('movementDurationMs'))).toBe(true);
  });

  it('rejects invalid imagePath extension', () => {
    const config = { ...DEFAULT_PET_CONFIG, imagePath: '/path/to/file.mp4' };
    const result = validatePetConfig(config);
    expect(result.errors.some((e) => e.includes('imagePath'))).toBe(true);
    expect(result.data!.imagePath).toBe('');
  });

  it('accepts valid GIF imagePath', () => {
    const config = { ...DEFAULT_PET_CONFIG, imagePath: '/path/to/pet.gif' };
    const result = validatePetConfig(config);
    expect(result.valid).toBe(true);
    expect(result.data!.imagePath).toBe('/path/to/pet.gif');
  });

  it('accepts WebP imagePath', () => {
    const config = { ...DEFAULT_PET_CONFIG, imagePath: '/path/to/pet.webp' };
    const result = validatePetConfig(config);
    expect(result.valid).toBe(true);
  });
});

describe('validateReminderConfig', () => {
  it('rejects missing title', () => {
    const result = validateReminderConfig({
      id: '1',
      content: 'hello',
      enabled: true,
      scheduleType: 'interval',
      intervalMinutes: 60,
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('title'))).toBe(true);
  });

  it('rejects an interval shorter than one second', () => {
    const result = validateReminderConfig({
      id: '1',
      title: 'Test',
      content: 'hello',
      enabled: true,
      scheduleType: 'interval',
      intervalMinutes: 0,
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('intervalSeconds'))).toBe(true);
  });

  it('accepts a second-precision interval', () => {
    const result = validateReminderConfig({
      id: 'r-second',
      title: 'Stretch',
      content: 'Stand up',
      enabled: true,
      scheduleType: 'interval',
      intervalSeconds: 5,
    });
    expect(result.valid).toBe(true);
  });

  it('accepts valid interval reminder', () => {
    const result = validateReminderConfig({
      id: '1',
      title: 'Test',
      content: 'hello',
      enabled: true,
      scheduleType: 'interval',
      intervalMinutes: 30,
    });
    expect(result.valid).toBe(true);
  });
});

describe('isValidImagePath', () => {
  it('accepts GIF', () => expect(isValidImagePath('/path/pet.gif')).toBe(true));
  it('accepts WebP', () => expect(isValidImagePath('/path/pet.webp')).toBe(true));
  it('accepts PNG', () => expect(isValidImagePath('/path/pet.png')).toBe(true));
  it('accepts uppercase extension', () => expect(isValidImagePath('/path/pet.GIF')).toBe(true));
  it('rejects MP4', () => expect(isValidImagePath('/path/video.mp4')).toBe(false));
  it('accepts empty string', () => expect(isValidImagePath('')).toBe(true));
});
