import type { PetAnimation } from '../../shared/types';

export const MAX_PLAYBACK_FPS = 3.2;
export const ANIMATION_STATE_TRANSITION_MS = 420;
const IDLE_HOLD_MS = 2200;
const IDLE_ACTION_FRAME_MS = 110;

export interface AnimationFrameSample {
  currentFrame: number;
  nextFrame: number;
  blend: number;
}

const smoothstep = (value: number): number => value * value * (3 - 2 * value);

/**
 * Samples a timeline with a long neutral idle hold and short smooth frame
 * transitions. This keeps blinking natural without making movement snappy.
 */
export function sampleAnimationTimeline(
  key: string,
  animation: PetAnimation,
  defaultFps: number,
  elapsedMs: number
): AnimationFrameSample {
  const frames = animation.frames.length > 0 ? animation.frames : [0];
  const fps = Math.max(1, Math.min(MAX_PLAYBACK_FPS, animation.fps ?? defaultFps));
  const normalFrameMs = 1000 / fps;
  const isIdle = key === 'idle';
  const durations = frames.map((_, index) => {
    if (!isIdle) return normalFrameMs;
    return index === 0 ? IDLE_HOLD_MS : IDLE_ACTION_FRAME_MS;
  });
  const totalDuration = durations.reduce((total, duration) => total + duration, 0);
  const safeElapsed = Math.max(0, elapsedMs);
  const localElapsed = animation.loop
    ? safeElapsed % totalDuration
    : Math.min(safeElapsed, Math.max(0, totalDuration - 0.001));

  let frameIndex = 0;
  let frameStartedAt = 0;
  for (let index = 0; index < durations.length; index += 1) {
    const frameEndsAt = frameStartedAt + durations[index];
    if (localElapsed < frameEndsAt || index === durations.length - 1) {
      frameIndex = index;
      break;
    }
    frameStartedAt = frameEndsAt;
  }

  const currentFrame = frames[frameIndex];
  const isLastNonLoopFrame = !animation.loop && frameIndex === frames.length - 1;
  const nextFrame = isLastNonLoopFrame
    ? currentFrame
    : frames[(frameIndex + 1) % frames.length];
  if (nextFrame === currentFrame) return { currentFrame, nextFrame, blend: 0 };

  const frameDuration = durations[frameIndex];
  const transitionDuration = isIdle
    ? Math.min(frameDuration, frameIndex === 0 ? 90 : 65)
    : frameDuration * 0.45;
  const transitionStartedAt = frameStartedAt + frameDuration - transitionDuration;
  const linearBlend = Math.min(
    1,
    Math.max(0, (localElapsed - transitionStartedAt) / transitionDuration)
  );

  return { currentFrame, nextFrame, blend: smoothstep(linearBlend) };
}
