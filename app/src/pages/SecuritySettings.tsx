import { useEffect, useState } from 'react';
import { biometricDisable, biometricEnable, biometricStatus, type BioState } from '../native/bridge';
import { unlock } from '../lib/vault';
import { getLockAfter, LOCK_OPTIONS, setLockAfter } from '../lib/security';

/** Profile → Security: fingerprint unlock and the auto-lock timer. */
export function SecuritySettings() {
  const [state, setState] = useState<BioState>('web');
  const [enabled, setEnabled] = useState(false);
  const [lockMs, setLockMs] = useState(5 * 60_000);
  const [asking, setAsking] = useState(false);
  const [pass, setPass] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    const b = await biometricStatus();
    setState(b.state);
    setEnabled(b.enabled);
    setLockMs(await getLockAfter());
  };
  useEffect(() => {
    void refresh();
  }, []);

  async function turnOn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      if (!(await unlock(pass))) {
        setMsg({ ok: false, text: 'That password is not right.' });
        return;
      }
      const r = await biometricEnable(pass);
      setPass('');
      setAsking(false);
      setMsg(r.ok ? { ok: true, text: 'Fingerprint unlock is on.' } : { ok: false, text: r.message ?? 'Not turned on.' });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    await biometricDisable();
    setMsg({ ok: true, text: 'Fingerprint unlock is off. Your stored key was deleted.' });
    await refresh();
  }

  async function changeLock(ms: number) {
    await setLockAfter(ms);
    setLockMs(ms);
    setMsg({ ok: true, text: 'Saved. It applies from the next unlock.' });
  }

  const bioText: Record<BioState, string> = {
    web: 'Available in the Android app.',
    ready: enabled ? 'On' : 'Off',
    'not-enrolled': 'Add a fingerprint in your phone settings first.',
    unavailable: 'This phone has no fingerprint sensor that AURA can use.',
  };

  return (
    <article className="card stack-sm">
      <h3 style={{ margin: 0 }}>Security</h3>

      <div className="row between center-v wrap gap">
        <div>
          <strong className="small">Fingerprint unlock</strong>
          <p className="xs muted">{bioText[state]}</p>
        </div>
        {state === 'ready' &&
          (enabled ? (
            <button type="button" className="btn sm ghost" onClick={() => void turnOff()}>
              Turn off
            </button>
          ) : (
            <button type="button" className="btn sm" onClick={() => setAsking((a) => !a)}>
              Turn on
            </button>
          ))}
      </div>
      {asking && (
        <form className="row gap" onSubmit={turnOn}>
          <input
            className="input"
            type="password"
            autoComplete="current-password"
            placeholder="Your AURA password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            aria-label="Your AURA password"
          />
          <button type="submit" className="btn primary" disabled={busy || !pass}>
            Confirm
          </button>
        </form>
      )}

      <label className="stack-sm">
        <strong className="small">Lock automatically after</strong>
        <select className="input" value={lockMs} onChange={(e) => void changeLock(Number(e.target.value))}>
          {LOCK_OPTIONS.map((o) => (
            <option key={o.ms} value={o.ms}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      {msg && <div className={`status-banner ${msg.ok ? 'ok' : 'error'}`}>{msg.text}</div>}
      <p className="xs muted">
        With fingerprint unlock on, your password is kept encrypted by the phone's secure hardware and is only released
        after a fingerprint check. If fingerprints on the phone change, it switches itself off.
      </p>
    </article>
  );
}
