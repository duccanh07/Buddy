export class BuddyError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'BuddyError';
  }
}

export class ConfigError extends BuddyError {
  constructor(message: string, cause?: unknown) {
    super(message, 'CONFIG_ERROR', cause);
    this.name = 'ConfigError';
  }
}

export class MovementError extends BuddyError {
  constructor(message: string, cause?: unknown) {
    super(message, 'MOVEMENT_ERROR', cause);
    this.name = 'MovementError';
  }
}

export class ReminderError extends BuddyError {
  constructor(message: string, cause?: unknown) {
    super(message, 'REMINDER_ERROR', cause);
    this.name = 'ReminderError';
  }
}

export class ImageError extends BuddyError {
  constructor(message: string, cause?: unknown) {
    super(message, 'IMAGE_ERROR', cause);
    this.name = 'ImageError';
  }
}

export function isError(value: unknown): value is Error {
  return value instanceof Error;
}

export function toErrorMessage(value: unknown): string {
  if (isError(value)) return value.message;
  if (typeof value === 'string') return value;
  return 'An unknown error occurred';
}
