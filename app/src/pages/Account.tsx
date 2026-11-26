import { useState } from 'react';
import { AuraLogoIcon, EyeIcon, EyeOffIcon, MoonIcon, SunIcon } from '../components/Icons';
import type { ThemeMode } from '../components/AppShell';
import { DEFAULT_SERVER, getServer, login, noteSignedIn, register, setServer, verify } from '../lib/account';
import { createVault } from '../lib/vault';

type Mode = 'signup' | 'verify' | 'login';

interface Props {
  theme: ThemeMode;
  onToggleTheme: () => void;
  onDone: () => void;
}

export function Account({ theme, onToggleTheme, onDone }: Props) {
  const [mode, setMode] = useState<Mode>('signup');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [code, setCode] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const [showServer, setShowServer] = useState(false);
  const [server, setServerInput] = useState(DEFAULT_SERVER);

  async function openServer() {
    setServerInput(await getServer());
    setShowServer((s) => !s);
  }

  async function finish(userEmail: string) {
    await createVault(pass);
    await noteSignedIn(userEmail);
    setPass('');
    setPass2('');
    onDone();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError('');
    setInfo('');
    try {
      if (showServer) await setServer(server);
      if (mode === 'signup') {
        if (pass.length < 8) throw new Error('Use a password of at least 8 characters.');
        if (pass !== pass2) throw new Error('The two passwords do not match.');
      }
      setBusy(true);
      if (mode === 'signup') {
        const r = await register(email, pass);
        setMode('verify');
        setInfo(
          r.emailed
            ? `We sent a 6-digit code to ${r.email}.`
            : r.dev_code
              ? `Demo mode: the server cannot send email, so your code is ${r.dev_code}.`
              : 'Enter the 6-digit code we sent you.',
        );
      } else if (mode === 'verify') {
        const s = await verify(email, code.trim());
        await finish(s.email);
      } else {
        const s = await login(email, pass);
        await finish(s.email);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  const title = mode === 'signup' ? 'Create your account' : mode === 'verify' ? 'Verify your email' : 'Welcome back';

  return (
    <div className="unlock-screen">
      <div style={{ position: 'fixed', top: 16, right: 16 }}>
        <button type="button" className="btn ghost icon-only" onClick={onToggleTheme} aria-label="Toggle theme">
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

        <h2 style={{ margin: 0 }}>{title}</h2>

        {mode !== 'verify' && (
          <>
            <div className="stack-sm">
              <label htmlFor="acc-email" className="small" style={{ fontWeight: 600 }}>
                Email
              </label>
              <input
                id="acc-email"
                className="input"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
              />
            </div>

            <div className="stack-sm">
              <label htmlFor="acc-pass" className="small" style={{ fontWeight: 600 }}>
                Password
              </label>
              <div className="pass-wrap">
                <input
                  id="acc-pass"
                  className="input"
                  type={showPass ? 'text' : 'password'}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  placeholder="At least 8 characters"
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
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

            {mode === 'signup' && (
              <div className="stack-sm">
                <label htmlFor="acc-pass2" className="small" style={{ fontWeight: 600 }}>
                  Repeat password
                </label>
                <input
                  id="acc-pass2"
                  className="input"
                  type={showPass ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={pass2}
                  onChange={(e) => setPass2(e.target.value)}
                />
              </div>
            )}
          </>
        )}

        {mode === 'verify' && (
          <div className="stack-sm">
            <label htmlFor="acc-code" className="small" style={{ fontWeight: 600 }}>
              6-digit code
            </label>
            <input
              id="acc-code"
              className="input"
              inputMode="numeric"
              maxLength={6}
              autoComplete="one-time-code"
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              autoFocus
            />
          </div>
        )}

        {info && (
          <div className="status-banner ok" role="status">
            {info}
          </div>
        )}
        {error && (
          <div className="status-banner error" role="alert">
            {error}
          </div>
        )}

        <button
          type="submit"
          className="btn primary"
          disabled={busy || !email || (mode === 'verify' ? code.length !== 6 : !pass)}
        >
          {busy
            ? 'Please wait…'
            : mode === 'signup'
              ? 'Create account'
              : mode === 'verify'
                ? 'Verify and continue'
                : 'Log in'}
        </button>

        {mode !== 'verify' && (
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              setMode(mode === 'signup' ? 'login' : 'signup');
              setError('');
              setInfo('');
            }}
          >
            {mode === 'signup' ? 'I already have an account' : 'Create a new account'}
          </button>
        )}

        <p className="xs muted">
          Your health data is encrypted on this phone with a key derived from your password. The server
          only stores a hash of a separate login key, so it cannot read your data. If you forget your
          password, your data cannot be recovered.
        </p>

        <button type="button" className="btn ghost xs" onClick={openServer}>
          {showServer ? 'Hide server address' : 'Server address'}
        </button>
        {showServer && (
          <input
            className="input"
            value={server}
            onChange={(e) => setServerInput(e.target.value)}
            aria-label="Server address"
          />
        )}
      </form>
    </div>
  );
}
