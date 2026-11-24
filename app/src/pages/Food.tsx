import { useEffect, useState } from 'react';
import { parseFood, foodTip } from '../food/parse';
import { loadFood, saveFood } from '../lib/store';
import { today } from '../lib/dates';
import type { FoodEntry } from '../types';

export function Food() {
  const [text, setText] = useState('');
  const [entries, setEntries] = useState<FoodEntry[]>([]);
  const [note, setNote] = useState('');
  const date = today();

  const refresh = async () => setEntries((await loadFood()).filter((e) => e.date === date));
  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const preview = text.trim() ? parseFood(text) : null;
  const totalKcal = entries.reduce((s, e) => s + e.kcal, 0);
  const totalProtein = entries.reduce((s, e) => s + e.proteinG, 0);

  async function add() {
    const r = parseFood(text);
    if (!r.items.length) return setNote('I could not find any known foods in that. Try "2 rotis and dal".');
    await saveFood({ id: `${Date.now()}`, date, text, kcal: r.kcal, proteinG: r.proteinG, unmatched: r.unmatched });
    setText('');
    setNote('Saved.');
    await refresh();
  }

  return (
    <section>
      <h2>Food log</h2>
      <div className="card">
        <textarea placeholder='What did you eat? e.g. "2 rotis and dal, 1 banana"' value={text} onChange={(e) => setText(e.target.value)} rows={3} />
        {preview && (
          <p>
            Estimate: <strong>~{preview.kcal} kcal</strong>, ~{preview.proteinG} g protein
            {preview.unmatched.length > 0 && <span className="muted"> · not recognised: {preview.unmatched.join(', ')}</span>}
          </p>
        )}
        <button className="primary" onClick={add} disabled={!text.trim()}>Add to today</button>
        <p className="muted small">Rough estimates from a built-in table of common foods. Not medical or dietary advice.</p>
        {note && <p className="muted">{note}</p>}
      </div>
      <div className="card">
        <h3>Today</h3>
        {entries.length === 0 ? <p className="muted">Nothing logged yet.</p> : (
          <ul>{entries.map((e) => <li key={e.id}>{e.text} <span className="muted">· ~{e.kcal} kcal, {e.proteinG} g protein</span></li>)}</ul>
        )}
        <p><strong>Total ~{totalKcal} kcal · {totalProtein.toFixed(0)} g protein</strong></p>
        <p className="suggest">{foodTip(totalProtein, entries.length)}</p>
      </div>
    </section>
  );
}
