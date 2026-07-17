import type { Direction, WorkArea } from '../../shared/types';

/**
 * Calculate new X position using delta-time for frame-rate independence.
 *
 * @param currentX  - current window X position in pixels
 * @param direction - -1 (left) or 1 (right)
 * @param speed     - movement speed in pixels per second
 * @param deltaTime - time elapsed since last frame in SECONDS
 * @returns new X position
 */
export function calculateNewX(
  currentX: number,
  direction: Direction,
  speed: number,
  deltaTime: number
): number {
  return currentX + direction * speed * deltaTime;
}

/**
 * Clamp X position so the pet stays within the work area.
 *
 * @param x        - candidate X position
 * @param workArea - available work area
 * @param petWidth - width of the pet window in pixels
 * @returns clamped X position
 */
export function clampX(x: number, workArea: WorkArea, petWidth: number): number {
  const minX = workArea.x;
  const maxX = workArea.x + workArea.width - petWidth;
  return Math.max(minX, Math.min(x, maxX));
}

/**
 * Determine if pet has hit or gone past the LEFT boundary.
 */
export function hitLeftBoundary(x: number, workArea: WorkArea): boolean {
  return x <= workArea.x;
}

/**
 * Determine if pet has hit or gone past the RIGHT boundary.
 */
export function hitRightBoundary(
  x: number,
  workArea: WorkArea,
  petWidth: number
): boolean {
  return x + petWidth >= workArea.x + workArea.width;
}

/**
 * Full movement step: move, check boundaries, clamp.
 * Returns the new position and direction (may be reversed on boundary hit).
 */
export function moveStep(
  currentX: number,
  direction: Direction,
  speed: number,
  deltaTime: number,
  workArea: WorkArea,
  petWidth: number
): { newX: number; newDirection: Direction; hitBoundary: boolean } {
  const rawX = calculateNewX(currentX, direction, speed, deltaTime);
  let newDirection: Direction = direction;
  let hitBoundary = false;

  if (hitLeftBoundary(rawX, workArea)) {
    newDirection = 1;
    hitBoundary = true;
  } else if (hitRightBoundary(rawX, workArea, petWidth)) {
    newDirection = -1;
    hitBoundary = true;
  }

  const newX = clampX(rawX, workArea, petWidth);

  return { newX, newDirection, hitBoundary };
}
