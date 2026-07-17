import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { usePetStore } from '../../store/petStore';
import type { AnimationManifest } from '../../shared/types';
import {
  createLegacyManifest,
  pruneEmptyFrames,
  resolveAnimation,
  validateManifest,
} from '../animation/animationManifest';
import {
  ANIMATION_STATE_TRANSITION_MS,
  sampleAnimationTimeline,
} from '../animation/animationTiming';

interface PetImageProps {
  imagePath: string;
  width: number;
  height: number;
  alt?: string;
  onError?: () => void;
  onLoad?: () => void;
  spritesheetEnabled?: boolean;
  spritesheetCols?: number;
  spritesheetRows?: number;
  spritesheetFps?: number;
  spritesheetIdleFrame?: number;
  spritesheetWalkFrame?: number;
  spritesheetDragFrame?: number;
  spritesheetSleepFrame?: number;
  animationManifest?: AnimationManifest;
  animationKey?: string;
}

interface AtlasInspection {
  visibleFrames: Set<number>;
}

const FRAME_BLEND_STEPS = 24;
const STATE_BLEND_STEPS = 32;

/** Inspect occupancy without altering the atlas's fixed cell registration. */
function inspectAtlasFrames(
  image: HTMLImageElement,
  manifest: AnimationManifest
): AtlasInspection | null {
  const frameWidth = Math.floor(image.naturalWidth / manifest.columns);
  const frameHeight = Math.floor(image.naturalHeight / manifest.rows);
  if (frameWidth <= 0 || frameHeight <= 0) return null;

  const probe = document.createElement('canvas');
  probe.width = frameWidth;
  probe.height = frameHeight;
  const context = probe.getContext('2d', { alpha: true, willReadFrequently: true });
  if (!context) return null;

  const minimumVisiblePixels = Math.max(16, Math.floor(frameWidth * frameHeight * 0.0005));
  const visibleFrames = new Set<number>();

  try {
    for (let frame = 0; frame < manifest.columns * manifest.rows; frame += 1) {
      const sourceX = (frame % manifest.columns) * frameWidth;
      const sourceY = Math.floor(frame / manifest.columns) * frameHeight;
      context.globalCompositeOperation = 'copy';
      context.drawImage(
        image,
        sourceX,
        sourceY,
        frameWidth,
        frameHeight,
        0,
        0,
        frameWidth,
        frameHeight
      );

      const pixels = context.getImageData(0, 0, frameWidth, frameHeight).data;
      let visiblePixelCount = 0;
      for (let offset = 3; offset < pixels.length; offset += 4) {
        if (pixels[offset] > 8) {
          visiblePixelCount += 1;
          if (visiblePixelCount >= minimumVisiblePixels) {
            visibleFrames.add(frame);
            break;
          }
        }
      }
    }
    return { visibleFrames };
  } catch (error) {
    console.warn('[PetImage] Could not inspect transparent atlas cells:', error);
    return null;
  }
}

const PetImage: React.FC<PetImageProps> = ({
  imagePath,
  width,
  height,
  alt = 'Pet character',
  onError,
  onLoad,
  spritesheetEnabled: overrideEnabled,
  spritesheetCols: overrideCols,
  spritesheetRows: overrideRows,
  spritesheetFps: overrideFps,
  spritesheetIdleFrame: overrideIdleFrame,
  spritesheetWalkFrame: overrideWalkFrame,
  spritesheetDragFrame: overrideDragFrame,
  spritesheetSleepFrame: overrideSleepFrame,
  animationManifest: overrideManifest,
  animationKey,
}) => {
  const [hasError, setHasError] = useState(false);
  const [imgSrc, setImgSrc] = useState('');
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const bufferRef = useRef<HTMLCanvasElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const onLoadRef = useRef(onLoad);
  const onErrorRef = useRef(onError);
  const config = usePetStore((state) => state.config);
  const petState = usePetStore((state) => state.petState);
  const petStateRef = useRef(petState);
  const animationKeyRef = useRef(animationKey);

  onLoadRef.current = onLoad;
  onErrorRef.current = onError;
  petStateRef.current = petState;
  animationKeyRef.current = animationKey;

  const spritesheetEnabled = overrideEnabled ?? config.spritesheetEnabled ?? false;

  const manifest = useMemo(() => {
    if (overrideManifest && validateManifest(overrideManifest)) return overrideManifest;
    if (config.animationManifest && validateManifest(config.animationManifest)) {
      return config.animationManifest;
    }
    return createLegacyManifest({
      ...config,
      width,
      height,
      spritesheetCols: overrideCols ?? config.spritesheetCols,
      spritesheetRows: overrideRows ?? config.spritesheetRows,
      spritesheetFps: overrideFps ?? config.spritesheetFps,
      spritesheetIdleFrame: overrideIdleFrame ?? config.spritesheetIdleFrame,
      spritesheetWalkFrame: overrideWalkFrame ?? config.spritesheetWalkFrame,
      spritesheetDragFrame: overrideDragFrame ?? config.spritesheetDragFrame,
      spritesheetSleepFrame: overrideSleepFrame ?? config.spritesheetSleepFrame,
    });
  }, [
    config,
    height,
    overrideCols,
    overrideDragFrame,
    overrideFps,
    overrideIdleFrame,
    overrideManifest,
    overrideRows,
    overrideSleepFrame,
    overrideWalkFrame,
    width,
  ]);

  useEffect(() => {
    setHasError(false);
    setIsImageLoaded(false);
    imageRef.current = null;

    if (!imagePath) {
      setImgSrc('');
      return;
    }

    try {
      const src = convertFileSrc(imagePath);
      setImgSrc(src);
      const image = new Image();
      image.crossOrigin = 'anonymous';
      image.decoding = 'async';
      image.src = src;
      image.onload = () => {
        imageRef.current = image;
        setIsImageLoaded(true);
        onLoadRef.current?.();
      };
      image.onerror = () => {
        setHasError(true);
        setIsImageLoaded(false);
        onErrorRef.current?.();
      };
    } catch (error) {
      console.error('[PetImage] Failed to convert file path:', error);
      setHasError(true);
      onErrorRef.current?.();
    }
  }, [imagePath]);

  // One timeline owns all frame drawing. State changes are picked up through refs,
  // so React never clears or recreates the visible canvas between animations.
  useEffect(() => {
    if (!spritesheetEnabled || !isImageLoaded || !imageRef.current || !canvasRef.current) return;

    const image = imageRef.current;
    const canvas = canvasRef.current;
    const frameWidth = Math.floor(image.naturalWidth / manifest.columns);
    const frameHeight = Math.floor(image.naturalHeight / manifest.rows);
    if (frameWidth <= 0 || frameHeight <= 0) return;
    const inspection = inspectAtlasFrames(image, manifest);
    const playbackManifest = inspection
      ? pruneEmptyFrames(manifest, inspection.visibleFrames)
      : manifest;

    // Draw at native atlas cell resolution. CSS flex on the wrapper keeps a
    // fixed pet viewport with a shared foot baseline — avoid DPR/clearRect
    // paths that leave an opaque black rectangle in WKWebView.
    if (canvas.width !== frameWidth) canvas.width = frameWidth;
    if (canvas.height !== frameHeight) canvas.height = frameHeight;

    const buffer = bufferRef.current ?? document.createElement('canvas');
    bufferRef.current = buffer;
    if (buffer.width !== frameWidth) buffer.width = frameWidth;
    if (buffer.height !== frameHeight) buffer.height = frameHeight;

    const visibleContext = canvas.getContext('2d', { alpha: true });
    const bufferContext = buffer.getContext('2d', { alpha: true });
    if (!visibleContext || !bufferContext) return;
    visibleContext.imageSmoothingEnabled = false;
    bufferContext.imageSmoothingEnabled = false;

    let rafId = 0;
    let animationStartedAt = performance.now();
    let resolved = resolveAnimation(playbackManifest, petStateRef.current, animationKeyRef.current);
    let resolvedState = petStateRef.current;
    let resolvedKey = animationKeyRef.current;
    let lastDrawToken = '';
    let lastDisplayedFrame = resolved.animation.frames[0] ?? 0;
    let lastDisplayedMirror = resolved.mirrorX;
    let transitionFrom: { frame: number; mirrorX: boolean } | null = null;
    let transitionStartedAt = 0;

    const drawFrame = (timestamp: number) => {
      if (resolvedState !== petStateRef.current || resolvedKey !== animationKeyRef.current) {
        transitionFrom = { frame: lastDisplayedFrame, mirrorX: lastDisplayedMirror };
        transitionStartedAt = timestamp;
        resolvedState = petStateRef.current;
        resolvedKey = animationKeyRef.current;
        resolved = resolveAnimation(playbackManifest, resolvedState, resolvedKey);
        animationStartedAt = timestamp;
      }

      // Hold the first incoming pose for the entire cross-state blend. Letting
      // its own timeline advance here can swap target frames mid-transition.
      const timelineElapsed = transitionFrom ? 0 : timestamp - animationStartedAt;
      const sample = sampleAnimationTimeline(
        resolved.key,
        resolved.animation,
        playbackManifest.defaultFps,
        timelineElapsed
      );
      const stateProgress = transitionFrom
        ? Math.min(1, Math.max(0, (timestamp - transitionStartedAt) / ANIMATION_STATE_TRANSITION_MS))
        : 1;
      const stateBlend = stateProgress * stateProgress * (3 - 2 * stateProgress);
      const stateBlendStep = Math.round(stateBlend * STATE_BLEND_STEPS);
      const frameBlendStep = Math.round(sample.blend * FRAME_BLEND_STEPS);
      const drawToken = `${resolved.key}:${sample.currentFrame}:${sample.nextFrame}:${frameBlendStep}:${resolved.mirrorX ? 1 : 0}:${transitionFrom?.frame ?? -1}:${transitionFrom?.mirrorX ? 1 : 0}:${stateBlendStep}`;

      if (drawToken !== lastDrawToken) {
        const drawAtlasFrame = (
          frame: number,
          alpha: number,
          compositeOperation: GlobalCompositeOperation,
          mirrorX: boolean
        ) => {
          const sourceX = (frame % playbackManifest.columns) * frameWidth;
          const sourceY = Math.floor(frame / playbackManifest.columns) * frameHeight;
          bufferContext.save();
          bufferContext.globalCompositeOperation = compositeOperation;
          bufferContext.globalAlpha = alpha;
          bufferContext.setTransform(1, 0, 0, 1, 0, 0);
          if (mirrorX) {
            bufferContext.translate(frameWidth, 0);
            bufferContext.scale(-1, 1);
          }
          bufferContext.drawImage(
            image,
            sourceX,
            sourceY,
            frameWidth,
            frameHeight,
            0,
            0,
            frameWidth,
            frameHeight
          );
          bufferContext.restore();
        };

        // Clear buffer before each draw to prevent any stale pixel bleed.
        bufferContext.clearRect(0, 0, frameWidth, frameHeight);

        if (transitionFrom && stateBlendStep < STATE_BLEND_STEPS) {
          // State-transition blend: draw the OUTGOING frame at FULL opacity
          // first, then composite the INCOMING frame on top.
          // Using full opacity for the outgoing frame guarantees that character
          // pixels never become semi-transparent mid-transition (which causes
          // a visible dark flicker on a transparent window).
          const quantizedStateBlend = stateBlendStep / STATE_BLEND_STEPS;
          drawAtlasFrame(transitionFrom.frame, 1.0, 'copy', transitionFrom.mirrorX);
          drawAtlasFrame(sample.currentFrame, quantizedStateBlend, 'source-over', resolved.mirrorX);
        } else {
          if (transitionFrom) animationStartedAt = timestamp;
          transitionFrom = null;
          const quantizedBlend = frameBlendStep / FRAME_BLEND_STEPS;
          // Draw the current frame at FULL opacity — never at (1-blend) — so
          // opaque character pixels are always fully visible (no flicker).
          drawAtlasFrame(sample.currentFrame, 1.0, 'copy', resolved.mirrorX);
          if (frameBlendStep > 0 && sample.nextFrame !== sample.currentFrame) {
            // Fade the next frame IN on top. source-over at partial alpha means:
            //  - Where current has opaque pixel & next has opaque pixel → opaque blend (no flicker)
            //  - Where only next has pixel → pixel fades in (correct)
            //  - Where only current has pixel → pixel stays visible (acceptable)
            drawAtlasFrame(sample.nextFrame, quantizedBlend, 'source-over', resolved.mirrorX);
          }
        }

        visibleContext.setTransform(1, 0, 0, 1, 0, 0);
        visibleContext.globalCompositeOperation = 'source-over';
        visibleContext.clearRect(0, 0, frameWidth, frameHeight);
        visibleContext.drawImage(buffer, 0, 0);
        lastDrawToken = drawToken;
        lastDisplayedFrame = sample.blend >= 0.5 ? sample.nextFrame : sample.currentFrame;
        lastDisplayedMirror = resolved.mirrorX;
      }
      rafId = requestAnimationFrame(drawFrame);
    };

    // Draw immediately so a newly loaded asset never waits through one frame interval.
    drawFrame(animationStartedAt);
    return () => cancelAnimationFrame(rafId);
  }, [isImageLoaded, manifest, spritesheetEnabled]);

  const handleError = useCallback(() => {
    setHasError(true);
    onErrorRef.current?.();
  }, []);

  const handleLoad = useCallback(() => {
    setHasError(false);
    onLoadRef.current?.();
  }, []);

  if (!imagePath || !imgSrc) {
    return (
      <div className="pet-placeholder" style={{ width, height }} aria-label="No pet image configured">
        <div className="pet-placeholder__emoji">🐾</div>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="pet-error" style={{ width, height }} aria-label="Pet image failed to load">
        <div className="pet-error__icon">❓</div>
      </div>
    );
  }

  if (spritesheetEnabled) {
    return (
      <div
        className="pet-sprite-viewport"
        style={{ width: '100%', height: '100%' }}
      >
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={alt}
          style={{
            // Keep aspect ratio; parent flex pins feet to the bottom edge.
            maxWidth: '100%',
            maxHeight: '100%',
            width: 'auto',
            height: '100%',
            display: 'block',
            imageRendering: 'auto',
            transform: 'translateZ(0)',
            backfaceVisibility: 'hidden',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            pointerEvents: 'none',
          }}
        />
      </div>
    );
  }

  return (
    <img
      src={imgSrc}
      width="100%"
      height="100%"
      alt={alt}
      onError={handleError}
      onLoad={handleLoad}
      draggable={false}
      style={{
        display: 'block',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        pointerEvents: 'none',
        objectFit: config.preserveAspectRatio ? 'contain' : 'fill',
        objectPosition: 'center bottom',
      }}
    />
  );
};

export default PetImage;
