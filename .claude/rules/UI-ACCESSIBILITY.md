# Child-facing UI and accessibility

## Who is using this

Children with Down syndrome, who often **do not read** and have **imprecise motor control**.
Every rule below follows from those two facts.

## UI requirements

- **Large touch targets.** Err far larger than feels normal. If it looks oversized on a
  desktop mockup it is probably about right on a tablet in a child's hands.
- **Minimal text on screen.** He does not read. Text on screen is for the adult, and there
  should be very little of it. Never use text as the only way to convey something to the child.
- **No timers, no countdowns, no scores, no streaks, no failure states.** Nothing that can
  feel like losing. There is no wrong answer in this app.
- **Immediate, obvious feedback that the mic is listening.** A clear visual indicator, not
  just a button changing shade. The child needs to know the app heard them.
- **Adult controls behind a deliberate gesture.** Settings sit behind a long press or a
  corner tap sequence. He must not be able to wander into them by exploring, and exploring
  is exactly what children do. The per-word fix dialog uses the same gesture on a pictogram.
  A plain tap on a pictogram says the word out loud, first whole and then
  syllable by syllable in Spanish, and does nothing else: it opens nothing and
  changes nothing, so there is still nowhere a tap can take the child. Letter cards
  are the one place a tap does something else: it turns the card over, silently,
  and a speak button appears beside a turned card only. A long press on a card
  still opens the fix dialog. The letter picker is plain and ungated, like the
  game toggle, because choosing a letter loses nothing. In game mode
  the strips are silent, because there the strip is the turn itself.
  Anything reachable by the gesture must be undoable from the adult panel,
  because the child will eventually get in. The language toggle is the one
  exception: it lives as a plain, visible flag button in the header, next to the game-mode
  toggle, because a wrong tap only changes which language pictograms resolve in and loses
  nothing, the same reasoning that keeps game mode outside the gesture gate.
- **Fully responsive.** Phone and tablet browsers are the real target. This is not React
  Native.

## Styling

Plain hand-written SCSS with BEM class names in `src/styles/_aac.scss`, colour tokens in
`src/styles/_themes.scss`, and the reset in `src/styles/global.scss`. No CSS framework, no
CSS-in-JS, no component kit.

Every persisted setting follows the localStorage pattern in
`src/controllers/languageController.js`.

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
