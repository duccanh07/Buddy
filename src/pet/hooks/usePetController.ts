import { useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { PetController } from '../controllers/PetController';
import { usePetStore } from '../../store/petStore';
import { petConfigService } from '../../config/PetConfigService';
import { EVENTS } from '../../shared/events';
import type { PetConfig, PetState, Direction, MonitorInfo } from '../../shared/types';
import {
  clampPetToWorkArea,
  getDefaultPosition,
  resolveStartupPetPosition,
} from '../services/ScreenBoundaryService';

interface PersistedPetPosition {
  x: number;
  y: number;
}

/**
 * usePetController bridges PetController (plain class) with React.
 * It owns the controller lifecycle and subscribes to Tauri events.
 */
export function usePetController() {
  const controllerRef = useRef<PetController | null>(null);
  const config = usePetStore((state) => state.config);
  const setConfig = usePetStore((state) => state.setConfig);
  const setPetState = usePetStore((state) => state.setPetState);
  const setActiveAnimationKey = usePetStore((state) => state.setActiveAnimationKey);
  const setPosition = usePetStore((state) => state.setPosition);
  const setDirection = usePetStore((state) => state.setDirection);
  const setMonitors = usePetStore((state) => state.setMonitors);
  const setConfigLoaded = usePetStore((state) => state.setConfigLoaded);
  const pendingWindowPositionRef = useRef<{ x: number; y: number } | null>(null);
  const isWindowMoveInFlightRef = useRef(false);
  const isDraggingRef = useRef(false);
  const positionEpochRef = useRef(0);

  const flushWindowPosition = useCallback(async () => {
    if (isWindowMoveInFlightRef.current) return;
    isWindowMoveInFlightRef.current = true;
    try {
      while (pendingWindowPositionRef.current) {
        if (isDraggingRef.current) {
          pendingWindowPositionRef.current = null;
          break;
        }
        const next = pendingWindowPositionRef.current;
        pendingWindowPositionRef.current = null;
        try {
          // Use full X+Y move so the Rust anchor stays in sync with the
          // controller's authoritative position. Using X-only (move_pet_window_x)
          // relied on Rust's stored anchor.y, which could be stale after
          // apply_pet_window_geometry runs (e.g. from set_pet_bubble_layout or
          // set_pet_window_size), causing the pet to jump vertically when
          // auto-move resumed. controller.y is always correct after onDragEnd.
          await invoke('move_pet_window', {
            x: next.x,
            y: next.y,
            epoch: positionEpochRef.current,
          });
        } catch {
          // Ignore transient errors while the native window is moving.
        }
      }
    } finally {
      isWindowMoveInFlightRef.current = false;
    }
  }, []);

  // ---- Callbacks for PetController ----

  const handlePositionChange = useCallback(
    (newX: number, newY: number) => {
      setPosition(newX, newY);
      // Keep at most one native move command in flight. Intermediate positions
      // are coalesced so late IPC responses cannot move the window backwards.
      pendingWindowPositionRef.current = { x: Math.round(newX), y: Math.round(newY) };
      void flushWindowPosition();
    },
    [flushWindowPosition, setPosition]
  );

  const handleStateChange = useCallback(
    (state: PetState) => {
      setPetState(state);
    },
    [setPetState]
  );

  const handleDirectionChange = useCallback(
    (dir: Direction) => {
      setDirection(dir);
    },
    [setDirection]
  );

  const handleAnimationChange = useCallback(
    (key: string | null) => setActiveAnimationKey(key),
    [setActiveAnimationKey]
  );

  // ---- Initialize controller ----

  useEffect(() => {
    const controller = new PetController(config, {
      onPositionChange: handlePositionChange,
      onStateChange: handleStateChange,
      onDirectionChange: handleDirectionChange,
      onAnimationChange: handleAnimationChange,
    });
    controllerRef.current = controller;

    // Load config and start
    let cancelled = false;

    async function initialize() {
      try {
        // Native state survives a webview reload in development. Sync the
        // epoch without calling set_pet_dragging(false) — that path must only
        // run after a real drag, or it falsely marks the default window
        // corner as an initialized anchor.
        positionEpochRef.current = await invoke<number>('get_pet_position_epoch');

        const savedConfig = await petConfigService.loadConfig();
        if (cancelled) return;

        setConfig(savedConfig);

        // Get monitors
        const monitors: MonitorInfo[] = await invoke('get_all_monitors');
        if (cancelled) return;
        setMonitors(monitors);

        // Resolve the start anchor BEFORE any bubble layout call. Layout used
        // to read outer_position and permanently mark that as initialized.
        const anchorInitialized = await invoke<boolean>('is_pet_anchor_initialized');
        let rustAnchor: PersistedPetPosition | null = null;
        if (anchorInitialized) {
          const [rustAnchorX, rustAnchorY] = await invoke<[number, number]>(
            'get_pet_window_position'
          );
          rustAnchor = { x: rustAnchorX, y: rustAnchorY };
        }

        // Cold start: bottom-right of the monitor under the mouse cursor.
        // Remount after drag keeps the live Rust anchor (see resolveStartup).
        let spawnPosition: PersistedPetPosition | null = null;
        if (!anchorInitialized) {
          let cursor: PersistedPetPosition | null = null;
          try {
            const [cx, cy] = await invoke<[number, number]>('get_cursor_position');
            cursor = { x: cx, y: cy };
          } catch (error) {
            console.error('[usePetController] Could not read cursor position:', error);
          }
          spawnPosition = getDefaultPosition(
            monitors,
            savedConfig.width,
            savedConfig.height,
            cursor
          );
        }

        const startPosition = resolveStartupPetPosition(
          anchorInitialized,
          rustAnchor,
          null,
          null,
          monitors,
          savedConfig.width,
          savedConfig.height,
          spawnPosition
        );
        const startX = startPosition.x;
        const startY = startPosition.y;

        // --- Resolve final clamped position first, before any window ops ---
        const clamped = clampPetToWorkArea(
          startX,
          startY,
          savedConfig.width,
          savedConfig.height,
          monitors
        );

        // Lock size first so the OS reports the correct frame when we
        // subsequently read outer_position (e.g. inside set_pet_dragging).
        await invoke('set_pet_window_size', {
          width: savedConfig.width,
          height: savedConfig.height,
          scalePercent: savedConfig.reminderBubbleScale ?? 100,
        });

        // Apply authoritative position BEFORE showing the window so the pet
        // never flashes at a stale/default location on first paint.
        if (startPosition.applyNativeMove || clamped.x !== startX || clamped.y !== startY) {
          await invoke('move_pet_window', {
            x: clamped.x,
            y: clamped.y,
            epoch: positionEpochRef.current,
          });
          await invoke('save_pet_position', { x: clamped.x, y: clamped.y });
        }

        await invoke('set_pet_bubble_layout', {
          visible: false,
          petWidth: savedConfig.width,
          petHeight: savedConfig.height,
          scalePercent: savedConfig.reminderBubbleScale ?? 100,
        });

        setPosition(clamped.x, clamped.y);
        setConfigLoaded(true);

        // Show AFTER position is locked — no more flash at wrong location.
        try {
          await invoke('show_pet_window');
        } catch {
          // Non-fatal: window may already be visible.
        }

        controller.updateConfig(savedConfig);
        controller.updateMonitors(monitors);
        controller.start(clamped.x, clamped.y, monitors);
      } catch (err) {
        console.error('[usePetController] Initialization error:', err);
        setConfigLoaded(true);
      }
    }

    initialize();

    return () => {
      cancelled = true;
      controller.dispose();
      controllerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only on mount

  // ---- Update controller when config changes ----

  useEffect(() => {
    if (controllerRef.current) {
      controllerRef.current.updateConfig(config);
    }
  }, [config]);

  // ---- Tauri event listeners ----

  useEffect(() => {
    const unlisten: Array<() => void> = [];

    async function subscribe() {
      // pet-config-updated
      unlisten.push(
        await listen<PetConfig>(EVENTS.PET_CONFIG_UPDATED, (event) => {
          setConfig(event.payload);
          controllerRef.current?.updateConfig(event.payload);
        })
      );

      // pet-pause
      unlisten.push(
        await listen(EVENTS.PET_PAUSE, () => {
          controllerRef.current?.pause();
        })
      );

      // pet-resume
      unlisten.push(
        await listen(EVENTS.PET_RESUME, () => {
          controllerRef.current?.resume();
        })
      );

      // pet-reset-position
      unlisten.push(
        await listen(EVENTS.PET_RESET_POSITION, () => {
          void (async () => {
            const { monitors, config: currentConfig } = usePetStore.getState();
            let cursor: PersistedPetPosition | null = null;
            try {
              const [cx, cy] = await invoke<[number, number]>('get_cursor_position');
              cursor = { x: cx, y: cy };
            } catch {
              // Fall back to primary monitor bottom-right.
            }
            const defaultPos = getDefaultPosition(
              monitors,
              currentConfig.width,
              currentConfig.height,
              cursor
            );
            try {
              await invoke('move_pet_window', {
                x: defaultPos.x,
                y: defaultPos.y,
                epoch: positionEpochRef.current,
              });
              await invoke('save_pet_position', {
                x: Math.round(defaultPos.x),
                y: Math.round(defaultPos.y),
              });
              setPosition(defaultPos.x, defaultPos.y);
              controllerRef.current?.onDragEnd(defaultPos.x, defaultPos.y);
            } catch (error) {
              console.error('[usePetController] Could not reset pet position:', error);
            }
          })();
        })
      );
    }

    subscribe().catch(console.error);

    return () => {
      unlisten.forEach((fn) => fn());
    };
  }, [setConfig, setPosition]);

  // ---- Expose controller methods ----

  const pauseMovement = useCallback(() => {
    controllerRef.current?.pause();
  }, []);

  const resumeMovement = useCallback(() => {
    controllerRef.current?.resume();
  }, []);

  const notifyDragStart = useCallback(async () => {
    isDraggingRef.current = true;
    pendingWindowPositionRef.current = null;
    controllerRef.current?.onDragStart();
    // Set the native ownership flag first, then let the OS drag loop start.
    // Hiding the reminder is deliberately non-blocking so it cannot delay the
    // cursor from picking up the pet.
    try {
      positionEpochRef.current = await invoke<number>('set_pet_dragging', { dragging: true });
    } catch (error) {
      console.error('[usePetController] Could not start native drag state:', error);
    }
  }, []);

  const notifyDragDirection = useCallback((direction: Direction) => {
    controllerRef.current?.onDragDirection(direction);
  }, []);

  const notifyDragEnd = useCallback(() => {
    // Prevent any auto-move IPC from resurrecting stale coordinates while we
    // are still asking Rust where the pet actually landed.
    isDraggingRef.current = false;
    pendingWindowPositionRef.current = null;

    void (async () => {
      try {
        // Rust captures anchor = outer_position (pet-sized window). The
        // returned epoch has been bumped post-anchor-write, so any in-flight
        // auto-move IPC from before the drag is now stale.
        positionEpochRef.current = await invoke<number>('set_pet_dragging', {
          dragging: false,
        });

        const [anchorX, anchorY] = await invoke<[number, number]>('get_pet_window_position');
        const { monitors, config: currentConfig } = usePetStore.getState();
        const clamped = clampPetToWorkArea(
          anchorX,
          anchorY,
          currentConfig.width,
          currentConfig.height,
          monitors
        );

        // If clamping shifted the drop point, write the corrected position
        // back to Rust so the anchor is authoritative for both X and Y.
        if (clamped.x !== anchorX || clamped.y !== anchorY) {
          await invoke('move_pet_window', {
            x: clamped.x,
            y: clamped.y,
            epoch: positionEpochRef.current,
          });
          positionEpochRef.current = await invoke<number>('get_pet_position_epoch');
        }

        setPosition(clamped.x, clamped.y);
        await invoke('save_pet_position', {
          x: Math.round(clamped.x),
          y: Math.round(clamped.y),
        });
        controllerRef.current?.onDragEnd(clamped.x, clamped.y);
      } catch (error) {
        console.error('[usePetController] Could not finish native drag:', error);
        // Do NOT fall back to the store position here — the store may still
        // hold the spawn position (not yet updated). Attempt a direct Rust
        // read so the controller always starts from the correct anchor.
        try {
          const [fallbackX, fallbackY] = await invoke<[number, number]>('get_pet_window_position');
          setPosition(fallbackX, fallbackY);
          controllerRef.current?.onDragEnd(fallbackX, fallbackY);
        } catch {
          // Last resort: keep the controller paused rather than run from wrong position.
        }
      }
    })();
  }, [setPosition]);

  const notifyHoverStart = useCallback(() => {
    controllerRef.current?.onHoverStart();
  }, []);

  const notifyHoverEnd = useCallback(() => {
    controllerRef.current?.onHoverEnd();
  }, []);

  return {
    pauseMovement,
    resumeMovement,
    notifyDragStart,
    notifyDragDirection,
    notifyDragEnd,
    notifyHoverStart,
    notifyHoverEnd,
  };
}
