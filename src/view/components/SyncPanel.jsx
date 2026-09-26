import { useState } from 'react';

import {
  createPairCode,
  forgetAccount,
  getAccount,
  applySnapshot,
  redeemPairCode,
  syncAvailable,
} from '../../controllers/syncController.js';

/**
 * Pairing two devices, inside the adult panel.
 *
 * No accounts and no login: one device shows a six digit code, the other types
 * it, and both keep the same profiles, favourites, ratings and corrections. A
 * child's profile is not worth a password (ROADMAP, "pairing, not accounts").
 *
 * Renders nothing when VITE_SYNC_URL is unset, so a build with no Worker behind
 * it shows no dead controls.
 */
export default function SyncPanel({ lang }) {
  const [account, setAccount] = useState(getAccount);
  const [code, setCode] = useState('');
  const [typed, setTyped] = useState('');
  const [status, setStatus] = useState('');

  if (!syncAvailable()) return null;

  const t = LABELS[lang] ?? LABELS.es;

  async function showCode() {
    setStatus(t.working);
    try {
      const fresh = await createPairCode();
      setCode(fresh);
      setAccount(getAccount());
      setStatus('');
    } catch {
      setStatus(t.failed);
    }
  }

  async function join(event) {
    event.preventDefault();
    setStatus(t.working);
    const remote = await redeemPairCode(typed).catch(() => null);
    if (!remote) {
      forgetAccount();
      setStatus(t.badCode);
      return;
    }
    applySnapshot(remote);
    // Every controller reads storage once on init, so a reload is how the
    // pulled profiles, favourites and corrections actually appear.
    window.location.reload();
  }

  function stop() {
    forgetAccount();
    setAccount(null);
    setCode('');
    setStatus(t.stopped);
  }

  return (
    <fieldset className="adult-panel__group">
      <legend>{t.title}</legend>
      <p className="adult-panel__help">{t.help}</p>

      <p className="adult-panel__help">{account ? t.on : t.off}</p>

      <button type="button" onClick={showCode}>
        {t.showCode}
      </button>
      {/* Announced, because the code appears after a request rather than a tap. */}
      <p className="adult-panel__help" aria-live="polite">
        {code ? `${t.codeIs} ${code} ${t.codeExpires}` : ''}
      </p>

      <form onSubmit={join}>
        <label className="adult-panel__slider-label" htmlFor="sync-code">
          {t.joinLabel}
        </label>
        <input
          id="sync-code"
          type="text"
          className="adult-panel__text"
          inputMode="numeric"
          autoComplete="off"
          pattern="[0-9]{6}"
          maxLength={6}
          value={typed}
          onChange={(event) => setTyped(event.target.value.replace(/\D/gu, ''))}
        />
        <button type="submit" disabled={typed.length !== 6}>
          {t.join}
        </button>
      </form>

      {account ? (
        <button type="button" onClick={stop}>
          {t.stop}
        </button>
      ) : null}

      <p className="adult-panel__help" aria-live="polite">
        {status}
      </p>
    </fieldset>
  );
}

const LABELS = {
  es: {
    title: 'Compartir entre dispositivos',
    help: 'Los niños, los favoritos, las valoraciones y las correcciones se guardan también fuera de este dispositivo, para tenerlos en el móvil y en la tablet. Los pictogramas guardados no se comparten: se vuelven a buscar solos.',
    on: 'Activado en este dispositivo.',
    off: 'Solo en este dispositivo.',
    showCode: 'Mostrar código para otro dispositivo',
    codeIs: 'Código:',
    codeExpires: '(vale 10 minutos, un solo uso)',
    joinLabel: 'Tengo un código de otro dispositivo',
    join: 'Unir este dispositivo',
    stop: 'Dejar de compartir en este dispositivo',
    stopped: 'Ya no se comparte. Lo guardado aquí se queda aquí.',
    working: 'Un momento...',
    failed: 'No se pudo conectar. Todo sigue funcionando en este dispositivo.',
    badCode: 'Ese código no vale o ya caducó.',
  },
  en: {
    title: 'Share between devices',
    help: 'Children, favourites, ratings and corrections are kept off this device too, so the phone and the tablet show the same thing. Saved pictograms are not shared: they are looked up again on their own.',
    on: 'On for this device.',
    off: 'This device only.',
    showCode: 'Show a code for another device',
    codeIs: 'Code:',
    codeExpires: '(good for 10 minutes, one use)',
    joinLabel: 'I have a code from another device',
    join: 'Join this device',
    stop: 'Stop sharing on this device',
    stopped: 'No longer shared. What is saved here stays here.',
    working: 'One moment...',
    failed: 'Could not connect. Everything still works on this device.',
    badCode: 'That code is wrong or has expired.',
  },
};
