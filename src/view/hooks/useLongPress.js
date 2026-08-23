import { useCallback, useRef } from 'react';

/**
 * A deliberate long press, for adult-only controls.
 *
 * The child must not be able to reach settings by exploring, and exploring is
 * exactly what he will do. A long press is hard to trigger by accident but easy
 * for an adult who knows it is there.
 *
 * Keyboard users get the same affordance through onKeyDown, since a long press
 * is not keyboard-operable and the control must still meet WCAG 2.1.1.
 */
export function useLongPress(onLongPress, { durationMs = 1200 } = {}) {
  const timer = useRef(null);
  const triggered = useRef(false);

  const start = useCallback(() => {
    triggered.current = false;
    timer.current = setTimeout(() => {
      triggered.current = true;
      onLongPress();
    }, durationMs);
  }, [onLongPress, durationMs]);

  const cancel = useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  // Suppress the click that follows a completed long press, so the control does
  // not also fire its ordinary action.
  const onClick = useCallback((event) => {
    if (triggered.current) {
      event.preventDefault();
      event.stopPropagation();
      triggered.current = false;
    }
  }, []);

  return {
    onPointerDown: start,
    onPointerUp: cancel,
    onPointerLeave: cancel,
    onPointerCancel: cancel,
    onClick,
    // Keyboard equivalent: an explicit modifier chord rather than a held key,
    // because browsers repeat keydown and there is no reliable "held" event.
    onKeyDown: (event) => {
      if (event.key === 'Enter' && event.shiftKey) {
        event.preventDefault();
        onLongPress();
      }
    },
  };
}
