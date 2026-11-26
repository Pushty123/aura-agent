import { useState } from 'react';
import { createVault, unlock } from '../lib/vault';
import { AuraLogoIcon, EyeIcon, EyeOffIcon, MoonIcon, SunIcon } from '../components/Icons';
import type { ThemeMode } from '../components/AppShell';

interface UnlockProps {
  exists: boolean;
  theme: ThemeMode;
  onToggleTheme: () => void;
  onDone: () => void;
}

export function Unlock({ exists, theme, onToggleTheme, onDone }: UnlockProps) {
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError('');
    if (!exists && pass !== pass2) {
      setError('The two passphrases do not match.');
      return;
    }
    setBusy(true);
    try {
      if (exists) {
        if (await unlock(pass)) {
          setPass('');
          onDone();
        } else {
          setError('That passphrase is not right.');
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
            ? 'Your vault is locked. Enter your passphrase to decrypt your records on this device.'
            : 'Create a passphrase (at least 8 characters). Everything AURA stores is encrypted with a key derived from it.'}
        </p>

        <div className="stack-sm">
          <label htmlFor="vault-passphrase" className="small" style={{ fontWeight: 600 }}>
            Passphrase
          </label>
          <div className="pass-wrap">
            <input
              id="vault-passphrase"
              className="input"
              type={showPass ? 'text' : 'password'}
              placeholder="Enter passphrase"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              autoFocus
              autoComplete={exists ? 'current-password' : 'new-password'}
            />
            <button
              type="button"
              className="pass-toggle"
              onClick={() => setShowPass((s) => !s)}
              aria-label={showPass ? 'Hide passphrase' : 'Show passphrase'}
            >
              {showPass ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
            </button>
          </div>
        </div>

        {!exists && (
          <div className="stack-sm">
            <label htmlFor="vault-passphrase-confirm" className="small" style={{ fontWeight: 600 }}>
              Repeat passphrase
            </label>
            <input
              id="vault-passphrase-confirm"
              className="input"
              type={showPass ? 'text' : 'password'}
              placeholder="Repeat passphrase"
              value={pass2}
              onChange={(e) => setPass2(e.target.value)}
              autoComplete="new-password"
            />
          </div>
        )}

        {error && (
          <div className="status-banner error" role="alert">
            {error}
          </div>
        )}

        <button type="submit" className="btn primary" disabled={busy || !pass}>
          {busy ? 'Unlocking…' : exists ? 'Unlock vault' : 'Create encrypted vault'}
        </button>

        {!exists && (
          <p className="xs muted">
            There is no password recovery server. If you forget your passphrase, your encrypted data
            cannot be recovered.
          </p>
        )}
      </form>
    </div>
  );
}
