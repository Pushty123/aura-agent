import { useEffect, useState } from 'react';
import { parseFood, foodTip } from '../food/parse';
import { deleteFood, loadFood, saveFood } from '../lib/store';
import { downscale, getPhoto } from '../lib/camera';
import { today } from '../lib/dates';
import { computeTargets, loadProfile, validateProfile, type Targets } from '../profile/profile';
import type { FoodEntry } from '../types';

export function Food() {
  const [text, setText] = useState('');
  const [entries, setEntries] = useState<FoodEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [target, setTarget] = useState<Targets | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [meal, setMeal] = useState<NonNullable<FoodEntry['meal']>>(() => {
    const h = new Date().getHours();
    return h < 11 ? 'breakfast' : h < 16 ? 'lunch' : h < 21 ? 'dinner' : 'snack';
  });

  async function addPhoto(source: 'camera' | 'gallery') {
    try {
      const img = await getPhoto(source);
      if (img) setPhoto(await downscale(img, 480, 0.8));
    } catch (e) {
      setStatus({ kind: 'error', text: e instanceof Error ? e.message : 'Could not get the photo.' });
    }
  }
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
    if (!r.items.length && !photo) {
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
        text: text.trim() || `${meal[0].toUpperCase()}${meal.slice(1)} (photo)`,
        kcal: r.kcal,
        proteinG: r.proteinG,
        unmatched: r.unmatched,
        meal,
        ...(photo ? { photo } : {}),
      });
      setText('');
      setPhoto(null);
      await refresh();
      setStatus({
        kind: 'ok',
        text: r.items.length
          ? `Added (~${r.kcal} kcal, ~${r.proteinG} g protein).`
          : 'Photo saved. Type what you ate to also get a calorie estimate.',
      });
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
              Type what you ate, add a photo, or both. Photos stay encrypted on this device.
            </p>
          </div>

          <div className="row gap wrap">
            {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map((m) => (
              <button
                key={m}
                type="button"
                className={`btn sm ${meal === m ? 'primary' : 'ghost'}`}
                aria-pressed={meal === m}
                onClick={() => setMeal(m)}
              >
                {m === 'breakfast' ? '🌅' : m === 'lunch' ? '🍛' : m === 'dinner' ? '🍽️' : '🍎'} {m[0].toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>

          <textarea
            className="textarea"
            placeholder='What did you eat? e.g. "2 rotis and dal, 1 banana"'
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            aria-label="Food entry"
          />

          <div className="row gap wrap center-v">
            <button type="button" className="btn sm" onClick={() => void addPhoto('camera')}>
              📷 Take photo
            </button>
            <button type="button" className="btn sm ghost" onClick={() => void addPhoto('gallery')}>
              🖼️ Choose photo
            </button>
            {photo && (
              <div className="row gap center-v">
                <img src={photo} alt="Meal to add" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 10 }} />
                <button type="button" className="btn sm ghost" onClick={() => setPhoto(null)}>
                  Remove photo
                </button>
              </div>
            )}
          </div>

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
            <button type="submit" className="btn primary" disabled={busy || (!text.trim() && !photo)}>
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
                <li key={entry.id} className="audit-item" style={{ alignItems: 'center', gap: 10 }}>
                  {entry.photo && (
                    <img src={entry.photo} alt="" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 10, flex: '0 0 auto' }} />
                  )}
                  <span style={{ flex: 1, minWidth: 0 }}>
                    {entry.meal && <span className="xs muted" style={{ display: 'block', textTransform: 'capitalize' }}>{entry.meal}</span>}
                    {entry.text}
                  </span>
                  <span className="muted" style={{ whiteSpace: 'nowrap' }}>
                    {entry.kcal ? `~${entry.kcal} kcal · ${entry.proteinG} g` : 'No estimate'}
                  </span>
                  <button
                    type="button"
                    className="btn sm ghost"
                    aria-label={`Remove ${entry.text}`}
                    onClick={() => void deleteFood(entry.id).then(refresh)}
                  >
                    ✕
                  </button>
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
