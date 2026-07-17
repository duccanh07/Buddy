import { describe, expect, it } from 'vitest';
import { sampleAnimationTimeline } from '../pet/animation/animationTiming';

describe('sampleAnimationTimeline', () => {
  it('holds the neutral idle frame before playing a blink', () => {
    const animation = { frames: [0, 1, 2, 3], loop: true };

    expect(sampleAnimationTimeline('idle', animation, 6, 1500)).toMatchObject({
      currentFrame: 0,
      blend: 0,
    });
    expect(sampleAnimationTimeline('idle', animation, 6, 2201).currentFrame).toBe(1);
  });

  it('caps normal animation at 3.2 frames per second', () => {
    const animation = { frames: [8, 9, 10], loop: true };

    expect(sampleAnimationTimeline('running-right', animation, 8, 311).currentFrame).toBe(8);
    expect(sampleAnimationTimeline('running-right', animation, 8, 313).currentFrame).toBe(9);
  });

  it('crossfades near the end of a frame instead of snapping', () => {
    const animation = { frames: [8, 9], loop: true };
    const sample = sampleAnimationTimeline('running-right', animation, 4, 200);

    expect(sample.currentFrame).toBe(8);
    expect(sample.nextFrame).toBe(9);
    expect(sample.blend).toBeGreaterThan(0);
    expect(sample.blend).toBeLessThan(1);
  });
});
