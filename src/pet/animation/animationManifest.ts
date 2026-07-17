import type { AnimationManifest, PetAnimation, PetConfig, PetState } from '../../shared/types';

const rowFrames = (row: number, columns: number): number[] =>
  Array.from({ length: columns }, (_, column) => row * columns + column);

const animation = (frames: number[], loop = true, fps?: number): PetAnimation => ({
  frames,
  loop,
  ...(fps === undefined ? {} : { fps }),
});

/** Build the declarative Codex animation contract once, outside the renderer. */
export function createCodexManifest(
  frameWidth: number,
  frameHeight: number,
  rows: 9 | 11,
  defaultFps = 6
): AnimationManifest {
  const columns = 8;
  const animations: Record<string, PetAnimation> = {
    idle: animation(rowFrames(0, columns)),
    'running-right': animation(rowFrames(1, columns)),
    'running-left': animation(rowFrames(2, columns)),
    waving: animation(rowFrames(3, columns)),
    jumping: animation(rowFrames(4, columns)),
    failed: animation(rowFrames(5, columns)),
    waiting: animation(rowFrames(6, columns)),
    running: animation(rowFrames(7, columns)),
    review: animation(rowFrames(8, columns)),
  };

  if (rows === 11) {
    const degrees = [
      '000', '022.5', '045', '067.5', '090', '112.5', '135', '157.5',
      '180', '202.5', '225', '247.5', '270', '292.5', '315', '337.5',
    ];
    degrees.forEach((degree, index) => {
      animations[`look-${degree}`] = animation([9 * columns + index], false);
    });
    animations['look-around'] = animation([
      ...rowFrames(9, columns),
      ...rowFrames(10, columns),
    ]);
  }

  return {
    version: rows === 11 ? 2 : 1,
    frameWidth,
    frameHeight,
    columns,
    rows,
    defaultFps,
    animations,
  };
}

/** Backward-compatible adapter for profiles saved before manifests existed. */
export function createLegacyManifest(config: PetConfig): AnimationManifest {
  const columns = Math.max(1, config.spritesheetCols ?? 4);
  const rows = Math.max(1, config.spritesheetRows ?? 4);
  const frameWidth = Math.max(1, Math.round(config.width));
  const frameHeight = Math.max(1, Math.round(config.height));
  const fps = Math.max(1, config.spritesheetFps ?? 8);

  if (columns === 8 && (rows === 9 || rows === 11)) {
    return createCodexManifest(frameWidth, frameHeight, rows, fps);
  }

  const safeSequence = (start: number, count = columns): number[] => {
    const maxFrame = columns * rows;
    if (start < 0 || start >= maxFrame) return rowFrames(0, columns);
    return Array.from(
      { length: Math.min(count, maxFrame - start) },
      (_, offset) => start + offset
    );
  };

  return {
    version: 0,
    frameWidth,
    frameHeight,
    columns,
    rows,
    defaultFps: fps,
    animations: {
      idle: animation(safeSequence(config.spritesheetIdleFrame ?? 0)),
      walking: animation(safeSequence(config.spritesheetWalkFrame ?? columns)),
      dragging: animation(safeSequence(config.spritesheetDragFrame ?? columns * 2, 1)),
      sleeping: animation(safeSequence(config.spritesheetSleepFrame ?? columns * 3)),
    },
  };
}

export function getAnimationManifest(config: PetConfig): AnimationManifest {
  return config.animationManifest ?? createLegacyManifest(config);
}

/** Actions suitable for autonomous round-robin playback between movements. */
export function getRotatingActionKeys(manifest: AnimationManifest): string[] {
  const movementOnly = new Set([
    'running-left',
    'running-right',
    'walking-left',
    'walking-right',
    'walking',
    'dragging',
    'hovering',
  ]);
  const hasLookAround = Boolean(manifest.animations['look-around']);

  return Object.keys(manifest.animations).filter((key) => {
    if (movementOnly.has(key)) return false;
    if (hasLookAround && /^look-\d/.test(key)) return false;
    return true;
  });
}

export interface ResolvedAnimation {
  key: string;
  animation: PetAnimation;
  mirrorX: boolean;
}

const STATE_CANDIDATES: Record<PetState, string[]> = {
  idle: ['idle'],
  // Prefer walk rows for walk states. Running is only a last-resort fallback
  // (e.g. Codex atlases that only ship run rows).
  'walking-left': ['walking-left', 'walking', 'running-left'],
  'walking-right': ['walking-right', 'walking', 'running-right'],
  'running-left': ['running-left', 'walking-left', 'walking'],
  'running-right': ['running-right', 'walking-right', 'walking'],
  dragging: ['dragging', 'jumping', 'waiting'],
  hovering: ['hovering', 'waving', 'waiting'],
  sleeping: ['sleeping', 'idle'],
  special: ['special', 'look-around', 'review', 'waving'],
  'showing-reminder': ['showing-reminder', 'waiting', 'review'],
};

function mirroredCounterpart(state: PetState): string | null {
  if (state.endsWith('-left')) return state.replace(/-left$/, '-right');
  if (state.endsWith('-right')) return state.replace(/-right$/, '-left');
  return null;
}

export function resolveAnimation(
  manifest: AnimationManifest,
  state: PetState,
  requestedKey?: string
): ResolvedAnimation {
  const candidates = requestedKey
    ? [requestedKey, ...STATE_CANDIDATES[state].filter((key) => key !== 'idle')]
    : STATE_CANDIDATES[state].filter((key) => key !== 'idle');

  for (const key of candidates) {
    const candidate = manifest.animations[key];
    if (candidate?.frames.length) {
      const mirrorGenericMovement = key === 'walking' && state.endsWith('-left');
      return { key, animation: candidate, mirrorX: mirrorGenericMovement };
    }
  }

  const counterpart = mirroredCounterpart(state);
  if (counterpart) {
    const candidate = manifest.animations[counterpart];
    if (candidate?.frames.length) return { key: counterpart, animation: candidate, mirrorX: true };
  }

  const idle = manifest.animations.idle;
  if (idle?.frames.length) return { key: 'idle', animation: idle, mirrorX: false };

  const first = Object.entries(manifest.animations).find(([, value]) => value.frames.length > 0);
  if (first) return { key: first[0], animation: first[1], mirrorX: false };

  return { key: '__empty__', animation: animation([0], false), mirrorX: false };
}

export function validateManifest(manifest: AnimationManifest): boolean {
  const frameCount = manifest.columns * manifest.rows;
  return manifest.columns > 0
    && manifest.rows > 0
    && manifest.frameWidth > 0
    && manifest.frameHeight > 0
    && Object.values(manifest.animations).every((item) =>
      item.frames.length > 0 && item.frames.every((frame) => Number.isInteger(frame) && frame >= 0 && frame < frameCount)
    );
}

/** Remove transparent/unused atlas cells while preserving animation order. */
export function pruneEmptyFrames(
  manifest: AnimationManifest,
  visibleFrames: ReadonlySet<number>
): AnimationManifest {
  const animations = Object.fromEntries(
    Object.entries(manifest.animations)
      .map(([key, item]) => [
        key,
        { ...item, frames: item.frames.filter((frame) => visibleFrames.has(frame)) },
      ] as const)
      .filter(([, item]) => item.frames.length > 0)
  );

  return { ...manifest, animations };
}
