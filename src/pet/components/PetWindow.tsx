import React, { useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { usePetStore } from '../../store/petStore';
import type { PetState } from '../../shared/types';
import { usePetController } from '../hooks/usePetController';
import { usePetDrag } from '../hooks/usePetDrag';
import PetImage from './PetImage';
import SpeechBubble from './SpeechBubble';
import { useReminderScheduler } from '../../reminders/useReminderScheduler';

/**
 * PetWindow — the main pet display.
 *
 * Layer structure (important for transforms):
 *   .pet-window-root          → fills the transparent window
 *     .pet-drag-layer         → handles all pointer events for dragging
 *       .pet-flip-layer       → stable render layer; renderer handles mirroring
 *         PetImage            → actual image, no pointer events
 *     SpeechBubble            → positioned absolutely outside the flip layer
 */
const PetWindow: React.FC = () => {
  const config = usePetStore((state) => state.config);
  const petState = usePetStore((state) => state.petState) as PetState;
  const direction = usePetStore((state) => state.direction);
  const activeAnimationKey = usePetStore((state) => state.activeAnimationKey);
  const activeBubble = usePetStore((state) => state.activeBubble);
  const hideBubble = usePetStore((state) => state.hideBubble);
  const bubblePlacement = usePetStore((state) => state.bubblePlacement);
  const isConfigLoaded = usePetStore((state) => state.isConfigLoaded);
  useReminderScheduler(isConfigLoaded);

  // Apply Theme
  React.useEffect(() => {
    const theme = config.theme || 'system';
    const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    
    if (isDark) {
      document.body.classList.remove('theme-light');
    } else {
      document.body.classList.add('theme-light');
    }
  }, [config.theme]);

  // Initialize controller — starts the RAF loop and Tauri event subscriptions
  const {
    notifyDragStart,
    notifyDragDirection,
    notifyDragEnd,
    notifyHoverStart,
    notifyHoverEnd,
  } = usePetController();

  // Drag handlers
  const dragHandlers = usePetDrag({
    onDragStart: notifyDragStart,
    onDragDirection: notifyDragDirection,
    onDragEnd: notifyDragEnd,
  });

  const handlePointerEnter = useCallback(() => {
    notifyHoverStart();
  }, [notifyHoverStart]);

  const handlePointerLeave = useCallback(() => {
    notifyHoverEnd();
  }, [notifyHoverEnd]);

  const handleCloseBubble = useCallback(() => {
    hideBubble();
    void invoke('set_pet_bubble_layout', {
      visible: false,
      petWidth: config.width,
      petHeight: config.height,
      scalePercent: config.reminderBubbleScale ?? 100,
    }).catch((error) => {
      console.error('[PetWindow] Could not collapse message layout:', error);
    });
  }, [config.height, config.reminderBubbleScale, config.width, hideBubble]);



  const isDragging = petState === 'dragging';
  const hasBubble = activeBubble !== null && !isDragging;

  // When bubble is visible, the native window is expanded.
  // The pet drag layer must only cover the pet area, not the bubble area.
  // bubble-above: window expands UP → pet is at the bottom of the window
  // bubble-below: window expands DOWN → pet is at the top of the window
  const dragLayerStyle: React.CSSProperties = hasBubble
    ? {
        position: 'absolute',
        ...(bubblePlacement === 'above'
          ? { bottom: 0, top: 'auto' }
          : { top: 0, bottom: 'auto' }),
        left: 0,
        width: config.width,
        height: config.height,
        cursor: isDragging ? 'grabbing' : 'grab',
      }
    : {
        cursor: isDragging ? 'grabbing' : 'grab',
      };

  // Stay fully transparent while loading — a dashed/emoji placeholder reads as
  // an ugly chrome box on an otherwise invisible overlay window.
  if (!isConfigLoaded) {
    return <div className="pet-window-root" style={{ width: '100%', height: '100%' }} />;
  }

  return (
    <div
      className={`pet-window-root pet-window-root--bubble-${bubblePlacement}`}
      style={{
        width: '100%',
        height: '100%',
        '--bubble-scale': (config.reminderBubbleScale ?? 100) / 100,
      } as React.CSSProperties}
    >
      {/* Drag + hover interaction layer — covers only the pet area */}
      <div
        className={`pet-drag-layer pet-drag-layer--${petState}`}
        style={dragLayerStyle}
        {...dragHandlers}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
      >
        {/* Stable render layer — never recreated when animation state changes. */}
        <div
          className="pet-flip-layer"
          aria-hidden="true"
        >
          <PetImage
            imagePath={config.imagePath}
            width={config.width}
            height={config.height}
            alt="Your pet"
            animationKey={isDragging
              ? (direction === -1 ? 'running-left' : 'running-right')
              : (activeAnimationKey ?? undefined)}
          />
        </div>
      </div>

      {/* Speech bubble — outside flip layer, positioned relative to root */}
      {activeBubble && !isDragging && (
        <SpeechBubble
          key={activeBubble.instanceId ?? activeBubble.message}
          bubble={activeBubble}
          onClose={handleCloseBubble}
        />
      )}
    </div>
  );
};

export default PetWindow;
