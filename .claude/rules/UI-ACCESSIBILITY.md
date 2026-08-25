# Child-facing UI and accessibility

## Who is using this

A child with Down syndrome who **does not read** and has **imprecise motor control**.
Every rule below follows from those two facts.

## UI requirements

- **Large touch targets.** Err far larger than feels normal. If it looks oversized on a
  desktop mockup it is probably about right on a tablet in his hands.
- **Minimal text on screen.** He does not read. Text on screen is for the adult, and there
  should be very little of it. Never use text as the only way to convey something to him.
- **No timers, no countdowns, no scores, no streaks, no failure states.** Nothing that can
  feel like losing. There is no wrong answer in this app.
- **Immediate, obvious feedback that the mic is listening.** A clear visual indicator, not
  just a button changing shade. He needs to know the app heard him.
- **Adult controls behind a deliberate gesture.** Settings sit behind a long press or a
  corner tap sequence. He must not be able to wander into them by exploring, and exploring
  is exactly what he will do. The per-word fix dialog uses the same gesture on a pictogram.
  A plain tap on a pictogram says the word out loud, first whole and then
  syllable by syllable in Spanish, and does nothing else: it opens nothing and
  changes nothing, so there is still nowhere a tap can take him. In game mode
  the strips are silent, because there the strip is the turn itself.
  Anything reachable by the gesture must be undoable from the adult panel,
  because he will eventually get in. The language toggle is the one
  exception: it lives as a plain, visible flag button in the header, next to the game-mode
  toggle, because a wrong tap only changes which language pictograms resolve in and loses
  nothing, the same reasoning that keeps game mode outside the gesture gate.
- **Fully responsive.** Phone and tablet browsers are the real target. This is not React
  Native.

## Styling

Bootstrap 5 and SCSS are already in the project. Use them. Do not pull in a new styling
system, a CSS-in-JS library, or a component kit.

Theme variables live in `src/styles/`. `src/controllers/themeController.js` holds the
existing localStorage read/write pattern; follow it for any new persisted setting.

## Accessibility

WCAG 2.1 AA throughout, non-negotiable:

- Semantic HTML with real landmarks.
- Accessible names on every icon-only control.
- `aria-live` on the pictogram strip so the sequence is announced as it changes.
- Visible focus indicators. Fully keyboard operable.
- Colour plus text for every state. Never colour alone.

Audit with WAVE before v1 is called done.

## Attribution

The ARASAAC attribution line must stay visible in the UI:

```
Pictogramas: Sergio Palao, ARASAAC, Gobierno de Aragón. CC BY-NC-SA.
```

Do not move it into an About page that has to be opened, and do not remove it to clean up
the layout. The licence requires it.
