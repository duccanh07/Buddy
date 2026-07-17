import type { MonitorInfo, WorkArea } from '../../shared/types';

/**
 * Find the monitor that contains the largest portion of the pet window.
 * Returns the primary monitor if no overlap found.
 */
export function getCurrentMonitor(
  petX: number,
  petY: number,
  petWidth: number,
  petHeight: number,
  monitors: MonitorInfo[]
): MonitorInfo | null {
  if (monitors.length === 0) return null;

  let bestMonitor: MonitorInfo | null = null;
  let bestOverlap = -1;

  for (const monitor of monitors) {
    const physicalWidth = petWidth * monitor.scaleFactor;
    const physicalHeight = petHeight * monitor.scaleFactor;
    const overlap = computeOverlap(
      petX,
      petY,
      physicalWidth,
      physicalHeight,
      monitor.x,
      monitor.y,
      monitor.width,
      monitor.height
    );
    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      bestMonitor = monitor;
    }
  }

  // Never guess a monitor for movement. Falling back to primary here makes
  // the next clamp teleport a pet from an external/negative-coordinate screen
  // directly to a primary-screen corner.
  if (bestOverlap <= 0) {
    return null;
  }

  return bestMonitor;
}

/**
 * Compute intersection area between two rectangles.
 */
function computeOverlap(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number
): number {
  const left = Math.max(ax, bx);
  const right = Math.min(ax + aw, bx + bw);
  const top = Math.max(ay, by);
  const bottom = Math.min(ay + ah, by + bh);

  if (right <= left || bottom <= top) return 0;
  return (right - left) * (bottom - top);
}

/**
 * Get the work area for a given monitor.
 */
export function getWorkArea(monitor: MonitorInfo): WorkArea {
  return {
    x: monitor.workX,
    y: monitor.workY,
    width: monitor.workWidth,
    height: monitor.workHeight,
  };
}

/**
 * Get the primary monitor's work area.
 */
export function getPrimaryWorkArea(monitors: MonitorInfo[]): WorkArea | null {
  const primary = monitors.find((m) => m.isPrimary) ?? monitors[0];
  if (!primary) return null;
  return getWorkArea(primary);
}

/**
 * Check if a position is valid (within any available monitor).
 */
export function isPositionOnAnyMonitor(
  x: number,
  y: number,
  monitors: MonitorInfo[]
): boolean {
  return monitors.some(
    (m) =>
      x >= m.x &&
      x <= m.x + m.width &&
      y >= m.y &&
      y <= m.y + m.height
  );
}

/** A pet anchor may be slightly outside an edge while the character remains visible. */
export function isPetVisibleOnAnyMonitor(
  x: number,
  y: number,
  petWidth: number,
  petHeight: number,
  monitors: MonitorInfo[]
): boolean {
  return monitors.some((monitor) =>
    computeOverlap(
      x,
      y,
      petWidth * monitor.scaleFactor,
      petHeight * monitor.scaleFactor,
      monitor.x,
      monitor.y,
      monitor.width,
      monitor.height
    ) > 0
  );
}

/** Find the monitor whose bounds contain the given physical desktop point. */
export function getMonitorContainingPoint(
  x: number,
  y: number,
  monitors: MonitorInfo[]
): MonitorInfo | null {
  if (monitors.length === 0) return null;
  const hit = monitors.find(
    (m) =>
      x >= m.x &&
      x < m.x + m.width &&
      y >= m.y &&
      y < m.y + m.height
  );
  return hit ?? null;
}

/**
 * Bottom-right of a monitor's work area (physical pixels), with edge padding.
 */
export function getBottomRightPosition(
  monitor: MonitorInfo,
  petWidth: number,
  petHeight: number
): { x: number; y: number } {
  const physicalPetWidth = petWidth * monitor.scaleFactor;
  const physicalPetHeight = petHeight * monitor.scaleFactor;
  const edgePadding = Math.round(16 * monitor.scaleFactor);
  const rightX =
    monitor.workX + monitor.workWidth - physicalPetWidth - edgePadding;
  const bottomY =
    monitor.workY + monitor.workHeight - physicalPetHeight - edgePadding;
  return { x: rightX, y: bottomY };
}

/**
 * Spawn / reset position: bottom-right of the monitor under the cursor when
 * known, otherwise bottom-right of the primary monitor.
 */
export function getDefaultPosition(
  monitors: MonitorInfo[],
  petWidth: number,
  petHeight: number,
  cursor?: { x: number; y: number } | null
): { x: number; y: number } {
  if (monitors.length === 0) return { x: 100, y: 100 };

  const cursorMonitor =
    cursor != null ? getMonitorContainingPoint(cursor.x, cursor.y, monitors) : null;
  const target =
    cursorMonitor ?? monitors.find((m) => m.isPrimary) ?? monitors[0];

  return getBottomRightPosition(target, petWidth, petHeight);
}

/**
 * Keep the pet fully inside the work area of the monitor that currently
 * contains the largest portion of its bounds. Prevents off-screen "disappear".
 */
export function clampPetToWorkArea(
  x: number,
  y: number,
  petWidth: number,
  petHeight: number,
  monitors: MonitorInfo[]
): { x: number; y: number } {
  const monitor = getCurrentMonitor(x, y, petWidth, petHeight, monitors);
  if (!monitor) {
    return getDefaultPosition(monitors, petWidth, petHeight);
  }

  const work = getWorkArea(monitor);
  const physicalWidth = petWidth * monitor.scaleFactor;
  const physicalHeight = petHeight * monitor.scaleFactor;
  const maxX = work.x + work.width - physicalWidth;
  const maxY = work.y + work.height - physicalHeight;

  return {
    x: Math.round(Math.min(Math.max(x, work.x), Math.max(work.x, maxX))),
    y: Math.round(Math.min(Math.max(y, work.y), Math.max(work.y, maxY))),
  };
}

/** Resolve a persisted pet anchor without treating valid negative monitor coordinates as invalid. */
export function resolveInitialPetPosition(
  persisted: { x: number; y: number } | null,
  legacy: { x: number; y: number } | null,
  monitors: MonitorInfo[],
  petWidth: number,
  petHeight: number
): { x: number; y: number } {
  const requested = persisted ?? legacy;
  if (requested && isPetVisibleOnAnyMonitor(
    requested.x,
    requested.y,
    petWidth,
    petHeight,
    monitors
  )) {
    return { x: Math.round(requested.x), y: Math.round(requested.y) };
  }
  return getDefaultPosition(monitors, petWidth, petHeight);
}

/**
 * Choose the pet start anchor for a webview mount.
 *
 * - Remount / HMR (Rust already has an anchor after drag): keep it — this is
 *   how "kéo tới đâu thì nhớ ở đó" survives StrictMode without teleporting.
 * - Cold start: always spawn at `spawnPosition` (bottom-right of the monitor
 *   under the cursor). Disk persistence is only used as a fallback when no
 *   spawn position is provided.
 */
export function resolveStartupPetPosition(
  rustAnchorInitialized: boolean,
  rustAnchor: { x: number; y: number } | null,
  persisted: { x: number; y: number } | null,
  legacy: { x: number; y: number } | null,
  monitors: MonitorInfo[],
  petWidth: number,
  petHeight: number,
  spawnPosition?: { x: number; y: number } | null
): { x: number; y: number; applyNativeMove: boolean } {
  if (rustAnchorInitialized && rustAnchor) {
    return {
      x: Math.round(rustAnchor.x),
      y: Math.round(rustAnchor.y),
      applyNativeMove: false,
    };
  }
  if (spawnPosition) {
    return {
      x: Math.round(spawnPosition.x),
      y: Math.round(spawnPosition.y),
      applyNativeMove: true,
    };
  }
  const resolved = resolveInitialPetPosition(
    persisted,
    legacy,
    monitors,
    petWidth,
    petHeight
  );
  return { ...resolved, applyNativeMove: true };
}
