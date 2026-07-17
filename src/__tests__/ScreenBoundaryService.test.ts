import { describe, it, expect } from 'vitest';
import {
  getCurrentMonitor,
  getWorkArea,
  getPrimaryWorkArea,
  isPositionOnAnyMonitor,
  getDefaultPosition,
  getBottomRightPosition,
  getMonitorContainingPoint,
  resolveInitialPetPosition,
  clampPetToWorkArea,
  resolveStartupPetPosition,
  isPetVisibleOnAnyMonitor,
} from '../pet/services/ScreenBoundaryService';
import type { MonitorInfo } from '../shared/types';

const PRIMARY_MONITOR: MonitorInfo = {
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
};

const SECONDARY_MONITOR: MonitorInfo = {
  name: 'Secondary',
  x: 1920,
  y: 0,
  width: 1920,
  height: 1080,
  scaleFactor: 1,
  workX: 1920,
  workY: 0,
  workWidth: 1920,
  workHeight: 1040,
  isPrimary: false,
};

const MONITORS = [PRIMARY_MONITOR, SECONDARY_MONITOR];

describe('ScreenBoundaryService', () => {
  it('returns primary monitor when pet is on primary screen', () => {
    const monitor = getCurrentMonitor(100, 100, 150, 150, MONITORS);
    expect(monitor?.name).toBe('Primary');
  });

  it('returns secondary monitor when pet is on secondary screen', () => {
    const monitor = getCurrentMonitor(2100, 100, 150, 150, MONITORS);
    expect(monitor?.name).toBe('Secondary');
  });

  it('returns null when pet is off all screens', () => {
    const monitor = getCurrentMonitor(-1000, -1000, 150, 150, MONITORS);
    expect(monitor).toBeNull();
  });

  it('returns work area for a monitor', () => {
    expect(getWorkArea(PRIMARY_MONITOR)).toEqual({
      x: 0,
      y: 0,
      width: 1920,
      height: 1040,
    });
  });

  it('returns primary work area from a list', () => {
    expect(getPrimaryWorkArea(MONITORS)).toEqual({
      x: 0,
      y: 0,
      width: 1920,
      height: 1040,
    });
  });

  it('detects whether a point is on any monitor', () => {
    expect(isPositionOnAnyMonitor(100, 100, MONITORS)).toBe(true);
    expect(isPositionOnAnyMonitor(2100, 100, MONITORS)).toBe(true);
    expect(isPositionOnAnyMonitor(-500, 100, MONITORS)).toBe(false);
    expect(isPositionOnAnyMonitor(5000, 100, MONITORS)).toBe(false);
  });

  it('calculates default position at bottom-right of primary monitor', () => {
    const pos = getDefaultPosition([PRIMARY_MONITOR], 150, 150);
    expect(pos.x).toBe(1920 - 150 - 16);
    expect(pos.y).toBe(1040 - 150 - 16);
  });

  it('spawns on the monitor under the cursor, bottom-right', () => {
    const pos = getDefaultPosition(MONITORS, 150, 150, { x: 2000, y: 400 });
    expect(pos).toEqual(getBottomRightPosition(SECONDARY_MONITOR, 150, 150));
    expect(pos.x).toBe(1920 + 1920 - 150 - 16);
  });

  it('finds the monitor containing a desktop point', () => {
    expect(getMonitorContainingPoint(100, 100, MONITORS)?.name).toBe('Primary');
    expect(getMonitorContainingPoint(2000, 100, MONITORS)?.name).toBe('Secondary');
    expect(getMonitorContainingPoint(-50, 100, MONITORS)).toBeNull();
  });

  it('handles missing monitors gracefully', () => {
    const pos = getDefaultPosition([], 150, 150);
    expect(pos.x).toBe(100);
    expect(pos.y).toBe(100);
  });

  it('uses physical pet dimensions on a Retina monitor', () => {
    const retinaMonitor = { ...PRIMARY_MONITOR, scaleFactor: 2 };
    const pos = getDefaultPosition([retinaMonitor], 150, 150);

    expect(pos.x).toBe(1920 - 300 - 32);
    expect(pos.y).toBe(1040 - 300 - 32);
  });

  it('restores a persisted position on a monitor with negative coordinates', () => {
    const upperMonitor: MonitorInfo = {
      ...SECONDARY_MONITOR,
      x: 0,
      y: -1080,
      workX: 0,
      workY: -1080,
    };

    expect(resolveInitialPetPosition({ x: 291, y: -522 }, null, [PRIMARY_MONITOR, upperMonitor], 150, 150))
      .toEqual({ x: 291, y: -522 });
  });

  it('prefers the dedicated persisted position over legacy config coordinates', () => {
    expect(resolveInitialPetPosition(
      { x: 420, y: 260 },
      { x: 100, y: 100 },
      MONITORS,
      150,
      150
    )).toEqual({ x: 420, y: 260 });
  });

  it('preserves a partially off-screen anchor while the pet remains visible', () => {
    expect(isPetVisibleOnAnyMonitor(-32, 126, 150, 150, [PRIMARY_MONITOR])).toBe(true);
    expect(resolveInitialPetPosition({ x: -32, y: 126 }, null, [PRIMARY_MONITOR], 150, 150))
      .toEqual({ x: -32, y: 126 });
  });

  it('picks monitor with maximum overlap', () => {
    const monitor = getCurrentMonitor(1850, 100, 200, 150, MONITORS);
    expect(monitor?.name).toBe('Secondary');
  });

  it('reuses the live Rust anchor on remount without moving the window', () => {
    expect(
      resolveStartupPetPosition(
        true,
        { x: 640, y: 360 },
        { x: 100, y: 100 },
        null,
        MONITORS,
        150,
        150,
        { x: 1754, y: 874 }
      )
    ).toEqual({ x: 640, y: 360, applyNativeMove: false });
  });

  it('uses cursor-monitor spawn on cold start instead of a stale disk position', () => {
    expect(
      resolveStartupPetPosition(
        false,
        null,
        { x: 420, y: 260 },
        null,
        MONITORS,
        150,
        150,
        { x: 1754, y: 874 }
      )
    ).toEqual({ x: 1754, y: 874, applyNativeMove: true });
  });

  it('clamps a partially out-of-bounds anchor into the monitor work area', () => {
    expect(clampPetToWorkArea(-40, 20, 150, 150, [PRIMARY_MONITOR])).toEqual({
      x: 0,
      y: 20,
    });
  });

  it('falls back to the default spawn when the pet has no monitor overlap', () => {
    expect(clampPetToWorkArea(5000, 5000, 150, 150, [PRIMARY_MONITOR])).toEqual(
      getDefaultPosition([PRIMARY_MONITOR], 150, 150)
    );
  });
});
