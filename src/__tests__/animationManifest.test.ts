import { describe, expect, it } from 'vitest';
import type { AnimationManifest } from '../shared/types';
import {
  createCodexManifest,
  createLegacyManifest,
  getRotatingActionKeys,
  pruneEmptyFrames,
  resolveAnimation,
  validateManifest,
} from '../pet/animation/animationManifest';
import { DEFAULT_PET_CONFIG } from '../config/defaultConfig';

describe('Codex animation manifest', () => {
  it('discovers all standard and look-direction states in v2', () => {
    const manifest = createCodexManifest(192, 208, 11, 6);

    expect(Object.keys(manifest.animations)).toHaveLength(26);
    expect(manifest.animations.idle.frames).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(manifest.animations.review.frames).toEqual([64, 65, 66, 67, 68, 69, 70, 71]);
    expect(manifest.animations['look-000'].frames).toEqual([72]);
    expect(manifest.animations['look-337.5'].frames).toEqual([87]);
    expect(manifest.animations['look-around'].frames).toHaveLength(16);
    expect(validateManifest(manifest)).toBe(true);
  });

  it('keeps v1 limited to its available nine rows', () => {
    const manifest = createCodexManifest(192, 208, 9);
    expect(manifest.version).toBe(1);
    expect(manifest.animations['look-around']).toBeUndefined();
    expect(Object.keys(manifest.animations)).toHaveLength(9);
  });

  it('removes transparent tail cells without changing frame order', () => {
    const manifest = createCodexManifest(192, 208, 11);
    const visibleFrames = new Set<number>([
      0, 1, 2, 3, 4, 5, 6,
      8, 9, 10, 11, 12, 13, 14, 15,
    ]);
    const pruned = pruneEmptyFrames(manifest, visibleFrames);

    expect(pruned.animations.idle.frames).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(pruned.animations['running-right'].frames).toEqual([8, 9, 10, 11, 12, 13, 14, 15]);
    expect(pruned.animations.waving).toBeUndefined();
  });

  it('builds a complete round-robin list without duplicating movement rows', () => {
    const manifest = createCodexManifest(192, 208, 11);

    expect(getRotatingActionKeys(manifest)).toEqual([
      'idle',
      'waving',
      'jumping',
      'failed',
      'waiting',
      'running',
      'review',
      'look-around',
    ]);
  });
});

describe('animation resolution', () => {
  it('uses dedicated left and right rows without mirroring', () => {
    const manifest = createCodexManifest(192, 208, 11);
    expect(resolveAnimation(manifest, 'walking-left')).toMatchObject({
      key: 'running-left',
      mirrorX: false,
    });
    expect(resolveAnimation(manifest, 'walking-right')).toMatchObject({
      key: 'running-right',
      mirrorX: false,
    });
  });

  it('mirrors a generic legacy walking row only for left movement', () => {
    const manifest = createLegacyManifest({
      ...DEFAULT_PET_CONFIG,
      spritesheetEnabled: true,
      spritesheetCols: 4,
      spritesheetRows: 4,
      spritesheetWalkFrame: 4,
    });
    expect(resolveAnimation(manifest, 'walking-left')).toMatchObject({ key: 'walking', mirrorX: true });
    expect(resolveAnimation(manifest, 'walking-right')).toMatchObject({ key: 'walking', mirrorX: false });
  });

  it('checks the opposite directional row before falling back to idle', () => {
    const manifest: AnimationManifest = {
      version: 1,
      frameWidth: 10,
      frameHeight: 10,
      columns: 2,
      rows: 2,
      defaultFps: 6,
      animations: {
        idle: { frames: [0], loop: true },
        'running-right': { frames: [2, 3], loop: true },
      },
    };
    expect(resolveAnimation(manifest, 'running-left')).toMatchObject({
      key: 'running-right',
      mirrorX: true,
    });
  });

  it('rejects manifests with frames outside the atlas', () => {
    const manifest = createCodexManifest(192, 208, 9);
    manifest.animations.idle.frames = [999];
    expect(validateManifest(manifest)).toBe(false);
  });
});
