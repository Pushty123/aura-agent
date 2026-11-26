import { useState } from 'react';
import { login, noteSignedIn, register, verify } from '../lib/account';

/** Log in (or create an account) after using AURA without one. The vault stays as it is. */
export function LoginSheet({ onClose, onDone }: { onClose: () => void; onDone: (email: string) => void }) {
  const [mode, setMode] = useState<'login' | 'signup' | 'code'>('login');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function go() {
    setBusy(true);
    setMsg(null);
    try {
      const e = email.trim().toLowerCase();
      if (mode === 'login') {
        await login(e, pass);
        await noteSignedIn(e);
        onDone(e);
      } else if (mode === 'signup') {
        if (pass.length < 8) throw new Error('Use at least 8 characters for the password.');
        const r = await register(e, pass);
        setMode('code');
        setMsg({ ok: true, text: r.dev_code ? `Demo server: your code is ${r.dev_code}.` : `We sent a 6-digit code to ${e}.` });
      } else {
        await verify(e, code.trim());
        await noteSignedIn(e);
        onDone(e);
      }
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'Something went wrong.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sheet-backdrop" role="dialog" aria-modal="true" aria-label="Log in" onClick={onClose}>
      <form
        className="sheet card stack-md"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          void go();
        }}
      >
        <div className="row between center-v">
          <h2 style={{ margin: 0 }}>{mode === 'login' ? 'Log in' : mode === 'signup' ? 'Create account' : 'Enter code'}</h2>
          <button type="button" className="btn ghost sm" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <p className="xs muted">An account lets you use AI replies and back up your encrypted data. Your data on this phone stays as it is.</p>
        {mode !== 'code' ? (
          <>
            <input className="input" type="email" autoComplete="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <input className="input" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder="Password" value={pass} onChange={(e) => setPass(e.target.value)} required />
          </>
        ) : (
          <input className="input" inputMode="numeric" placeholder="6-digit code" value={code} onChange={(e) => setCode(e.target.value)} maxLength={6} required />
        )}
        {msg && <div className={`status-banner ${msg.ok ? 'ok' : 'error'}`} role="status">{msg.text}</div>}
        <button type="submit" className="btn primary" disabled={busy}>
          {busy ? 'Please wait…' : mode === 'login' ? 'Log in' : mode === 'signup' ? 'Send code' : 'Verify and log in'}
        </button>
        {mode !== 'code' && (
          <button type="button" className="btn ghost sm" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setMsg(null); }}>
            {mode === 'login' ? 'New here? Create an account' : 'Have an account? Log in'}
          </button>
        )}
      </form>
    </div>
  );
}
