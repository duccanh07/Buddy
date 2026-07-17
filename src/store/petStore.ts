import { create } from 'zustand';
import type { PetConfig, PetState, Direction, BubbleContent, MonitorInfo } from '../shared/types';
import { DEFAULT_PET_CONFIG } from '../config/defaultConfig';

interface PetStore {
  // Config
  config: PetConfig;
  setConfig: (config: PetConfig) => void;
  updateConfig: (partial: Partial<PetConfig>) => void;

  // Pet runtime state
  petState: PetState;
  setPetState: (state: PetState) => void;
  activeAnimationKey: string | null;
  setActiveAnimationKey: (key: string | null) => void;

  // Position (logical pixels — matches window outer position)
  x: number;
  y: number;
  setPosition: (x: number, y: number) => void;

  // Movement direction
  direction: Direction;
  setDirection: (dir: Direction) => void;

  // Is pet visible
  isVisible: boolean;
  setVisible: (visible: boolean) => void;

  // Is movement manually paused (e.g. from tray)
  isPaused: boolean;
  setPaused: (paused: boolean) => void;

  // Active speech bubble
  activeBubble: BubbleContent | null;
  showBubble: (bubble: BubbleContent) => void;
  hideBubble: () => void;
  bubblePlacement: 'above' | 'below';
  setBubblePlacement: (placement: 'above' | 'below') => void;

  // Monitors info
  monitors: MonitorInfo[];
  setMonitors: (monitors: MonitorInfo[]) => void;

  // Config loaded flag
  isConfigLoaded: boolean;
  setConfigLoaded: (loaded: boolean) => void;
}

export const usePetStore = create<PetStore>((set) => ({
  config: { ...DEFAULT_PET_CONFIG },
  setConfig: (config) => set({ config }),
  updateConfig: (partial) =>
    set((state) => ({ config: { ...state.config, ...partial } })),

  petState: 'idle',
  setPetState: (petState) => set({ petState }),
  activeAnimationKey: null,
  setActiveAnimationKey: (activeAnimationKey) => set({ activeAnimationKey }),

  x: 0,
  y: 0,
  setPosition: (x, y) => set({ x, y }),

  direction: 1,
  setDirection: (direction) => set({ direction }),

  isVisible: true,
  setVisible: (isVisible) => set({ isVisible }),

  isPaused: false,
  setPaused: (isPaused) => set({ isPaused }),

  activeBubble: null,
  showBubble: (bubble) => set({ activeBubble: bubble }),
  hideBubble: () => set({ activeBubble: null }),
  bubblePlacement: 'above',
  setBubblePlacement: (bubblePlacement) => set({ bubblePlacement }),

  monitors: [],
  setMonitors: (monitors) => set({ monitors }),

  isConfigLoaded: false,
  setConfigLoaded: (isConfigLoaded) => set({ isConfigLoaded }),
}));
