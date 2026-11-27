import { useEffect, useState } from 'react';
import { IconTile, RangeBar, ScreenHeader } from '../components/design-system';
import { today } from '../lib/dates';
import { applyReminders, loadReminders } from '../reminders/reminders';
import {
  loadRoutineItems,
  newRoutineItem,
  recordDueRoutineMisses,
  recordRoutineResponse,
  routineDailyProgress,
  routineStatus,
  routineStreak,
  saveRoutineResponses,
  saveRoutineItems,
  WEEKDAYS,
  type RoutineItem,
  type RoutineResponse,
  validateRoutineItem,
} from '../reminders/routine';
import { changeWaterUnit, DEFAULT_WATER_SETTINGS, loadWaterSettings, saveWaterSettings, type WaterSettings } from '../reminders/water';

const ICONS = ['balance', 'exercise', 'heart', 'mood', 'sleep', 'steps', 'water', 'food'] as const;
const STATUS_LABELS: Record<string, string> = {
  done: 'Done',
  'not-now': 'Not now',
  pending: 'Pending',
  'no-response': 'No response',
};

/** Daily routines and hydration reminders, saved encrypted on this device. */
export function Routine({ onOpenPermissions }: { onOpenPermissions: () => void }) {
  const [items, setItems] = useState<RoutineItem[]>([]);
  const [responses, setResponses] = useState<RoutineResponse[]>([]);
  const [water, setWater] = useState<WaterSettings>(DEFAULT_WATER_SETTINGS);
  const [draft, setDraft] = useState<RoutineItem>(() => newRoutineItem());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const [savedItems, savedWater] = await Promise.all([loadRoutineItems(), loadWaterSettings()]);
    const savedResponses = await recordDueRoutineMisses(savedItems);
    setItems(savedItems);
    setWater(savedWater);
    setResponses(savedResponses);
  }

  useEffect(() => {
    void refresh().catch((error: unknown) => {
      setMessage({ ok: false, text: error instanceof Error ? error.message : 'Could not load your routine.' });
    });
  }, []);

  const date = today();
  const progress = routineDailyProgress(items, responses, date);
  const streak = routineStreak(responses, date);

  function startNew() {
    setDraft(newRoutineItem());
    setEditingId(null);
    setFormOpen(true);
    setMessage(null);
  }

  function startEdit(item: RoutineItem) {
    setDraft({ ...item, days: [...item.days] });
    setEditingId(item.id);
    setFormOpen(true);
    setMessage(null);
  }

  async function reschedule(successText: string) {
    const result = await applyReminders(await loadReminders());
    setMessage({
      ok: result.ok,
      text: `${successText} ${result.message}`,
    });
  }

  async function saveRoutine(event: React.FormEvent) {
    event.preventDefault();
    const error = validateRoutineItem(draft);
    if (error) {
      setMessage({ ok: false, text: error });
      return;
    }
    setBusy(true);
    try {
      await recordDueRoutineMisses(items);
      const activeFrom = editingId ? today() : draft.activeFrom;
      const saved = { ...draft, title: draft.title.trim(), activeFrom };
      const next = editingId
        ? items.map((item) => item.id === editingId ? saved : item)
        : [...items, saved];
      await saveRoutineItems(next);
      setItems(next);
      setFormOpen(false);
      await reschedule(editingId ? 'Routine updated.' : 'Routine added.');
      await refresh();
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : 'Could not save this routine.' });
    } finally {
      setBusy(false);
    }
  }

  async function removeRoutine(item: RoutineItem) {
    setBusy(true);
    try {
      await recordDueRoutineMisses(items);
      const next = items.filter((entry) => entry.id !== item.id);
      await saveRoutineItems(next);
      setItems(next);
      await reschedule('Routine removed.');
      await refresh();
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : 'Could not remove this routine.' });
    } finally {
      setBusy(false);
    }
  }

  async function moveRoutine(index: number, offset: -1 | 1) {
    const target = index + offset;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    setBusy(true);
    try {
      await saveRoutineItems(next);
      setItems(next);
      await reschedule('Routine order saved.');
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : 'Could not reorder routines.' });
    } finally {
      setBusy(false);
    }
  }

  async function respond(item: RoutineItem, status: 'done' | 'not-now') {
    try {
      const next = recordRoutineResponse(responses, item.id, date, status, new Date().toISOString());
      await saveRoutineResponses(next);
      setResponses(next);
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : 'Could not save your response.' });
    }
  }

  async function saveWater(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await saveWaterSettings(water);
      await reschedule('Water reminder settings saved.');
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : 'Could not save water settings.' });
    } finally {
      setBusy(false);
    }
  }

  function setDay(day: number, checked: boolean) {
    const days = checked
      ? [...new Set([...draft.days, day])].sort()
      : draft.days.filter((entry) => entry !== day);
    setDraft({ ...draft, days });
  }

  return (
    <section className="ds-demo-page routine-page stack-lg">
      <ScreenHeader
        title="Routine"
        date={new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())}
        onSettingsClick={onOpenPermissions}
      />
      <p className="xs muted routine-lede">A gentle rhythm, your way.</p>

      <article className="routine-summary card stack-sm">
        <div className="row between center-v gap wrap">
          <div>
            <h2>Today, one step at a time</h2>
            <p className="small muted">{progress.done} of {progress.total} routine items done</p>
          </div>
          <strong className="routine-streak" aria-label={`${streak} day weekly streak`}>
            Weekly streak · {streak} day{streak === 1 ? '' : 's'}
          </strong>
        </div>
        <RangeBar min={0} max={Math.max(1, progress.total)} value={progress.done} label="Today's routine completion" />
        <p className="xs muted">Small, steady moments count. These are wellness nudges, not medical advice.</p>
      </article>

      {message && (
        <div className={`status-banner ${message.ok ? 'ok' : 'error'}`} role={message.ok ? 'status' : 'alert'}>
          {message.text}
        </div>
      )}

      <section className="stack-sm">
        <div className="section-heading">
          <h2>Your routine items</h2>
          <button type="button" className="btn sm primary" onClick={startNew} disabled={busy}>Add item</button>
        </div>

        {items.length === 0 && <p className="card small muted">Add a routine item to make a gentle plan for your day.</p>}

        <div className="routine-list">
          {items.map((item, index) => {
            const scheduledToday = item.days.includes(new Date().getDay()) && item.activeFrom <= date;
            const status = scheduledToday ? routineStatus(item, responses, date) : null;
            return (
              <article className="routine-card" key={item.id}>
                <IconTile kind={item.icon ?? 'balance'} />
                <div className="routine-card-content">
                  <div className="row between center-v gap wrap">
                    <div className="routine-card-heading">
                      <h3>{item.title}</h3>
                      <p className="small muted">{item.time} · {item.days.map((day) => WEEKDAYS[day].label).join(', ')}</p>
                    </div>
                    <span className={`routine-status ${status ?? 'not-today'}`}>
                      {status ? STATUS_LABELS[status] : 'Not today'}
                    </span>
                  </div>
                  <div className="row gap wrap">
                    <button type="button" className="btn sm ghost" onClick={() => startEdit(item)} disabled={busy}>Edit</button>
                    <button type="button" className="btn sm ghost" onClick={() => void removeRoutine(item)} disabled={busy}>Delete</button>
                    <button type="button" className="btn sm ghost" onClick={() => void moveRoutine(index, -1)} disabled={busy || index === 0} aria-label={`Move ${item.title} up`}>Move up</button>
                    <button type="button" className="btn sm ghost" onClick={() => void moveRoutine(index, 1)} disabled={busy || index === items.length - 1} aria-label={`Move ${item.title} down`}>Move down</button>
                    {scheduledToday && (
                      <>
                        <button type="button" className="btn sm ghost" onClick={() => void respond(item, 'done')}>Done</button>
                        <button type="button" className="btn sm ghost" onClick={() => void respond(item, 'not-now')}>Not now</button>
                      </>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {formOpen && (
        <form className="card stack-md" onSubmit={(event) => void saveRoutine(event)}>
          <h2>{editingId ? 'Edit routine item' : 'Add routine item'}</h2>
          <label className="stack-sm small">
            Title
            <input className="input" value={draft.title} maxLength={60} onChange={(event) => setDraft({ ...draft, title: event.target.value })} required />
          </label>
          <label className="stack-sm small">
            Time
            <input className="input" type="time" value={draft.time} onChange={(event) => setDraft({ ...draft, time: event.target.value })} required />
          </label>
          <fieldset className="routine-days">
            <legend className="small">Days of the week</legend>
            {WEEKDAYS.map(({ value, label }) => (
              <label key={value}>
                <input type="checkbox" checked={draft.days.includes(value)} onChange={(event) => setDay(value, event.target.checked)} />
                {label}
              </label>
            ))}
          </fieldset>
          <fieldset className="routine-icons">
            <legend className="small">Optional design-system icon</legend>
            <label className="routine-icon-choice">
              <input type="radio" name="routine-icon" checked={!draft.icon} onChange={() => setDraft({ ...draft, icon: undefined })} />
              Default
            </label>
            {ICONS.map((icon) => (
              <label className="routine-icon-choice" key={icon}>
                <input type="radio" name="routine-icon" checked={draft.icon === icon} onChange={() => setDraft({ ...draft, icon })} />
                <IconTile kind={icon} size={18} />
              </label>
            ))}
          </fieldset>
          <div className="row gap">
            <button type="submit" className="btn primary" disabled={busy}>Save item</button>
            <button type="button" className="btn ghost" onClick={() => setFormOpen(false)} disabled={busy}>Cancel</button>
          </div>
        </form>
      )}

      <form className="card stack-md" onSubmit={(event) => void saveWater(event)}>
        <div>
          <h2>Water reminders</h2>
          <p className="small muted">Set a personal goal and choose when gentle reminders fit your day.</p>
        </div>
        <label className="toggle-row">
          <input type="checkbox" checked={water.enabled} onChange={(event) => setWater({ ...water, enabled: event.target.checked })} />
          <strong className="small">Enable water reminders</strong>
        </label>
        <div className="row gap wrap">
          <label className="stack-sm small">
            Daily goal
            <input className="input" type="number" min="1" max={water.unit === 'ml' ? 10000 : 40} step="1" value={water.goal} onChange={(event) => setWater({ ...water, goal: Number(event.target.value) })} />
          </label>
          <label className="stack-sm small">
            Unit
            <select className="input" value={water.unit} onChange={(event) => setWater(changeWaterUnit(water, event.target.value as WaterSettings['unit']))}>
              <option value="glasses">Glasses</option>
              <option value="ml">ml</option>
            </select>
          </label>
          <label className="stack-sm small">
            Remind every (hours)
            <input className="input" type="number" min="1" max="12" step="1" value={water.intervalHours} onChange={(event) => setWater({ ...water, intervalHours: Number(event.target.value) })} />
          </label>
        </div>
        <div className="row gap wrap">
          <label className="stack-sm small">
            Active from
            <input className="input" type="time" value={water.start} onChange={(event) => setWater({ ...water, start: event.target.value })} required />
          </label>
          <label className="stack-sm small">
            Active until
            <input className="input" type="time" value={water.end} onChange={(event) => setWater({ ...water, end: event.target.value })} required />
          </label>
        </div>
        <p className="xs muted">A manually added glass is counted as 250 ml. These are wellness nudges, not medical advice.</p>
        <button type="submit" className="btn primary" disabled={busy}>Save water settings</button>
      </form>
    </section>
  );
}
