import { useCallback, useRef } from 'react';
import { flushSync } from 'react-dom';
import { getCurrentWindow } from '@tauri-apps/api/window';
import type { Direction } from '../../shared/types';

const DRAG_THRESHOLD = 3;

interface UsePetDragOptions {
  onDragStart: () => void | Promise<void>;
  onDragDirection: (direction: Direction) => void;
  /**
   * Called once the OS drag loop has ended. Emits no coordinates — the
   * controller must ask Rust for the authoritative anchor because the
   * native window position is only equal to the anchor when the bubble
   * offset is zero. Passing `outerPosition()` here caused the pet to
   * "jump" whenever the composite window was larger than the pet.
   */
  onDragEnd: () => void;
}

interface DragState {
  isPointerDown: boolean;
  nativeDragStarted: boolean;
  startPointerX: number;
  startPointerY: number;
}

/**
 * Uses the OS-native window drag loop. The window stays locked to the cursor,
 * avoiding the latency and out-of-order updates caused by per-frame IPC moves.
 */
export function usePetDrag({ onDragStart, onDragDirection, onDragEnd }: UsePetDragOptions) {
  const dragStateRef = useRef<DragState>({
    isPointerDown: false,
    nativeDragStarted: false,
    startPointerX: 0,
    startPointerY: 0,
  });

  const beginNativeDrag = useCallback(async () => {
    const appWindow = getCurrentWindow();
    try {
      // This call enters the platform drag loop and resolves after mouse release.
      await appWindow.startDragging();
    } catch (error) {
      console.error('[usePetDrag] Native window drag failed:', error);
    } finally {
      dragStateRef.current.isPointerDown = false;
      dragStateRef.current.nativeDragStarted = false;
      onDragEnd();
    }
  }, [onDragEnd]);

  const onPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    dragStateRef.current = {
      isPointerDown: true,
      nativeDragStarted: false,
      startPointerX: event.clientX,
      startPointerY: event.clientY,
    };
  }, []);

  const onPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const state = dragStateRef.current;
    if (!state.isPointerDown || state.nativeDragStarted) return;

    const deltaX = event.clientX - state.startPointerX;
    const deltaY = event.clientY - state.startPointerY;
    if (Math.hypot(deltaX, deltaY) < DRAG_THRESHOLD) return;

    state.nativeDragStarted = true;

    // Commit the running state synchronously, then give PetImage one RAF to
    // draw its first running frame before the native OS drag loop begins.
    let dragPreparation: void | Promise<void>;
    flushSync(() => {
      onDragDirection(deltaX < 0 ? -1 : 1);
      dragPreparation = onDragStart();
    });
    requestAnimationFrame(() => {
      // Hiding the reminder changes native window ordering on macOS. Wait for
      // that operation before entering the OS drag loop to avoid a focus race
      // that can make the pet stutter or refuse to follow the pointer.
      void Promise.resolve(dragPreparation).then(() => beginNativeDrag());
    });
  }, [beginNativeDrag, onDragDirection, onDragStart]);

  const onPointerUp = useCallback(() => {
    const state = dragStateRef.current;
    if (!state.nativeDragStarted) state.isPointerDown = false;
  }, []);

  const onPointerCancel = useCallback(() => {
    const state = dragStateRef.current;
    if (!state.nativeDragStarted) state.isPointerDown = false;
  }, []);

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel };
}
