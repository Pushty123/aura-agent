import { useCallback, useEffect, useState } from 'react';
import { CelebrationMoment } from '../components/CelebrationMoment';
import type { AppTab } from '../components/AppShell';
import { IconTile, ScreenHeader } from '../components/design-system';
import { today } from '../lib/dates';
import {
  loadBucketItems,
  loadCelebrationsEnabled,
  markBucketAchieved,
  newBucketItem,
  saveBucketItems,
  validateBucketItem,
  type BucketItem,
  type GoalCategory,
} from '../goals/personalGoals';

const CATEGORIES: { id: GoalCategory; label: string }[] = [
  { id: 'health', label: 'Health' },
  { id: 'study', label: 'Study' },
  { id: 'habit', label: 'Habit' },
  { id: 'personal', label: 'Personal' },
  { id: 'other', label: 'Other' },
];

function dateLabel(date: string): string {
  return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
    .format(new Date(`${date}T12:00:00`));
}

export function BucketList({ onNavigate }: { onNavigate: (tab: AppTab) => void }) {
  const [items, setItems] = useState<BucketItem[]>([]);
  const [celebrationsEnabled, setCelebrationsEnabled] = useState<boolean | null>(null);
  const [draft, setDraft] = useState<BucketItem>(() => newBucketItem());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [achievingId, setAchievingId] = useState<string | null>(null);
  const [achievedDate, setAchievedDate] = useState(today());
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [celebration, setCelebration] = useState<{ title: string; message: string } | null>(null);

  const refresh = useCallback(async () => {
    const [savedItems, enabled] = await Promise.all([loadBucketItems(), loadCelebrationsEnabled()]);
    setItems(savedItems);
    setCelebrationsEnabled(enabled);
  }, []);

  useEffect(() => {
    void refresh().catch((error: unknown) => {
      setMessage({ ok: false, text: error instanceof Error ? error.message : 'Could not load your bucket list.' });
    });
  }, [refresh]);

  const openItems = items.filter((item) => !item.achievedAt);
  const achievedItems = items
    .filter((item) => !!item.achievedAt)
    .sort((a, b) => (b.achievedAt ?? '').localeCompare(a.achievedAt ?? ''));

  function startNew() {
    setDraft(newBucketItem());
    setEditingId(null);
    setFormOpen(true);
    setMessage(null);
  }

  function startEdit(item: BucketItem) {
    setDraft({ ...item });
    setEditingId(item.id);
    setFormOpen(true);
    setMessage(null);
  }

  async function saveItem(event: React.FormEvent) {
    event.preventDefault();
    const saved: BucketItem = {
      ...draft,
      title: draft.title.trim(),
      note: draft.note?.trim() || undefined,
      targetYear: draft.targetYear ? Number(draft.targetYear) : undefined,
    };
    const error = validateBucketItem(saved);
    if (error) {
      setMessage({ ok: false, text: error });
      return;
    }
    const next = editingId
      ? items.map((item) => item.id === editingId ? saved : item)
      : [...items, saved];
    try {
      await saveBucketItems(next);
      setItems(next);
      setFormOpen(false);
      setMessage({ ok: true, text: editingId ? 'Dream updated.' : 'Added to your bucket list.' });
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : 'Could not save this dream.' });
    }
  }

  async function saveAchievement(item: BucketItem) {
    if (!achievedDate) {
      setMessage({ ok: false, text: 'Choose the date you achieved this.' });
      return;
    }
    const nextItem = markBucketAchieved(item, achievedDate);
    const next = items.map((entry) => entry.id === item.id ? nextItem : entry);
    try {
      await saveBucketItems(next);
      setItems(next);
      setAchievingId(null);
      setMessage({ ok: true, text: `"${item.title}" added to your Achieved timeline.` });
      const enabled = celebrationsEnabled ?? await loadCelebrationsEnabled();
      if (enabled) {
        setCelebration({
          title: 'What a lovely moment!',
          message: `"${item.title}" is something you made happen. Enjoy looking back on it.`,
        });
      }
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : 'Could not save this achievement.' });
    }
  }

  async function reopen(item: BucketItem) {
    const { achievedAt: _achievedAt, ...openItem } = item;
    const next = items.map((entry) => entry.id === item.id ? openItem : entry);
    try {
      await saveBucketItems(next);
      setItems(next);
      setMessage({ ok: true, text: 'Moved back to your open list.' });
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : 'Could not update this dream.' });
    }
  }

  async function deleteItem(item: BucketItem) {
    if (!window.confirm(`Delete "${item.title}" from your bucket list?`)) return;
    const next = items.filter((entry) => entry.id !== item.id);
    try {
      await saveBucketItems(next);
      setItems(next);
      setMessage({ ok: true, text: 'Dream deleted.' });
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : 'Could not delete this dream.' });
    }
  }

  function renderItem(item: BucketItem, achieved = false) {
    return (
      <article className={`bucket-item${achieved ? ' bucket-achieved' : ''}`} data-category={item.category ?? 'other'} key={item.id}>
        <div className="row gap center-v">
          <IconTile kind={item.category ?? 'other'} />
          <div className="stack-sm" style={{ flex: 1, minWidth: 0, gap: 3 }}>
            <h3>{item.title}</h3>
            <span className="xs muted">
              {achieved
                ? `Achieved · ${dateLabel(item.achievedAt!)}`
                : [item.category && CATEGORIES.find((category) => category.id === item.category)?.label, item.targetYear && `Aim for ${item.targetYear}`].filter(Boolean).join(' · ') || 'Whenever the time feels right'}
            </span>
          </div>
          {achieved && <span className="pill ok">Achieved</span>}
        </div>
        {item.note && <p className="small muted" style={{ margin: 0 }}>{item.note}</p>}
        <div className="row gap wrap">
          {!achieved && (
            <button type="button" className="btn sm primary" onClick={() => {
              setAchievedDate(today());
              setAchievingId(achievingId === item.id ? null : item.id);
            }}>
              Mark achieved
            </button>
          )}
          {achieved && <button type="button" className="btn sm" onClick={() => void reopen(item)}>Move to Open</button>}
          <button type="button" className="btn sm ghost" onClick={() => startEdit(item)}>Edit</button>
          <button type="button" className="btn sm ghost" onClick={() => void deleteItem(item)}>Delete</button>
        </div>
        {achievingId === item.id && (
          <div className="card-subtle stack-sm">
            <label className="stack-sm small">
              Achievement date
              <input className="input" type="date" required value={achievedDate} onChange={(event) => setAchievedDate(event.target.value)} />
            </label>
            <div className="row gap">
              <button type="button" className="btn sm primary" onClick={() => void saveAchievement(item)}>Save achievement</button>
              <button type="button" className="btn sm ghost" onClick={() => setAchievingId(null)}>Cancel</button>
            </div>
          </div>
        )}
      </article>
    );
  }

  return (
    <section className="ds-demo-page plan-page stack-lg">
      <ScreenHeader
        title="Bucket list"
        date="Dream a little. Make it yours."
        onSettingsClick={() => onNavigate('me')}
      />
      {message && (
        <div className={`status-banner ${message.ok ? 'ok' : 'error'}`} role={message.ok ? 'status' : 'alert'}>
          {message.text}
        </div>
      )}

      <section className="stack-sm">
        <div className="section-heading">
          <div>
            <h2>Open</h2>
            <p className="xs muted">Things you would like to experience, with no pressure to rush.</p>
          </div>
          <button type="button" className="btn sm primary" onClick={startNew}>Add a dream</button>
        </div>
        {openItems.length
          ? <div className="bucket-list">{openItems.map((item) => renderItem(item))}</div>
          : <p className="card small muted">Your next dream can start here whenever you're ready.</p>}
      </section>

      <section className="stack-sm">
        <div>
          <h2>Achieved</h2>
          <p className="xs muted">A timeline of the moments you made happen.</p>
        </div>
        {achievedItems.length
          ? <div className="bucket-list">{achievedItems.map((item) => renderItem(item, true))}</div>
          : <p className="card small muted">Things you achieve will be saved here, with their dates.</p>}
      </section>

      {formOpen && (
        <form className="card stack-md" onSubmit={(event) => void saveItem(event)}>
          <h2>{editingId ? 'Edit dream' : 'Add to your bucket list'}</h2>
          <label className="stack-sm small">
            Title
            <input className="input" value={draft.title} maxLength={80} required onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
          </label>
          <label className="stack-sm small">
            Note (optional)
            <textarea className="input" rows={3} maxLength={280} value={draft.note ?? ''} onChange={(event) => setDraft({ ...draft, note: event.target.value })} />
          </label>
          <label className="stack-sm small">
            Target year (optional)
            <input className="input" type="number" min="1900" max="9999" value={draft.targetYear ?? ''} onChange={(event) => setDraft({ ...draft, targetYear: event.target.value ? Number(event.target.value) : undefined })} />
          </label>
          <label className="stack-sm small">
            Category (optional)
            <select className="input" value={draft.category ?? ''} onChange={(event) => setDraft({ ...draft, category: (event.target.value || undefined) as GoalCategory | undefined })}>
              <option value="">No category</option>
              {CATEGORIES.map((category) => <option value={category.id} key={category.id}>{category.label}</option>)}
            </select>
          </label>
          <div className="row gap wrap">
            <button type="submit" className="btn primary">Save dream</button>
            <button type="button" className="btn ghost" onClick={() => setFormOpen(false)}>Cancel</button>
          </div>
        </form>
      )}
      {celebration && (
        <CelebrationMoment
          title={celebration.title}
          message={celebration.message}
          onClose={() => setCelebration(null)}
        />
      )}
    </section>
  );
}
