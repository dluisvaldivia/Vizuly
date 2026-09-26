import { useEffect, useMemo, useRef, useState } from 'react';

import { exportCorrections, pictogramImageUrl } from '../../aac/useAac.ts';
import {
  MAX_SENSITIVITY_DB,
  MIN_SENSITIVITY_DB,
} from '../../controllers/micSensitivityController.js';
import { getInitialTheme, setTheme } from '../../controllers/themeController.js';
import { BANDS, newChildId } from '../../controllers/childrenController.js';
import { listMicrophones } from '../../speech/useSpeech.ts';

/**
 * Adult-only settings.
 *
 * Reached by a long press on the title, never by a visible button, so the child
 * cannot wander in. Everything here is adult-facing, so plain text is fine:
 * this is the one place in the app where reading is expected.
 */
export default function AdultPanel({
  open,
  onClose,
  lang,
  onForgetAll,
  corrections,
  onUndoCorrection,
  readingTier,
  onReadingTierChange,
  syllableMode,
  onSyllableModeChange,
  liveVoice,
  onLiveVoiceChange,
  voiceBudget,
  micSensitivity,
  onMicSensitivityChange,
  micDevice,
  onMicDeviceChange,
  openedMic,
  micGain,
  onMicGainChange,
  levelReadout,
  onLevelReadoutChange,
  profiles,
  onProfilesChange,
  onClearRatings,
  favorites,
  onRemoveFavorite,
  onClearFavorites,
}) {
  const [newName, setNewName] = useState('');
  const [newAge, setNewAge] = useState(BANDS[0]);

  function addChild() {
    const name = newName.trim();
    if (!name) return;
    const child = { id: newChildId(), name, age: newAge };
    onProfilesChange({ active: child.id, children: [...profiles.children, child] });
    setNewName('');
  }

  function removeChild(id) {
    onProfilesChange({
      active: profiles.active === id ? null : profiles.active,
      children: profiles.children.filter((c) => c.id !== id),
    });
  }
  const closeRef = useRef(null);
  const [showJson, setShowJson] = useState(false);
  const [copied, setCopied] = useState(false);

  /**
   * Built when the export is opened, not on every render, so the timestamp
   * inside it does not change under the adult while they are copying it.
   */
  const exported = useMemo(
    () => (showJson ? exportCorrections() : ''),
    // exportCorrections reads storage rather than taking an argument, so the
    // linter cannot see that `corrections` is what changes its result. It is in
    // the deps so that undoing an entry while the export is open does not leave
    // stale text on screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [showJson, corrections],
  );

  /**
   * The microphones the browser can see. Read when the panel opens and again
   * whenever one is plugged in or out, so the list is never stale.
   */
  const [microphones, setMicrophones] = useState(null);
  useEffect(() => {
    if (!open) return undefined;

    let current = true;
    const refresh = () => {
      void listMicrophones().then((list) => {
        if (current) setMicrophones(list);
      });
    };
    refresh();

    const devices = typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined;
    devices?.addEventListener?.('devicechange', refresh);
    return () => {
      current = false;
      devices?.removeEventListener?.('devicechange', refresh);
    };
  }, [open]);

  // Without permission the browser hides the names, and a list of blank
  // entries helps nobody.
  // Null until the first read, so the saved mic is not called "not connected"
  // in the moment before the list arrives.
  const listLoaded = microphones !== null;
  const namedMicrophones = (microphones ?? []).filter((mic) => mic.label);

  // The saved mic as it appears in today's list: by id, or by name when the
  // browser has changed its ids since it was chosen.
  const selectedMic =
    namedMicrophones.find((mic) => mic.deviceId === micDevice.deviceId) ??
    (micDevice.label ? namedMicrophones.find((mic) => mic.label === micDevice.label) : undefined);
  const selectedValue = micDevice.deviceId ? (selectedMic?.deviceId ?? micDevice.deviceId) : '';

  // A fresh export has not been copied yet.
  useEffect(() => {
    setCopied(false);
  }, [exported]);

  const labels = {
    es: {
      title: 'Ajustes',
      theme: 'Tema',
      toggleTheme: 'Cambiar tema',
      readingTier: 'Palabras de enlace',
      readingTierHelp:
        'Cuántas palabras de enlace aparecen cuando el modo lectura está activado, con el botón de la cabecera. No cambia nada mientras esté desactivado.',
      tierConnectors: 'Solo enlaces (a, y, en, de, con)',
      tierArticles: 'Enlaces y artículos (el, la, un)',
      tierClitics: 'Enlaces, artículos y pronombres (me, te, se)',
      tierCliticsHelp:
        'El nivel menos preciso: "me" muestra el pictograma de YO, y "se" comparte símbolo con "le".',
      mic: 'Micrófono',
      micDevice: 'Micrófono que se usa',
      micDeviceDefault: 'Predeterminado del sistema',
      micDeviceUnknown: 'Micrófono guardado (no conectado)',
      micDeviceNotConnected: 'no conectado',
      micDeviceHelp:
        'Si el botón se pone verde pero no oye nada, elige aquí el micrófono correcto. Firefox abre el predeterminado del sistema al recargar, aunque en su aviso se eligiera otro. Si el elegido no está conectado, se usa el predeterminado.',
      micDeviceNoNames: 'Usa el micrófono una vez para ver la lista.',
      micDeviceOpened: (label) => `Última vez se abrió: ${label}.`,
      micSensitivity: 'Volumen mínimo de voz',
      micSensitivityHelp:
        'A partir de qué volumen cuenta su voz. La barra junto al botón se pone verde en este punto. Más a la izquierda, más sensible: el micrófono capta una voz más floja, pero también más ruido de la sala.',
      micSensitivityValue: (db) => `${db} dB`,
      micMoreSensitive: 'Más sensible',
      micLessSensitive: 'Menos sensible',
      micGain: 'Ajuste automático del volumen',
      micGainOn: 'Sí',
      micGainOff: 'No',
      micGainHelp:
        'Con el ajuste, el navegador sube el micrófono cuando hay silencio, así que la primera palabra sale más fuerte de lo que fue y la barra salta antes de bajar a su volumen real. Sin él, la barra muestra su volumen real desde el principio. Si una voz muy suave deja de reconocerse, prueba a activarlo. Al cambiarlo, vuelve a ajustar el volumen mínimo. Se aplica la próxima vez que se abra el micrófono.',
      levelReadout: 'Mostrar el número',
      levelReadoutOn: 'Sí',
      levelReadoutOff: 'No',
      levelReadoutHelp:
        'Muestra el volumen en dB junto a la barra mientras el micrófono está abierto, para ajustar el valor de arriba con su voz real. Quítalo cuando ya esté ajustado.',
      children: 'Niños',
      childrenHelp: 'El nombre sale en el modo juego y la edad elige qué cartas de letras aparecen.',
      noChildren: 'Sin niños: cartas de 3 a 5 años y turno sin nombre.',
      childName: 'Nombre',
      childAge: 'Edad',
      add: 'Añadir',
      remove: 'Quitar',
      removeName: (n) => `Quitar a ${n}`,
      bands: { 3: '3 a 5 años', 6: '6 a 8 años', 9: '9 a 11 años' },
      clearRatings: 'Borrar valoraciones de este niño',
      clearRatingsHelp: 'Las cartas vuelven a salir en orden aleatorio.',
      favorites: 'Favoritos',
      favoritesHelp:
        'Lo que se ha guardado con la estrella. Quitar un favorito solo se puede hacer aquí.',
      noFavorites: 'Todavía no hay favoritos.',
      removeFavorite: 'Quitar',
      clearFavorites: 'Borrar favoritos de este niño',
      voice: 'Voz',
      voiceHelp: 'Qué se oye al tocar un pictograma.',
      syllablesOn: 'Palabra y sílabas ("cabeza, ca-be-za")',
      syllablesOff: 'Palabra sola ("cabeza")',
      liveVoice: 'Voz para palabras nuevas',
      liveVoiceOn: 'Activada',
      liveVoiceOff: 'Desactivada',
      liveVoiceHelp:
        'Las palabras de la lista ya tienen voz grabada y no cuestan nada. Activar esto graba también las palabras nuevas, usando crédito de Deepgram, con un tope diario.',
      liveVoiceUsage: (used, limit) => `Usadas hoy: ${used} de ${limit}.`,
      cache: 'Pictogramas guardados',
      forget: 'Borrar pictogramas guardados',
      forgetHelp:
        'Vuelve a buscar cada palabra. Tus correcciones se conservan.',
      corrections: 'Correcciones',
      correctionsHelp:
        'Mantén pulsado un pictograma para corregirlo. Aquí puedes deshacerlo.',
      noCorrections: 'Todavía no hay correcciones.',
      pinned: 'Pictograma fijado',
      ignored: 'Palabra ignorada',
      flagged: 'Marcada para revisar',
      undo: 'Deshacer',
      showJson: 'Exportar correcciones',
      hideJson: 'Ocultar exportación',
      jsonHelp:
        'Todo lo corregido, ignorado y marcado, en las dos lenguas. Tócalo para seleccionarlo todo y cópialo. Es la única forma de sacar esto del dispositivo.',
      copy: 'Copiar',
      copied: 'Copiado',
      close: 'Cerrar',
    },
    en: {
      title: 'Settings',
      theme: 'Theme',
      toggleTheme: 'Switch theme',
      readingTier: 'Linking words',
      readingTierHelp:
        'How many linking words appear when reading mode is on, using the header button. Changes nothing while it is off.',
      tierConnectors: 'Links only (to, and, in, of, with)',
      tierArticles: 'Links and articles (the, a, an)',
      tierClitics: 'Links, articles and possessives (my, your, his)',
      tierCliticsHelp:
        'The least precise tier: these borrow pronoun pictograms rather than having symbols of their own.',
      mic: 'Microphone',
      micDevice: 'Microphone in use',
      micDeviceDefault: 'System default',
      micDeviceUnknown: 'Saved microphone (not connected)',
      micDeviceNotConnected: 'not connected',
      micDeviceHelp:
        'If the button turns green but hears nothing, pick the right microphone here. Firefox opens the system default on reload, even when another one was chosen in its prompt. If the chosen one is not plugged in, the default is used.',
      micDeviceNoNames: 'Use the microphone once to see the list.',
      micDeviceOpened: (label) => `Last opened: ${label}.`,
      micSensitivity: 'Minimum speaking volume',
      micSensitivityHelp:
        'How loud the voice has to be to count. The bar beside the button turns green at this point. Further left is more sensitive: it picks up a quieter voice, and more of the room with it.',
      micSensitivityValue: (db) => `${db} dB`,
      micMoreSensitive: 'More sensitive',
      micLessSensitive: 'Less sensitive',
      micGain: 'Automatic volume adjustment',
      micGainOn: 'Yes',
      micGainOff: 'No',
      micGainHelp:
        'With it on, the browser turns the mic up while the room is quiet, so the first word comes in louder than it was said and the bar jumps before dropping to the real level. With it off, the bar shows the real level from the start. If a very soft voice stops being recognised, try turning it on. Set the minimum speaking volume again after changing this. Applies the next time the mic is opened.',
      levelReadout: 'Show the number',
      levelReadoutOn: 'Yes',
      levelReadoutOff: 'No',
      levelReadoutHelp:
        'Shows the level in dB beside the bar while the mic is open, so the value above can be set against the real voice. Turn it off once it is set.',
      children: 'Children',
      childrenHelp: 'The name shows in game mode and the age picks which letter cards appear.',
      noChildren: 'No children: cards for ages 3 to 5 and an unnamed turn.',
      childName: 'Name',
      childAge: 'Age',
      add: 'Add',
      remove: 'Remove',
      removeName: (n) => `Remove ${n}`,
      bands: { 3: 'Ages 3 to 5', 6: 'Ages 6 to 8', 9: 'Ages 9 to 11' },
      clearRatings: 'Clear ratings for this child',
      clearRatingsHelp: 'Cards go back to random order.',
      favorites: 'Favourites',
      favoritesHelp: 'What the star has saved. Removing one can only be done here.',
      noFavorites: 'No favourites yet.',
      removeFavorite: 'Remove',
      clearFavorites: 'Clear favourites for this child',
      voice: 'Voice',
      voiceHelp: 'What a tap on a pictogram says.',
      syllablesOn: 'Word and syllables ("cabeza, ca-be-za")',
      syllablesOff: 'Word only ("cabeza")',
      liveVoice: 'Voice for new words',
      liveVoiceOn: 'On',
      liveVoiceOff: 'Off',
      liveVoiceHelp:
        'Words on the list already have a recorded voice and cost nothing. Turning this on records new words too, using Deepgram credit, with a daily cap.',
      liveVoiceUsage: (used, limit) => `Used today: ${used} of ${limit}.`,
      cache: 'Saved pictograms',
      forget: 'Clear saved pictograms',
      forgetHelp: 'Looks every word up again. Your corrections are kept.',
      corrections: 'Corrections',
      correctionsHelp: 'Long press a pictogram to fix it. Undo it here.',
      noCorrections: 'No corrections yet.',
      pinned: 'Pictogram pinned',
      ignored: 'Word ignored',
      flagged: 'Flagged for review',
      undo: 'Undo',
      showJson: 'Export corrections',
      hideJson: 'Hide export',
      jsonHelp:
        'Everything pinned, ignored and flagged, both languages. Tap it to select all, then copy. This is the only way to get any of it off the device.',
      copy: 'Copy',
      copied: 'Copied',
      close: 'Close',
    },
  }[lang];

  // Move focus into the dialog when it opens, so keyboard and screen reader
  // users land in the right place.
  useEffect(() => {
    if (open) closeRef.current?.focus();
  }, [open]);

  // Escape closes, as a dialog should.
  useEffect(() => {
    if (!open) return undefined;

    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="adult-panel__backdrop" onClick={onClose}>
      <div
        className="adult-panel"
        role="dialog"
        aria-modal="true"
        aria-label={labels.title}
        // Clicks inside must not close the dialog.
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="adult-panel__title">{labels.title}</h2>

        <fieldset className="adult-panel__group">
          <legend>{labels.theme}</legend>
          <button
            type="button"
            onClick={() => setTheme(getInitialTheme() === 'light' ? 'dark' : 'light')}
          >
            {labels.toggleTheme}
          </button>
        </fieldset>

        {/* Children. One active at a time: the name for game mode, the age
            band for the letter cards. Adult-only, like everything here. */}
        <fieldset className="adult-panel__group">
          <legend>{labels.children}</legend>
          <p className="adult-panel__help">{labels.childrenHelp}</p>

          {profiles.children.length === 0 ? (
            <p className="adult-panel__help">{labels.noChildren}</p>
          ) : (
            profiles.children.map((child) => (
              <div key={child.id} className="adult-panel__child">
                <label className="adult-panel__radio">
                  <input
                    type="radio"
                    name="active-child"
                    value={child.id}
                    checked={profiles.active === child.id}
                    onChange={() => onProfilesChange({ ...profiles, active: child.id })}
                  />
                  <span>
                    {child.name} <span className="adult-panel__child-age">({labels.bands[child.age]})</span>
                  </span>
                </label>
                <button type="button" onClick={() => removeChild(child.id)} aria-label={labels.removeName(child.name)}>
                  {labels.remove}
                </button>
              </div>
            ))
          )}

          <div className="adult-panel__child-add">
            <label className="adult-panel__slider-label" htmlFor="child-name">
              {labels.childName}
            </label>
            <input
              id="child-name"
              type="text"
              className="adult-panel__text"
              maxLength={24}
              autoComplete="off"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  addChild();
                }
              }}
            />
            <label className="adult-panel__slider-label" htmlFor="child-age">
              {labels.childAge}
            </label>
            <select
              id="child-age"
              className="adult-panel__select"
              value={newAge}
              onChange={(event) => setNewAge(Number(event.target.value))}
            >
              {BANDS.map((band) => (
                <option key={band} value={band}>
                  {labels.bands[band]}
                </option>
              ))}
            </select>
            <button type="button" onClick={addChild} disabled={!newName.trim()}>
              {labels.add}
            </button>
          </div>

          <button type="button" onClick={onClearRatings}>
            {labels.clearRatings}
          </button>
          <p className="adult-panel__help">{labels.clearRatingsHelp}</p>
        </fieldset>

        {/* Reading tier. Lives here rather than in the header because it is a
            calibration an adult sets once, not something to flip back and
            forth. The mode itself is a header button. */}
        <fieldset className="adult-panel__group">
          <legend>{labels.readingTier}</legend>
          <p className="adult-panel__help">{labels.readingTierHelp}</p>

          {[
            { value: 'connectors', label: labels.tierConnectors },
            { value: 'articles', label: labels.tierArticles },
            { value: 'clitics', label: labels.tierClitics },
          ].map((tier) => (
            <label key={tier.value} className="adult-panel__radio">
              <input
                type="radio"
                name="reading-tier"
                value={tier.value}
                checked={readingTier === tier.value}
                onChange={() => onReadingTierChange(tier.value)}
              />
              {/* The name carries the state, never colour alone. */}
              <span>{tier.label}</span>
            </label>
          ))}

          {readingTier === 'clitics' ? (
            <p className="adult-panel__help">{labels.tierCliticsHelp}</p>
          ) : null}
        </fieldset>

        {/* Microphone sensitivity. A calibration made once against the actual
            voice, which is exactly what belongs behind the gesture. The readout
            switch sits with it because the readout exists to set this value. */}
        <fieldset className="adult-panel__group">
          <legend>{labels.mic}</legend>

          <label className="adult-panel__slider-label" htmlFor="mic-device">
            {labels.micDevice}
          </label>
          <select
            id="mic-device"
            className="adult-panel__select"
            value={selectedValue}
            onChange={(event) => {
              const picked = namedMicrophones.find((mic) => mic.deviceId === event.target.value);
              onMicDeviceChange(picked ? { deviceId: picked.deviceId, label: picked.label } : { deviceId: '', label: '' });
            }}
          >
            <option value="">{labels.micDeviceDefault}</option>
            {namedMicrophones.map((mic) => (
              <option key={mic.deviceId} value={mic.deviceId}>
                {mic.label}
              </option>
            ))}
            {/* The saved one, even when it is not plugged in right now, so the
                select never silently shows a different value from the one in use. */}
            {micDevice.deviceId && !selectedMic ? (
              <option value={micDevice.deviceId}>
                {!micDevice.label
                  ? labels.micDeviceUnknown
                  : listLoaded
                    ? `${micDevice.label} (${labels.micDeviceNotConnected})`
                    : micDevice.label}
              </option>
            ) : null}
          </select>
          <p className="adult-panel__help adult-panel__help--spaced">
            {openedMic ? `${labels.micDeviceOpened(openedMic)} ` : ''}
            {listLoaded && namedMicrophones.length === 0 ? `${labels.micDeviceNoNames} ` : ''}
            {labels.micDeviceHelp}
          </p>

          <label className="adult-panel__slider-label" htmlFor="mic-sensitivity">
            {labels.micSensitivity}: {labels.micSensitivityValue(micSensitivity)}
          </label>
          <input
            id="mic-sensitivity"
            className="adult-panel__slider"
            type="range"
            min={MIN_SENSITIVITY_DB}
            max={MAX_SENSITIVITY_DB}
            step={1}
            value={micSensitivity}
            onChange={(event) => onMicSensitivityChange(Number(event.target.value))}
          />
          {/* The ends named in words, because a bare dB number means nothing
              without knowing which way is louder. */}
          <p className="adult-panel__slider-ends" aria-hidden="true">
            <span>{labels.micMoreSensitive}</span>
            <span>{labels.micLessSensitive}</span>
          </p>
          <p className="adult-panel__help">{labels.micSensitivityHelp}</p>

          {/* Beside the slider because it changes what the slider measures: a
              floor set with the browser boosting the mic is wrong without it. */}
          <fieldset className="adult-panel__subgroup">
            <legend>{labels.micGain}</legend>
            {[
              { value: 'on', label: labels.micGainOn },
              { value: 'off', label: labels.micGainOff },
            ].map((option) => (
              <label key={option.value} className="adult-panel__radio">
                <input
                  type="radio"
                  name="mic-gain"
                  value={option.value}
                  checked={micGain === option.value}
                  onChange={() => onMicGainChange(option.value)}
                />
                <span>{option.label}</span>
              </label>
            ))}
            <p className="adult-panel__help">{labels.micGainHelp}</p>
          </fieldset>

          <fieldset className="adult-panel__subgroup">
            <legend>{labels.levelReadout}</legend>
            {[
              { value: 'on', label: labels.levelReadoutOn },
              { value: 'off', label: labels.levelReadoutOff },
            ].map((option) => (
              <label key={option.value} className="adult-panel__radio">
                <input
                  type="radio"
                  name="level-readout"
                  value={option.value}
                  checked={levelReadout === option.value}
                  onChange={() => onLevelReadoutChange(option.value)}
                />
                <span>{option.label}</span>
              </label>
            ))}
            <p className="adult-panel__help">{labels.levelReadoutHelp}</p>
          </fieldset>
        </fieldset>

        {/* Voice. Same reasoning as the reading tier: a calibration an adult
            makes for how the child is working now, not a control to flip back and
            forth, so it lives behind the gesture rather than in the header. */}
        <fieldset className="adult-panel__group">
          <legend>{labels.voice}</legend>
          <p className="adult-panel__help">{labels.voiceHelp}</p>

          {[
            { value: 'on', label: labels.syllablesOn },
            { value: 'off', label: labels.syllablesOff },
          ].map((option) => (
            <label key={option.value} className="adult-panel__radio">
              <input
                type="radio"
                name="syllable-mode"
                value={option.value}
                checked={syllableMode === option.value}
                onChange={() => onSyllableModeChange(option.value)}
              />
              {/* The name carries the state, never colour alone. */}
              <span>{option.label}</span>
            </label>
          ))}
        </fieldset>

        {/* Live generation. Off by default and deliberately separate from the
            setting above: this one spends money, and it should never be
            switched on by someone who was aiming at the syllables. */}
        <fieldset className="adult-panel__group">
          <legend>{labels.liveVoice}</legend>
          <p className="adult-panel__help">{labels.liveVoiceHelp}</p>

          {[
            { value: 'off', label: labels.liveVoiceOff },
            { value: 'on', label: labels.liveVoiceOn },
          ].map((option) => (
            <label key={option.value} className="adult-panel__radio">
              <input
                type="radio"
                name="live-voice"
                value={option.value}
                checked={liveVoice === option.value}
                onChange={() => onLiveVoiceChange(option.value)}
              />
              <span>{option.label}</span>
            </label>
          ))}

          {liveVoice === 'on' ? (
            <p className="adult-panel__help">
              {labels.liveVoiceUsage(voiceBudget.used, voiceBudget.limit)}
            </p>
          ) : null}
        </fieldset>

        <fieldset className="adult-panel__group">
          <legend>{labels.cache}</legend>
          <button type="button" onClick={onForgetAll}>
            {labels.forget}
          </button>
          <p className="adult-panel__help">{labels.forgetHelp}</p>
        </fieldset>

        {/* Saved words and phrases. The star can take one back off while it is
            still on screen; this is where every older one is removed, which is
            what makes the star safe to leave within the child's reach. Both
            languages, so nothing is invisible just because the header flag is
            the other way. */}
        <fieldset className="adult-panel__group">
          <legend>{labels.favorites}</legend>
          <p className="adult-panel__help">{labels.favoritesHelp}</p>

          {favorites.length === 0 ? (
            <p className="adult-panel__help">{labels.noFavorites}</p>
          ) : (
            <ul className="adult-panel__corrections">
              {favorites.map((favorite) => (
                <li key={`${favorite.lang}.${favorite.text}`} className="adult-panel__correction">
                  <span className="adult-panel__correction-word">
                    {favorite.text} <span lang="en">({favorite.lang})</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => onRemoveFavorite(favorite.text, favorite.lang)}
                    aria-label={`${labels.removeFavorite}: ${favorite.text}`}
                  >
                    {labels.removeFavorite}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <button type="button" onClick={onClearFavorites} disabled={favorites.length === 0}>
            {labels.clearFavorites}
          </button>
        </fieldset>

        {/* The review list. This is the only place a flag is visible, and the
            only place a correction can be taken back, which is what makes the
            long-press fix gesture safe to leave within the child's reach. */}
        <fieldset className="adult-panel__group">
          <legend>{labels.corrections}</legend>
          <p className="adult-panel__help">{labels.correctionsHelp}</p>

          {corrections.length === 0 ? (
            <p className="adult-panel__help">{labels.noCorrections}</p>
          ) : (
            <ul className="adult-panel__corrections">
              {corrections.map((entry) => (
                <li key={`${entry.lang}.${entry.word}`} className="adult-panel__correction">
                  {entry.correction.kind === 'pin' ? (
                    <img
                      className="adult-panel__correction-image"
                      src={pictogramImageUrl(entry.correction.pictogramId, 300)}
                      alt=""
                      draggable="false"
                      loading="lazy"
                    />
                  ) : (
                    <span className="adult-panel__correction-image" aria-hidden="true" />
                  )}

                  <span className="adult-panel__correction-word">
                    {entry.word} <span lang="en">({entry.lang})</span>
                  </span>

                  {/* Kind in words, never colour or icon alone. */}
                  <span className="adult-panel__correction-kind">
                    {entry.correction.kind === 'pin'
                      ? labels.pinned
                      : entry.correction.kind === 'ignore'
                        ? labels.ignored
                        : labels.flagged}
                  </span>

                  <button
                    type="button"
                    onClick={() => onUndoCorrection(entry.word)}
                    aria-label={`${labels.undo}: ${entry.word}`}
                  >
                    {labels.undo}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <button type="button" onClick={() => setShowJson((shown) => !shown)}>
            {showJson ? labels.hideJson : labels.showJson}
          </button>

          {showJson ? (
            <>
              <p className="adult-panel__help">{labels.jsonHelp}</p>
              {/* The textarea is the export, and the copy button is a
                  convenience on top of it. Never the other way round: the
                  clipboard call fails silently in enough browsers that
                  selectable text has to be the thing that always works. */}
              <textarea
                className="adult-panel__json"
                readOnly
                rows={8}
                value={exported}
                aria-label={labels.showJson}
                // Selecting a long JSON blob by dragging on a tablet is
                // miserable. One tap selects the lot.
                onFocus={(event) => event.target.select()}
                onClick={(event) => event.target.select()}
              />
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard
                    ?.writeText(exported)
                    .then(() => setCopied(true))
                    // Blocked, insecure context, or unsupported. The textarea
                    // above is still there and still selectable.
                    .catch(() => setCopied(false));
                }}
              >
                {copied ? labels.copied : labels.copy}
              </button>
            </>
          ) : null}
        </fieldset>

        <button type="button" className="adult-panel__close" onClick={onClose} ref={closeRef}>
          {labels.close}
        </button>
      </div>
    </div>
  );
}
