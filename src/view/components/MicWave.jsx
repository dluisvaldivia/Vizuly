import { useEffect, useRef } from 'react';

/**
 * The sound-input indicator that lives inside the TALK button.
 *
 * Concentric rings travel *inwards*, toward the centre of the button, at an
 * amplitude driven by the real microphone level. The direction is the point:
 * sound is going in, into the app, and the child is the source of it. Rings
 * spawning at the rim and shrinking to the middle read as "it is taking what I
 * say", where outward rings would read as the button emitting something.
 *
 * Why canvas and not CSS: the amplitude has to follow his actual voice frame by
 * frame. Driving that through React state would re-render the pictogram strip
 * on every audio frame; driving it through CSS variables would still cross the
 * React boundary. This reads the level ref inside its own animation frame and
 * never re-renders anything.
 *
 * Purely decorative: aria-hidden, and it is never the only signal that the mic
 * is live. The state word, the dot, and the border colour all still say so.
 */
export default function MicWave({ levelRef, active }) {
  const canvasRef = useRef(null);

  // Smoothed level, kept across frames. Raw peak is far too jumpy to look like
  // anything: it spikes and drops to zero between syllables.
  const smoothedRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const context = canvas.getContext('2d');
    if (!context) return undefined;

    // A child who has asked for less motion still gets the border, dot and text
    // states. Honouring this here matters because the rest of the app already
    // does, via the prefers-reduced-motion block in _aac.scss.
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    let frame = 0;
    let phase = 0;
    let cssSize = 0;

    // Match the backing store to the device pixel ratio, or the rings look
    // soft on exactly the tablet screens this is built for.
    function resize() {
      const rect = canvas.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;

      cssSize = Math.min(rect.width, rect.height);
      if (cssSize === 0) return;

      canvas.width = Math.round(cssSize * ratio);
      canvas.height = Math.round(cssSize * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    }

    resize();

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    function draw() {
      frame = requestAnimationFrame(draw);

      if (cssSize === 0) return;

      context.clearRect(0, 0, cssSize, cssSize);

      // Read the live colour so the rings follow the theme and never end up
      // invisible in dark mode.
      const styles = getComputedStyle(canvas);
      const ringColor = styles.getPropertyValue('--mic-live').trim() || '#1a7f37';

      const target = active ? Math.min(1, levelRef.current * 2.2) : 0;

      // Rise fast, fall slow. Fast attack so the wave answers the instant he
      // makes a sound, which is the entire point of the indicator; slow release
      // so it does not collapse to nothing in the gaps between syllables.
      const current = smoothedRef.current;
      const smoothing = target > current ? 0.45 : 0.08;
      const level = current + (target - current) * smoothing;
      smoothedRef.current = level;

      if (!active && level < 0.01) {
        smoothedRef.current = 0;
        return;
      }

      const centre = cssSize / 2;
      // Stay inside the button's 4px border with room to spare.
      const maxRadius = centre - 8;

      if (!motionQuery.matches) {
        // Inward travel. Subtracting advances each ring toward the centre.
        phase -= 0.006;
        if (phase < 0) phase += 1;
      }

      // A resting breath so the button never looks dead while listening, plus
      // his voice on top of it.
      const amplitude = (active ? 0.18 : 0) + level * 0.82;

      const RING_COUNT = 4;

      for (let i = 0; i < RING_COUNT; i += 1) {
        // Each ring sits at a fixed offset in the cycle, so they arrive one
        // after another rather than pulsing together.
        let position = (phase + i / RING_COUNT) % 1;
        if (position < 0) position += 1;

        const radius = maxRadius * (0.25 + position * 0.75);
        if (radius <= 0) continue;

        // Fade out as it reaches the centre, and in as it appears at the rim,
        // so rings do not pop into or out of existence.
        const edgeFade = Math.min(1, (1 - position) * 3, position * 4);

        context.beginPath();
        context.arc(centre, centre, radius, 0, Math.PI * 2);
        context.strokeStyle = ringColor;
        context.globalAlpha = Math.min(1, edgeFade * amplitude * 0.9);
        context.lineWidth = 1.5 + level * 3.5;
        context.stroke();
      }

      context.globalAlpha = 1;
    }

    frame = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [levelRef, active]);

  return <canvas ref={canvasRef} className="mic__wave" aria-hidden="true" />;
}
