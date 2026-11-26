import { useEffect, useState } from 'react';
import { createVault, unlock, unlockWaitSeconds } from '../lib/vault';
import { biometricDisable, biometricEnable, biometricStatus, biometricUnlock } from '../native/bridge';
import { db } from '../lib/db';
import { AuraLogoIcon, EyeIcon, EyeOffIcon, MoonIcon, SunIcon } from '../components/Icons';
import type { ThemeMode } from '../components/AppShell';

interface UnlockProps {
  exists: boolean;
  theme: ThemeMode;
  onToggleTheme: () => void;
  onDone: () => void;
  /** Shown above the form, e.g. after an idle auto-lock. */
  notice?: string;
}

export function Unlock({ exists, theme, onToggleTheme, onDone, notice }: UnlockProps) {
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [waitSec, setWaitSec] = useState(0);
  const [bioOn, setBioOn] = useState(false);
  const [offer, setOffer] = useState<string | null>(null); // password kept briefly to turn fingerprint on

  async function useFingerprint() {
    if (busy || waitSec > 0) return;
    setError('');
    const r = await biometricUnlock();
    if (r.ok && r.secret) {
      setBusy(true);
      try {
        if (await unlock(r.secret)) return onDone();
        await biometricDisable(); // stored secret no longer matches
        setBioOn(false);
        setError('Fingerprint unlock was reset. Please use your password.');
      } finally {
        setBusy(false);
      }
    } else if (r.reset) {
      setBioOn(false);
      setError(r.message ?? 'Fingerprint unlock was reset. Please use your password.');
    }
  }

  // If fingerprint unlock is on, ask for it straight away.
  useEffect(() => {
    if (!exists) return;
    void biometricStatus().then((b) => {
      const on = b.enabled && b.state === 'ready';
      setBioOn(on);
      if (on) void useFingerprint();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exists]);

  async function finishOffer(turnOn: boolean) {
    const secret = offer;
    setOffer(null);
    if (turnOn && secret) {
      const r = await biometricEnable(secret);
      if (!r.ok) await db.meta.put({ key: 'bio-offer', value: 'no' });
    } else {
      await db.meta.put({ key: 'bio-offer', value: 'no' });
    }
    onDone();
  }

  // After several wrong passwords the vault makes you wait. Show a live
  // countdown (it also survives a page reload, because it is stored).
  useEffect(() => {
    if (!exists) return;
    let stop = false;
    const tick = async () => {
      const w = await unlockWaitSeconds();
      if (!stop) setWaitSec(w);
    };
    void tick();
    const id = window.setInterval(() => void tick(), 1000);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
  }, [exists]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || waitSec > 0) return;
    setError('');
    if (!exists && pass !== pass2) {
      setError('The two passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      if (exists) {
        if (await unlock(pass)) {
          const typed = pass;
          setPass('');
          const b = await biometricStatus();
          const asked = (await db.meta.get('bio-offer'))?.value === 'no';
          if (b.state === 'ready' && !b.enabled && !asked) setOffer(typed);
          else onDone();
        } else {
          setError('That password is not right.');
          setWaitSec(await unlockWaitSeconds());
        }
      } else {
        await createVault(pass);
        setPass('');
        setPass2('');
        onDone();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="unlock-screen">
      <div style={{ position: 'fixed', top: 16, right: 16 }}>
        <button
          type="button"
          className="btn ghost icon-only"
          onClick={onToggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <SunIcon size={18} /> : <MoonIcon size={18} />}
        </button>
      </div>

      <form className="unlock-card stack-md" onSubmit={submit}>
        <div className="row center-v gap">
          <div className="aura-logo-mark">
            <AuraLogoIcon size={22} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.45rem', letterSpacing: '0.08em' }}>AURA</h1>
            <p className="xs muted">Personal Intelligence System</p>
          </div>
        </div>

        <p className="small muted">
          {exists
            ? 'Your vault is locked. Enter your password to decrypt your records on this device.'
            : 'Create a password (at least 8 characters). Everything AURA stores is encrypted with a key derived from it.'}
        </p>

        <div className="stack-sm">
          <label htmlFor="vault-password" className="small" style={{ fontWeight: 600 }}>
            Password
          </label>
          <div className="pass-wrap">
            <input
              id="vault-password"
              className="input"
              type={showPass ? 'text' : 'password'}
              placeholder="Enter password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              autoFocus
              autoComplete={exists ? 'current-password' : 'new-password'}
            />
            <button
              type="button"
              className="pass-toggle"
              onClick={() => setShowPass((s) => !s)}
              aria-label={showPass ? 'Hide password' : 'Show password'}
            >
              {showPass ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
            </button>
          </div>
        </div>

        {!exists && (
          <div className="stack-sm">
            <label htmlFor="vault-password-confirm" className="small" style={{ fontWeight: 600 }}>
              Repeat password
            </label>
            <input
              id="vault-password-confirm"
              className="input"
              type={showPass ? 'text' : 'password'}
              placeholder="Repeat password"
              value={pass2}
              onChange={(e) => setPass2(e.target.value)}
              autoComplete="new-password"
            />
          </div>
        )}

        {notice && !error && waitSec === 0 && (
          <div className="status-banner ok" role="status">
            {notice}
          </div>
        )}

        {waitSec > 0 && (
          <div className="status-banner error" role="alert">
            Too many wrong attempts. Try again in {waitSec} second{waitSec === 1 ? '' : 's'}.
          </div>
        )}

        {error && waitSec === 0 && (
          <div className="status-banner error" role="alert">
            {error}
          </div>
        )}

        {offer !== null ? (
          <div className="card-subtle stack-sm">
            <strong>Unlock with your fingerprint next time?</strong>
            <p className="xs muted">
              Your password is locked inside this phone's secure hardware and only released after a fingerprint check.
              You can turn this off any time in Profile → Security.
            </p>
            <div className="row gap">
              <button type="button" className="btn primary" onClick={() => void finishOffer(true)}>
                Turn on
              </button>
              <button type="button" className="btn ghost" onClick={() => void finishOffer(false)}>
                Not now
              </button>
            </div>
          </div>
        ) : (
          <>
            <button type="submit" className="btn primary" disabled={busy || !pass || waitSec > 0}>
              {busy ? 'Unlocking…' : exists ? 'Unlock vault' : 'Create encrypted vault'}
            </button>
            {exists && bioOn && (
              <button type="button" className="btn" onClick={() => void useFingerprint()} disabled={busy || waitSec > 0}>
                Unlock with fingerprint
              </button>
            )}
          </>
        )}

        {!exists && (
          <p className="xs muted">
            There is no password recovery server. If you forget your password, your encrypted data
            cannot be recovered.
          </p>
        )}
      </form>
    </div>
  );
}
