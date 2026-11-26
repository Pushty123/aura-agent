import { useEffect, useState } from 'react';
import { createVault, unlock, unlockWaitSeconds } from '../lib/vault';
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
          setPass('');
          onDone();
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

        <button type="submit" className="btn primary" disabled={busy || !pass || waitSec > 0}>
          {busy ? 'Unlocking…' : exists ? 'Unlock vault' : 'Create encrypted vault'}
        </button>

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
