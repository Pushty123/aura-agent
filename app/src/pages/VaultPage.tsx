import { useEffect, useState } from 'react';
import { biometricDisable, clearWidget } from '../native/bridge';
import {
  SOURCES,
  audit,
  deleteAll,
  deleteRecordsBySource,
  exportAll,
  getAudit,
  getConsent,
  setConsent,
  verifyAudit,
} from '../lib/vault';
import { getLedger, ledgerTotals, subscribeLedger, type LedgerEntry } from '../lib/ledger';
import { pushBackup } from '../lib/relay';
import { confirmCsvImport, previewCsvImport, type CsvImportPreview } from '../lib/csvImport';
import { saveDay } from '../lib/store';
import { ConfirmDialog } from '../components/ConfirmDialog';
import type { DataSource } from '../types';
import { db, type AuditRow, type RecordRow } from '../lib/db';

export function VaultPage({
  onChange,
  onDeleted,
}: {
  onChange: () => Promise<void>;
  onDeleted: () => void;
}) {
  const [consent, setC] = useState<Record<DataSource, boolean> | null>(null);
  const [auditRows, setAuditRows] = useState<AuditRow[]>([]);
  const [chainOk, setChainOk] = useState<boolean | null>(null);
  const [totals, setTotals] = useState(ledgerTotals());
  const [ledgerEntries, setLedgerEntries] = useState<readonly LedgerEntry[]>(() => getLedger());
  const [status, setStatus] = useState<{ kind: 'ok' | 'error' | 'info'; text: string } | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [diskSample, setDiskSample] = useState<RecordRow | null>(null);
  const [showCiphertext, setShowCiphertext] = useState(false);

  // CSV import state
  const [csvName, setCsvName] = useState('');
  const [csvPreview, setCsvPreview] = useState<CsvImportPreview | null>(null);

  const refresh = async () => {
    setC(await getConsent());
    setAuditRows((await getAudit()).slice(-10).reverse());
    setChainOk(await verifyAudit());
  };

  useEffect(() => {
    void refresh();
    return subscribeLedger(() => {
      setTotals(ledgerTotals());
      setLedgerEntries([...getLedger()]);
    });
  }, []);

  async function doExport() {
    setBusy(true);
    try {
      const json = await exportAll();
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'aura-export.json';
      a.click();
      URL.revokeObjectURL(url);
      setStatus({ kind: 'ok', text: 'Exported all your data as JSON.' });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleCsvFile(file: File | undefined) {
    if (!file) return;
    setStatus(null);
    const text = await file.text();
    const preview = previewCsvImport(text);
    setCsvName(file.name);
    setCsvPreview(preview);
  }

  async function handleConfirmCsv() {
    if (!csvPreview || csvPreview.validRows.length === 0) return;
    setBusy(true);
    setStatus(null);
    try {
      await setConsent('csv', true);
      const records = confirmCsvImport(csvPreview);
      for (const rec of records) {
        await saveDay(rec);
      }
      await audit('data.csv-import', `Imported ${records.length} day records from ${csvName || 'CSV'}`);
      await onChange();
      await refresh();
      setStatus({
        kind: 'ok',
        text: `Imported ${records.length} valid day record${records.length === 1 ? '' : 's'} into your encrypted vault.`,
      });
      setCsvPreview(null);
      setCsvName('');
    } catch (err) {
      setStatus({
        kind: 'error',
        text: err instanceof Error ? err.message : 'Failed to import CSV records.',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="stack-lg">
      {status && (
        <div className={`status-banner ${status.kind === 'info' ? '' : status.kind}`} role="status">
          {status.text}
        </div>
      )}

      <div className="grid-2">
        {/* Network Ledger */}
        <div className="card stack-md">
          <div className="row between wrap">
            <div>
              <h2>What left this device</h2>
              <p className="xs muted">Live count of AURA&apos;s own outgoing network requests</p>
            </div>
            <span className="pill primary">
              {totals.requests} request{totals.requests === 1 ? '' : 's'}
            </span>
          </div>

          <div className="big-number">
            {totals.bytesOut === 0 ? '0 bytes' : `${totals.bytesOut.toLocaleString()} bytes`}
          </div>

          <p className="xs muted">
            Counts requests made by AURA&apos;s own code since you opened the app. Anything sent to
            the optional backup relay is encrypted ciphertext that the server cannot read.
          </p>

          {ledgerEntries.length > 0 && (
            <ul className="audit-list">
              {ledgerEntries.slice(-5).reverse().map((e, idx) => (
                <li key={`${e.ts}-${idx}`} className="audit-item">
                  <span>
                    {e.method} {e.host} ({e.label})
                  </span>
                  <span className="muted">{e.bytesOut.toLocaleString()} B</span>
                </li>
              ))}
            </ul>
          )}

          <div className="row gap-sm wrap">
            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const res = await pushBackup();
                  setStatus({ kind: res.ok ? 'ok' : 'info', text: res.message });
                  await refresh();
                } finally {
                  setBusy(false);
                }
              }}
            >
              Back up encrypted copy to relay (optional)
            </button>
            <button
              type="button"
              className="btn ghost"
              onClick={async () => {
                const next = !showCiphertext;
                setShowCiphertext(next);
                if (next) {
                  setDiskSample((await db.records.limit(1).first()) ?? null);
                }
              }}
            >
              {showCiphertext ? 'Hide disk ciphertext' : 'Inspect encrypted vault on disk'}
            </button>
          </div>
          {showCiphertext && (
            <div className="card-subtle stack-sm">
              <strong className="xs">Proof of encryption (raw IndexedDB record)</strong>
              {diskSample ? (
                <pre className="xs" style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: 'var(--aura-muted)' }}>
                  {`id: ${diskSample.id}\nkind: ${diskSample.kind}\niv: ${diskSample.iv.slice(0, 24)}…\nct: ${diskSample.ct.slice(0, 96)}…`}
                </pre>
              ) : (
                <p className="xs muted">No encrypted records saved yet.</p>
              )}
              <p className="xs muted" style={{ margin: 0 }}>
                Only AES-GCM ciphertext is written to disk. Without your passphrase, it cannot be read.
              </p>
            </div>
          )}
        </div>

        {/* Consent Controls */}
        <div className="card stack-md">
          <div>
            <h2>Sources you allow</h2>
            <p className="xs muted">
              Switching off a non-manual source removes its stored day records from your vault.
            </p>
          </div>

          <div>
            {consent &&
              SOURCES.map((s) => (
                <label key={s.id} className="toggle-row">
                  <input
                    type="checkbox"
                    checked={consent[s.id]}
                    disabled={busy}
                    onChange={async (e) => {
                      const checked = e.target.checked;
                      setBusy(true);
                      try {
                        await setConsent(s.id, checked);
                        if (!checked && s.id !== 'manual') {
                          const n = await deleteRecordsBySource(s.id);
                          setStatus({
                            kind: 'ok',
                            text: n
                              ? `Switched off ${s.label} and removed ${n} day record${n === 1 ? '' : 's'}.`
                              : `Switched off ${s.label}.`,
                          });
                          await onChange();
                        } else {
                          setStatus({
                            kind: 'ok',
                            text: `${s.label} ${checked ? 'enabled' : 'disabled'}.`,
                          });
                        }
                        await refresh();
                      } finally {
                        setBusy(false);
                      }
                    }}
                  />
                  <span>
                    <strong className="small">{s.label}</strong>
                    <br />
                    <span className="xs muted">{s.description}</span>
                  </span>
                </label>
              ))}
          </div>
        </div>
      </div>

      {/* CSV Import with Preview & Confirm */}
      <div className="card stack-md">
        <div className="row between wrap">
          <div>
            <h2>Import CSV data</h2>
            <p className="xs muted">
              Required columns: <code>date</code>, <code>sleepMinutes</code>, <code>steps</code>,{' '}
              <code>screenMinutes</code>, <code>mood</code> (1–5). Preview rows before saving.
            </p>
          </div>
        </div>

        <div className="row gap wrap center-v">
          <input
            type="file"
            accept=".csv,text/csv"
            aria-label="Choose CSV file to import"
            disabled={busy}
            onChange={(e) => {
              void handleCsvFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          {csvPreview && (
            <button
              type="button"
              className="btn sm"
              disabled={busy}
              onClick={() => {
                setCsvPreview(null);
                setCsvName('');
              }}
            >
              Clear preview
            </button>
          )}
        </div>

        {csvPreview && (
          <div className="card-subtle stack-md">
            <div className="row between wrap">
              <strong className="small">Preview: {csvName}</strong>
              <div className="row gap-sm">
                <span className="pill ok">{csvPreview.counts.valid} valid</span>
                {csvPreview.counts.rejected > 0 && (
                  <span className="pill warn">{csvPreview.counts.rejected} rejected</span>
                )}
              </div>
            </div>

            {csvPreview.validRows.length > 0 && (
              <div className="csv-table-wrap">
                <table className="csv-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Sleep (min)</th>
                      <th>Steps</th>
                      <th>Screen (min)</th>
                      <th>Mood</th>
                    </tr>
                  </thead>
                  <tbody>
                    {csvPreview.validRows.slice(0, 8).map((row) => (
                      <tr key={row.rowNumber}>
                        <td>{row.values.date}</td>
                        <td>{row.values.sleepMinutes}</td>
                        <td>{row.values.steps.toLocaleString()}</td>
                        <td>{row.values.screenMinutes}</td>
                        <td>{row.values.mood}/5</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {csvPreview.rejectedRows.length > 0 && (
              <ul className="evidence-list">
                {csvPreview.rejectedRows.slice(0, 5).map((r) => (
                  <li key={r.rowNumber}>{r.reason}</li>
                ))}
              </ul>
            )}

            <div className="row gap">
              <button
                type="button"
                className="btn primary"
                disabled={busy || csvPreview.validRows.length === 0}
                onClick={handleConfirmCsv}
              >
                {busy
                  ? 'Importing…'
                  : `Confirm import (${csvPreview.validRows.length} row${csvPreview.validRows.length === 1 ? '' : 's'})`}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Export, Delete & Audit Log */}
      <div className="grid-2">
        <div className="card stack-md">
          <div>
            <h2>Your data is yours</h2>
            <p className="xs muted">
              Download a readable JSON copy of your records or permanently wipe your encrypted vault.
            </p>
          </div>
          <div className="row gap wrap">
            <button type="button" className="btn" onClick={doExport} disabled={busy}>
              Export everything (JSON)
            </button>
            <button
              type="button"
              className="btn danger-outline"
              onClick={() => setConfirmDeleteOpen(true)}
              disabled={busy}
            >
              Delete everything
            </button>
          </div>
        </div>

        <div className="card stack-md">
          <div className="row between wrap">
            <div>
              <h2>Audit log</h2>
              <p className="xs muted">Tamper-evident SHA-256 hash chain</p>
            </div>
            {chainOk !== null && (
              <span className={`pill ${chainOk ? 'high' : 'warn'}`}>
                {chainOk ? 'Chain intact' : 'Chain broken'}
              </span>
            )}
          </div>
          {auditRows.length === 0 ? (
            <p className="xs muted">No audit events recorded yet.</p>
          ) : (
            <ul className="audit-list">
              {auditRows.map((a) => (
                <li key={a.id} className="audit-item">
                  <span>{a.detail}</span>
                  <span className="muted" style={{ whiteSpace: 'nowrap' }}>
                    {new Date(a.ts).toLocaleTimeString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmDeleteOpen}
        title="Delete everything in AURA?"
        description="This permanently erases your encryption salt, all encrypted records, consent settings, and audit log on this device. This cannot be undone."
        confirmLabel="Yes, delete everything"
        danger
        busy={busy}
        onCancel={() => setConfirmDeleteOpen(false)}
        onConfirm={async () => {
          setBusy(true);
          try {
            await clearWidget();
            await biometricDisable();
            await deleteAll();
            setConfirmDeleteOpen(false);
            onDeleted();
          } finally {
            setBusy(false);
          }
        }}
      />
    </section>
  );
}
