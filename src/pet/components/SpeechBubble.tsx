import React, { useEffect, useRef } from 'react';
import type { BubbleContent } from '../../shared/types';

interface SpeechBubbleProps {
  bubble: BubbleContent;
  onClose: () => void;
}

/**
 * SpeechBubble displays a floating notification next to the pet.
 * Auto-closes after the configured duration.
 */
const SpeechBubble: React.FC<SpeechBubbleProps> = ({ bubble, onClose }) => {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const duration = bubble.autoCloseMs ?? 5000;

  useEffect(() => {
    // Clear any existing timer
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
    }

    // Auto-close
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      onClose();
    }, duration);

    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [bubble, duration, onClose]);

  return (
    <div className="speech-bubble" role="alert" aria-live="assertive">
      <div className="speech-bubble__content">
        <p className="speech-bubble__message">{bubble.message}</p>
      </div>
      <button
        className="speech-bubble__progress"
        onClick={onClose}
        aria-label="Close notification"
        type="button"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle className="speech-bubble__progress-track" cx="12" cy="12" r="9" />
          <circle
            className="speech-bubble__progress-value"
            cx="12"
            cy="12"
            r="9"
            pathLength="100"
            style={{ animationDuration: `${duration}ms` }}
          />
        </svg>
      </button>
    </div>
  );
};

export default SpeechBubble;
