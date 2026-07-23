import React, { useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { exit } from '@tauri-apps/plugin-process';
import { EyeOff, Settings, X } from 'lucide-react';

interface PetContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
}

const PetContextMenu: React.FC<PetContextMenuProps> = ({ x, y, onClose }) => {
  const menuRef = useRef<HTMLDivElement>(null);

  // Clamp position so menu stays within the window viewport
  const clampedX = Math.min(x, window.innerWidth - 192);
  const clampedY = Math.min(y, window.innerHeight - 140);

  // Close on any outside pointer event
  useEffect(() => {
    const handleOutside = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Capture phase so we always get the event before drag logic
    window.addEventListener('pointerdown', handleOutside, { capture: true });
    return () => window.removeEventListener('pointerdown', handleOutside, { capture: true });
  }, [onClose]);

  // Close on Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleShowSettings = useCallback(async () => {
    onClose();
    try {
      await invoke('show_settings_window');
    } catch (e) {
      console.error('[PetContextMenu] Failed to open settings:', e);
    }
  }, [onClose]);

  const handleHidePet = useCallback(async () => {
    onClose();
    try {
      await invoke('hide_pet_window');
    } catch (e) {
      console.error('[PetContextMenu] Failed to hide pet:', e);
    }
  }, [onClose]);

  const handleExit = useCallback(async () => {
    onClose();
    try {
      await exit(0);
    } catch (e) {
      console.error('[PetContextMenu] Failed to exit:', e);
    }
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="pet-context-menu"
      style={{ left: clampedX, top: clampedY }}
      // Prevent right-click inside menu from propagating
      onContextMenu={(e) => e.preventDefault()}
      // Prevent drag system from picking up pointer events inside menu
      onPointerDown={(e) => e.stopPropagation()}
    >
      <button
        className="pet-context-menu__item"
        onClick={handleShowSettings}
        title="Open Settings"
      >
        <Settings size={14} />
        <span>Settings</span>
      </button>

      <button
        className="pet-context-menu__item"
        onClick={handleHidePet}
        title="Hide Pet"
      >
        <EyeOff size={14} />
        <span>Hide Pet</span>
      </button>

      <div className="pet-context-menu__separator" />

      <button
        className="pet-context-menu__item pet-context-menu__item--danger"
        onClick={handleExit}
        title="Close Buddy"
      >
        <X size={14} />
        <span>Close Buddy</span>
      </button>
    </div>
  );
};

export default PetContextMenu;
