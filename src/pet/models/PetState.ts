import type { PetState, Direction } from '../../shared/types';

/**
 * Valid state transitions for the pet state machine.
 * Key: current state → Value: allowed next states
 */
export const STATE_TRANSITIONS: Record<PetState, PetState[]> = {
  idle: ['walking-left', 'walking-right', 'running-left', 'running-right', 'dragging', 'hovering', 'sleeping', 'special', 'showing-reminder'],
  'walking-left': ['idle', 'running-left', 'dragging', 'hovering', 'showing-reminder'],
  'walking-right': ['idle', 'running-right', 'dragging', 'hovering', 'showing-reminder'],
  'running-left': ['idle', 'walking-left', 'dragging', 'hovering', 'showing-reminder'],
  'running-right': ['idle', 'walking-right', 'dragging', 'hovering', 'showing-reminder'],
  dragging: ['idle'],
  hovering: ['idle', 'walking-left', 'walking-right', 'running-left', 'running-right', 'dragging', 'showing-reminder'],
  sleeping: ['idle', 'dragging'],
  special: ['idle', 'dragging'],
  'showing-reminder': ['idle', 'walking-left', 'walking-right', 'running-left', 'running-right'],
};

export function isWalking(state: PetState): boolean {
  return state === 'walking-left' || state === 'walking-right' || state === 'running-left' || state === 'running-right';
}

export function directionFromState(state: PetState): Direction | null {
  if (state === 'walking-left' || state === 'running-left') return -1;
  if (state === 'walking-right' || state === 'running-right') return 1;
  return null;
}

export function stateFromDirection(direction: Direction): PetState {
  return direction === -1 ? 'walking-left' : 'walking-right';
}

export function stateFromDirectionAndType(direction: Direction, isRunning: boolean): PetState {
  if (isRunning) {
    return direction === -1 ? 'running-left' : 'running-right';
  }
  return direction === -1 ? 'walking-left' : 'walking-right';
}

export function canTransition(from: PetState, to: PetState): boolean {
  return STATE_TRANSITIONS[from].includes(to);
}
