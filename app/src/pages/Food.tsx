import { useEffect, useState } from 'react';
import { parseFood, foodTip } from '../food/parse';
import { loadFood, saveFood } from '../lib/store';
import { today } from '../lib/dates';
import { computeTargets, loadProfile, validateProfile, type Targets } from '../profile/profile';
import type { FoodEntry } from '../types';

export function Food() {
  const [text, setText] = useState('');
  const [entries, setEntries] = useState<FoodEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [target, setTarget] = useState<Targets | null>(null);
  const date = today();

  const refresh = async () => setEntries((await loadFood()).filter((e) => e.date === date));

  useEffect(() => {
    void refresh();
    void loadProfile().then((pr) => setTarget(pr && !validateProfile(pr) ? computeTargets(pr) : null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const preview = text.trim() ? parseFood(text) : null;
  const totalKcal = entries.reduce((s, e) => s + e.kcal, 0);
  const totalProtein = entries.reduce((s, e) => s + e.proteinG, 0);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    const r = parseFood(text);
    if (!r.items.length) {
      setStatus({
        kind: 'error',
        text: 'No known foods matched that entry. Try something like "2 rotis and dal, 1 banana".',
      });
      return;
    }
    setBusy(true);
    try {
      await saveFood({
        id: `${Date.now()}`,
        date,
        text: text.trim(),
        kcal: r.kcal,
        proteinG: r.proteinG,
        unmatched: r.unmatched,
      });
      setText('');
      await refresh();
      setStatus({ kind: 'ok', text: `Added (~${r.kcal} kcal, ~${r.proteinG} g protein).` });
    } catch (err) {
      setStatus({
        kind: 'error',
        text: err instanceof Error ? err.message : 'Could not save food entry.',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="stack-lg">
      <div className="grid-2">
        <form className="card stack-md" onSubmit={add}>
          <div>
            <h2>Log a meal or snack</h2>
            <p className="xs muted">
              Type natural phrases like "2 rotis and dal, 1 banana" or "2 eggs and toast".
            </p>
          </div>

          <textarea
            className="textarea"
            placeholder='What did you eat? e.g. "2 rotis and dal, 1 banana"'
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            aria-label="Food entry"
          />

          {preview && (
            <div className="card-subtle stack-sm">
              <div className="row between wrap">
                <span className="small" style={{ fontWeight: 600 }}>
                  Live estimate (approximate)
                </span>
                <span className="pill primary">
                  ~{preview.kcal} kcal · ~{preview.proteinG} g protein
                </span>
              </div>
              {preview.unmatched.length > 0 && (
                <p className="xs muted">Not recognised: {preview.unmatched.join(', ')}</p>
              )}
            </div>
          )}

          <div className="row between wrap">
            <button type="submit" className="btn primary" disabled={busy || !text.trim()}>
              {busy ? 'Adding…' : 'Add to today'}
            </button>
            <span className="xs muted">Date: {date}</span>
          </div>

          {status && (
            <div className={`status-banner ${status.kind}`} role="status">
              {status.text}
            </div>
          )}

          <p className="xs muted">
            Calorie and protein values are approximate estimates from a built-in table of common
            foods. Not medical or dietary advice.
          </p>
        </form>

        <div className="card stack-md">
          <div className="row between wrap">
            <div>
              <h2>Today&apos;s summary</h2>
              <p className="xs muted">{entries.length} entr{entries.length === 1 ? 'y' : 'ies'} logged</p>
            </div>
            {entries.length > 0 && (
              <span className="pill primary">
                ~{totalKcal}{target ? ` of ~${target.kcal}` : ''} kcal · ~{totalProtein.toFixed(0)}{target ? ` of ~${target.proteinG}` : ''} g protein
              </span>
            )}
          </div>

          {entries.length === 0 ? (
            <div className="card-subtle">
              <p className="small muted">
                Nothing logged yet today. Add a meal on the left to see approximate daily totals.
              </p>
            </div>
          ) : (
            <ul className="audit-list">
              {entries.map((entry) => (
                <li key={entry.id} className="audit-item">
                  <span>{entry.text}</span>
                  <span className="muted" style={{ whiteSpace: 'nowrap' }}>
                    ~{entry.kcal} kcal · {entry.proteinG} g
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="suggest-box" style={{ marginTop: 'auto' }}>
            {foodTip(totalProtein, entries.length)}
          </div>
        </div>
      </div>
    </section>
  );
}
