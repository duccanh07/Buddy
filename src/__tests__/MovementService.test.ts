import { describe, it, expect } from 'vitest';
import {
  calculateNewX,
  clampX,
  hitLeftBoundary,
  hitRightBoundary,
  moveStep,
} from '../pet/services/MovementService';
import type { WorkArea } from '../shared/types';

const WORK_AREA: WorkArea = { x: 0, y: 0, width: 1920, height: 1040 };
const PET_WIDTH = 150;
const SPEED = 80; // px/s

describe('MovementService', () => {
  // Test 1: Pet moves correctly by speed * deltaTime
  it('calculates new X correctly with positive direction', () => {
    const newX = calculateNewX(100, 1, SPEED, 1.0);
    expect(newX).toBe(180); // 100 + 1 * 80 * 1.0
  });

  it('calculates new X correctly with negative direction', () => {
    const newX = calculateNewX(200, -1, SPEED, 0.5);
    expect(newX).toBe(160); // 200 + (-1) * 80 * 0.5
  });

  it('calculates position proportionally to delta time', () => {
    // At 60fps, deltaTime ≈ 0.0167s
    const newX60fps = calculateNewX(100, 1, SPEED, 1 / 60);
    // At 30fps, deltaTime ≈ 0.0333s — should move 2x distance
    const newX30fps = calculateNewX(100, 1, SPEED, 1 / 30);
    expect(newX30fps - 100).toBeCloseTo((newX60fps - 100) * 2, 1);
  });

  // Test 2: Pet reverses direction when hitting right boundary
  it('reverses direction when hitting right boundary', () => {
    const nearRightEdge = WORK_AREA.width - PET_WIDTH - 1;
    const { newDirection, hitBoundary } = moveStep(
      nearRightEdge,
      1,
      SPEED,
      1.0,
      WORK_AREA,
      PET_WIDTH
    );
    expect(hitBoundary).toBe(true);
    expect(newDirection).toBe(-1);
  });

  // Test 3: Pet reverses direction when hitting left boundary
  it('reverses direction when hitting left boundary', () => {
    const nearLeftEdge = 5;
    const { newDirection, hitBoundary } = moveStep(
      nearLeftEdge,
      -1,
      SPEED,
      1.0,
      WORK_AREA,
      PET_WIDTH
    );
    expect(hitBoundary).toBe(true);
    expect(newDirection).toBe(1);
  });

  // Test 4: Pet does not run outside work area
  it('clamps X to work area left boundary', () => {
    const clamped = clampX(-100, WORK_AREA, PET_WIDTH);
    expect(clamped).toBe(WORK_AREA.x);
  });

  it('clamps X to work area right boundary', () => {
    const clamped = clampX(2000, WORK_AREA, PET_WIDTH);
    expect(clamped).toBe(WORK_AREA.width - PET_WIDTH);
  });

  it('does not clamp X within valid range', () => {
    const x = 500;
    const clamped = clampX(x, WORK_AREA, PET_WIDTH);
    expect(clamped).toBe(x);
  });

  it('detects left boundary correctly', () => {
    expect(hitLeftBoundary(0, WORK_AREA)).toBe(true);
    expect(hitLeftBoundary(-5, WORK_AREA)).toBe(true);
    expect(hitLeftBoundary(1, WORK_AREA)).toBe(false);
  });

  it('detects right boundary correctly', () => {
    const atEdge = WORK_AREA.width - PET_WIDTH;
    expect(hitRightBoundary(atEdge, WORK_AREA, PET_WIDTH)).toBe(true);
    expect(hitRightBoundary(atEdge + 1, WORK_AREA, PET_WIDTH)).toBe(true);
    expect(hitRightBoundary(atEdge - 1, WORK_AREA, PET_WIDTH)).toBe(false);
  });

  it('full moveStep returns correct position and direction at right edge', () => {
    const startX = WORK_AREA.width - PET_WIDTH - 1;
    const { newX, newDirection } = moveStep(startX, 1, SPEED, 1.0, WORK_AREA, PET_WIDTH);
    expect(newX).toBe(WORK_AREA.width - PET_WIDTH);
    expect(newDirection).toBe(-1);
  });
});
