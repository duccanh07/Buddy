import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PetController } from '../pet/controllers/PetController';
import { createCodexManifest } from '../pet/animation/animationManifest';
import { DEFAULT_PET_CONFIG } from '../config/defaultConfig';
describe('PetController action rotation', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('cycles every manifest action even when automatic movement is disabled', () => {
    const onAnimationChange = vi.fn();
    const controller = new PetController(
      {
        ...DEFAULT_PET_CONFIG,
        autoMoveEnabled: false,
        movementIntervalMs: 0,
        spritesheetEnabled: true,
        spritesheetCols: 8,
        spritesheetRows: 11,
        animationManifest: createCodexManifest(192, 208, 11),
      },
      {
        onPositionChange: vi.fn(),
        onStateChange: vi.fn(),
        onDirectionChange: vi.fn(),
        onAnimationChange,
      }
    );

    controller.start(0, 0, []);
    for (let index = 0; index < 7; index += 1) {
      vi.advanceTimersByTime(2200);
    }

    expect(onAnimationChange.mock.calls.map(([key]) => key)).toEqual([
      'idle',
      'waving',
      'jumping',
      'failed',
      'waiting',
      'running',
      'review',
      'look-around',
    ]);
    controller.dispose();
  });

  it('starts the movement loop immediately when the moving phase begins', () => {
    const onPositionChange = vi.fn();
    const controller = new PetController(
      {
        ...DEFAULT_PET_CONFIG,
        autoMoveEnabled: true,
        movementIntervalMs: 0,
        movementDurationMs: 1000,
      },
      {
        onPositionChange,
        onStateChange: vi.fn(),
        onDirectionChange: vi.fn(),
        onAnimationChange: vi.fn(),
      }
    );

    controller.start(100, 100, [{
      name: 'Primary',
      x: 0,
      y: 0,
      width: 1920,
      height: 1080,
      scaleFactor: 1,
      workX: 0,
      workY: 0,
      workWidth: 1920,
      workHeight: 1040,
      isPrimary: true,
    }]);

    vi.advanceTimersByTime(2199);
    expect(onPositionChange).not.toHaveBeenCalled();

    // Moving phase starts at 2200ms; first RAF arms the clock, second emits.
    vi.advanceTimersByTime(1);
    vi.advanceTimersByTime(32);
    expect(onPositionChange).toHaveBeenCalled();
    controller.dispose();
  });

  it('keeps Y fixed when the movement loop starts from the current anchor', () => {
    const onPositionChange = vi.fn();
    const controller = new PetController(
      {
        ...DEFAULT_PET_CONFIG,
        autoMoveEnabled: true,
        movementIntervalMs: 0,
        movementDurationMs: 1000,
        movementSpeed: 0,
      },
      {
        onPositionChange,
        onStateChange: vi.fn(),
        onDirectionChange: vi.fn(),
        onAnimationChange: vi.fn(),
      }
    );

    controller.start(640, 360, [{
      name: 'Primary',
      x: 0,
      y: 0,
      width: 1920,
      height: 1080,
      scaleFactor: 1,
      workX: 0,
      workY: 0,
      workWidth: 1920,
      workHeight: 1040,
      isPrimary: true,
    }]);

    vi.advanceTimersByTime(2250);

    expect(controller.getCurrentPosition()).toEqual({ x: 640, y: 360 });
    expect(onPositionChange).toHaveBeenCalled();
    const [, firstY] = onPositionChange.mock.calls[0];
    expect(firstY).toBe(360);
    controller.dispose();
  });
});
