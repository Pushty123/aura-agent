import { useEffect, useState } from 'react';
import { SOURCES, deleteAll, deleteRecordsBySource, exportAll, getAudit, getConsent, setConsent, verifyAudit } from '../lib/vault';
import { ledgerTotals, subscribeLedger } from '../lib/ledger';
import { pushBackup } from '../lib/relay';
import type { DataSource } from '../types';
import type { AuditRow } from '../lib/db';

export function VaultPage({ onChange, onDeleted }: { onChange: () => Promise<void>; onDeleted: () => void }) {
  const [consent, setC] = useState<Record<DataSource, boolean> | null>(null);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [chainOk, setChainOk] = useState<boolean | null>(null);
  const [totals, setTotals] = useState(ledgerTotals());
  const [msg, setMsg] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const refresh = async () => {
    setC(await getConsent());
    setAudit((await getAudit()).slice(-8).reverse());
    setChainOk(await verifyAudit());
  };
  useEffect(() => {
    void refresh();
    return subscribeLedger(() => setTotals(ledgerTotals()));
  }, []);

  async function doExport() {
    const json = await exportAll();
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'aura-export.json';
    a.click();
    URL.revokeObjectURL(url);
    setMsg('Exported all your data as JSON.');
    await refresh();
  }

  return (
    <section>
      <h2>My Data</h2>

      <div className="card ledger">
        <h3>What left this phone</h3>
        <p className="big-number">{totals.bytesOut === 0 ? '0 bytes' : `${totals.bytesOut.toLocaleString()} bytes`}</p>
        <p className="muted small">
          {totals.requests} request{totals.requests === 1 ? '' : 's'} made by AURA since you opened it. Counts AURA's own network requests only. Anything backed up is
          ciphertext the server cannot read.
        </p>
        <button onClick={async () => setMsg((await pushBackup()).message)}>Back up encrypted copy to relay (optional)</button>
      </div>

      <div className="card">
        <h3>Sources you allow</h3>
        {consent &&
          SOURCES.map((s) => (
            <label key={s.id} className="toggle">
              <input
                type="checkbox"
                checked={consent[s.id]}
                onChange={async (e) => {
                  await setConsent(s.id, e.target.checked);
                  if (!e.target.checked && s.id !== 'manual') {
                    const n = await deleteRecordsBySource(s.id);
                    if (n) setMsg(`Switched off ${s.label} and removed ${n} day records from it.`);
                    await onChange();
                  }
                  await refresh();
                }}
              />
              <span>
                <strong>{s.label}</strong>
                <br />
                <span className="muted small">{s.description}</span>
              </span>
            </label>
          ))}
      </div>

      <div className="card">
        <h3>Your data is yours</h3>
        <div className="row gap wrap">
          <button onClick={doExport}>Export everything (JSON)</button>
          {!confirmDelete ? (
            <button className="danger" onClick={() => setConfirmDelete(true)}>Delete everything</button>
          ) : (
            <>
              <button
                className="danger"
                onClick={async () => {
                  await deleteAll();
                  onDeleted();
                }}
              >
                Yes, delete all (cannot be undone)
              </button>
              <button onClick={() => setConfirmDelete(false)}>Cancel</button>
            </>
          )}
        </div>
        {msg && <p className="muted">{msg}</p>}
      </div>

      <div className="card">
        <h3>Audit log {chainOk !== null && <span className={`pill ${chainOk ? 'high' : 'low'}`}>{chainOk ? 'chain intact' : 'chain broken'}</span>}</h3>
        <ul className="audit">
          {audit.map((a) => (
            <li key={a.id}>
              <span className="muted">{new Date(a.ts).toLocaleTimeString()}</span> {a.detail}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
