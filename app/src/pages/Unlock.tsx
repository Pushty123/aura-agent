import { useState } from 'react';
import { createVault, unlock } from '../lib/vault';

export function Unlock({ exists, onDone }: { exists: boolean; onDone: () => void }) {
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!exists && pass !== pass2) return setError('The two passphrases do not match.');
    setBusy(true);
    try {
      if (exists) {
        if (await unlock(pass)) onDone();
        else setError('That passphrase is not right.');
      } else {
        await createVault(pass);
        onDone();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="center">
      <form className="card unlock" onSubmit={submit}>
        <h1 className="logo big">AURA</h1>
        <p className="muted">{exists ? 'Enter your passphrase to unlock your data.' : 'Create a passphrase. Everything AURA stores is locked with it.'}</p>
        <input type="password" placeholder="Passphrase" value={pass} onChange={(e) => setPass(e.target.value)} autoFocus />
        {!exists && <input type="password" placeholder="Repeat passphrase" value={pass2} onChange={(e) => setPass2(e.target.value)} />}
        {error && <p className="error">{error}</p>}
        <button className="primary" disabled={busy || !pass}>
          {busy ? 'Working…' : exists ? 'Unlock' : 'Create vault'}
        </button>
        {!exists && <p className="muted small">There is no way to recover a forgotten passphrase. That is what keeps your data private.</p>}
      </form>
    </div>
  );
}
