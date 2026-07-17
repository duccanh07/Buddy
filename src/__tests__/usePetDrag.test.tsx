import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const nativeWindow = vi.hoisted(() => ({
  startDragging: vi.fn<() => Promise<void>>(),
}));

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => nativeWindow,
}));

import { usePetDrag } from '../pet/hooks/usePetDrag';
import type { Direction } from '../shared/types';

interface HarnessProps {
  onStart: () => void | Promise<void>;
  onDirection: (direction: Direction) => void;
  onEnd: () => void;
}

const DragHarness: React.FC<HarnessProps> = ({ onStart, onDirection, onEnd }) => {
  const handlers = usePetDrag({
    onDragStart: onStart,
    onDragDirection: onDirection,
    onDragEnd: onEnd,
  });
  return <div data-testid="pet-drag-target" {...handlers} />;
};

describe('usePetDrag', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'PointerEvent', {
      configurable: true,
      value: MouseEvent,
    });
    nativeWindow.startDragging.mockReset();
  });

  it('starts native dragging and running direction after the movement threshold', async () => {
    nativeWindow.startDragging.mockResolvedValue(undefined);
    const onStart = vi.fn();
    const onDirection = vi.fn();
    const onEnd = vi.fn();
    render(<DragHarness onStart={onStart} onDirection={onDirection} onEnd={onEnd} />);

    const target = screen.getByTestId('pet-drag-target');
    fireEvent.pointerDown(target, { button: 0, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(target, { clientX: 110, clientY: 101 });

    expect(onDirection).toHaveBeenCalledWith(1);
    expect(onStart).toHaveBeenCalledOnce();
    await waitFor(() => expect(nativeWindow.startDragging).toHaveBeenCalledOnce());
    await waitFor(() => expect(onEnd).toHaveBeenCalledOnce());
    expect(onEnd).toHaveBeenCalledWith();
  });

  it('signals drag end exactly once even when the native drag loop rejects', async () => {
    nativeWindow.startDragging.mockRejectedValue(new Error('drag failed'));
    const onEnd = vi.fn();
    render(
      <DragHarness onStart={vi.fn()} onDirection={vi.fn()} onEnd={onEnd} />
    );

    const target = screen.getByTestId('pet-drag-target');
    fireEvent.pointerDown(target, { button: 0, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(target, { clientX: 20, clientY: 0 });

    await waitFor(() => expect(onEnd).toHaveBeenCalledOnce());
  });

  it('does not enter dragging state for a normal click', () => {
    const onStart = vi.fn();
    const onDirection = vi.fn();
    const onEnd = vi.fn();
    render(<DragHarness onStart={onStart} onDirection={onDirection} onEnd={onEnd} />);

    const target = screen.getByTestId('pet-drag-target');
    fireEvent.pointerDown(target, { button: 0, clientX: 100, clientY: 100 });
    fireEvent.pointerUp(target, { button: 0, clientX: 100, clientY: 100 });

    expect(onStart).not.toHaveBeenCalled();
    expect(nativeWindow.startDragging).not.toHaveBeenCalled();
  });

  it('waits for reminder hiding before entering the native drag loop', async () => {
    let finishPreparation: (() => void) | undefined;
    const preparation = new Promise<void>((resolve) => {
      finishPreparation = resolve;
    });
    nativeWindow.startDragging.mockResolvedValue(undefined);
    const onStart = vi.fn(() => preparation);
    render(<DragHarness onStart={onStart} onDirection={vi.fn()} onEnd={vi.fn()} />);

    const target = screen.getByTestId('pet-drag-target');
    fireEvent.pointerDown(target, { button: 0, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(target, { clientX: 20, clientY: 10 });

    await waitFor(() => expect(onStart).toHaveBeenCalledOnce());
    expect(nativeWindow.startDragging).not.toHaveBeenCalled();
    finishPreparation?.();
    await waitFor(() => expect(nativeWindow.startDragging).toHaveBeenCalledOnce());
  });
});
