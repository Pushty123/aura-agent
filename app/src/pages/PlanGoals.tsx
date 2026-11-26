import { useCallback, useEffect, useMemo, useState } from 'react';
import { CelebrationMoment } from '../components/CelebrationMoment';
import { IconTile, RangeBar, ScreenHeader } from '../components/design-system';
import type { AppTab } from '../components/AppShell';
import { today } from '../lib/dates';
import { applyReminders, loadReminders } from '../reminders/reminders';
import { loadRoutineItems, loadRoutineResponses, type RoutineItem, type RoutineResponse } from '../reminders/routine';
import {
  classifyGoal,
  completePersonalGoal,
  extendGoalDate,
  isGoalOverdue,
  loadCelebrationsEnabled,
  loadPersonalGoals,
  newPersonalGoal,
  personalGoalProgress,
  savePersonalGoals,
  toggleGoalMilestone,
  validatePersonalGoal,
  type GoalCategory,
  type GoalMilestone,
  type GoalTerm,
  type PersonalGoal,
} from '../goals/personalGoals';

const CATEGORIES: { id: GoalCategory; label: string }[] = [
  { id: 'health', label: 'Health' },
  { id: 'study', label: 'Study' },
  { id: 'habit', label: 'Habit' },
  { id: 'personal', label: 'Personal' },
  { id: 'other', label: 'Other' },
];

function milestoneList(text: string, existing: GoalMilestone[]): GoalMilestone[] {
  const unused = [...existing];
  return text.split('\n').map((line) => line.trim()).filter(Boolean).map((title, index) => {
    const match = unused.findIndex((milestone) => milestone.title === title);
    if (match >= 0) return unused.splice(match, 1)[0];
    return { id: `milestone-${Date.now()}-${index}`, title };
  });
}

function dateLabel(date?: string): string {
  if (!date) return 'No target date';
  return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
    .format(new Date(`${date}T12:00:00`));
}

export function PlanGoals({ onNavigate }: { onNavigate: (tab: AppTab) => void }) {
  const [goals, setGoals] = useState<PersonalGoal[]>([]);
  const [routineItems, setRoutineItems] = useState<RoutineItem[]>([]);
  const [responses, setResponses] = useState<RoutineResponse[]>([]);
  const [celebrationsEnabled, setCelebrationsEnabled] = useState<boolean | null>(null);
  const [term, setTerm] = useState<GoalTerm>('short-term');
  const [draft, setDraft] = useState<PersonalGoal>(() => newPersonalGoal());
  const [milestonesText, setMilestonesText] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [celebration, setCelebration] = useState<{ title: string; message: string } | null>(null);
  const date = today();

  const refresh = useCallback(async () => {
    const [savedGoals, savedRoutines, savedResponses, enabled] = await Promise.all([
      loadPersonalGoals(),
      loadRoutineItems(),
      loadRoutineResponses(),
      loadCelebrationsEnabled(),
    ]);
    setGoals(savedGoals);
    setRoutineItems(savedRoutines);
    setResponses(savedResponses);
    setCelebrationsEnabled(enabled);
  }, []);

  useEffect(() => {
    void refresh().catch((error: unknown) => {
      setMessage({ ok: false, text: error instanceof Error ? error.message : 'Could not load your goals.' });
    });
  }, [refresh]);

  const visibleGoals = useMemo(
    () => goals.filter((goal) => !goal.archivedAt && classifyGoal(goal, date) === term),
    [date, goals, term],
  );
  const archivedGoals = goals.filter((goal) => !!goal.archivedAt);

  function startNew() {
    setDraft(newPersonalGoal());
    setMilestonesText('');
    setEditingId(null);
    setFormOpen(true);
    setMessage(null);
  }

  function startEdit(goal: PersonalGoal) {
    setDraft({ ...goal, milestones: [...goal.milestones] });
    setMilestonesText(goal.milestones.map((milestone) => milestone.title).join('\n'));
    setEditingId(goal.id);
    setFormOpen(true);
    setMessage(null);
  }

  async function rescheduleGoalDates(currentGoals: PersonalGoal[] = goals): Promise<string> {
    try {
      const result = await applyReminders(await loadReminders());
      const hasGoalReminder = currentGoals.some((goal) =>
        goal.reminderEnabled && !!goal.targetDate && !goal.archivedAt && !goal.completedAt,
      );
      return result.ok || !hasGoalReminder ? '' : result.message;
    } catch (error) {
      return error instanceof Error ? error.message : 'Could not update goal reminders.';
    }
  }

  async function saveGoal(event: React.FormEvent) {
    event.preventDefault();
    const saved: PersonalGoal = {
      ...draft,
      title: draft.title.trim(),
      target: draft.target?.trim() || undefined,
      targetDate: draft.targetDate || undefined,
      routineItemId: draft.routineItemId || undefined,
      reminderEnabled: !!draft.targetDate && draft.reminderEnabled,
      milestones: milestoneList(milestonesText, draft.milestones),
    };
    const error = validatePersonalGoal(saved);
    if (error) {
      setMessage({ ok: false, text: error });
      return;
    }
    try {
      const next = editingId
        ? goals.map((goal) => goal.id === editingId ? saved : goal)
        : [...goals, saved];
      await savePersonalGoals(next);
      setGoals(next);
      setTerm(classifyGoal(saved, date));
      setFormOpen(false);
      const reminderMessage = await rescheduleGoalDates(next);
      setMessage({
        ok: !reminderMessage,
        text: reminderMessage
          ? `Goal saved. Date reminder not active: ${reminderMessage}`
          : editingId ? 'Goal updated.' : 'Goal added. Every small step counts.',
      });
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : 'Could not save this goal.' });
    }
  }

  async function updateGoal(goal: PersonalGoal, successMessage: string, celebrate?: { title: string; message: string }) {
    const next = goals.map((entry) => entry.id === goal.id ? goal : entry);
    try {
      await savePersonalGoals(next);
      setGoals(next);
      const reminderMessage = await rescheduleGoalDates(next);
      setMessage({
        ok: !reminderMessage,
        text: reminderMessage ? `${successMessage} Date reminder not active: ${reminderMessage}` : successMessage,
      });
      const enabled = celebrationsEnabled ?? await loadCelebrationsEnabled();
      if (celebrate && enabled) setCelebration(celebrate);
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : 'Could not update this goal.' });
    }
  }

  function toggleMilestone(goal: PersonalGoal, milestone: GoalMilestone) {
    const next = toggleGoalMilestone(goal, milestone.id, date);
    const justCompleted = !milestone.completedAt;
    const completedGoal = !goal.completedAt && !!next.completedAt;
    const celebration = justCompleted
      ? completedGoal
        ? { title: 'You did it!', message: `You completed "${goal.title}". Take a moment to enjoy that.` }
        : { title: 'A lovely step forward', message: `"${milestone.title}" is one more step toward "${goal.title}".` }
      : undefined;
    void updateGoal(next, completedGoal ? 'Goal complete. You made it happen.' : 'Milestone updated.', celebration);
  }

  function markComplete(goal: PersonalGoal) {
    void updateGoal(
      completePersonalGoal(goal, date),
      'Goal complete. You made it happen.',
      { title: 'You did it!', message: `"${goal.title}" is complete. Enjoy this moment.` },
    );
  }

  function archiveGoal(goal: PersonalGoal) {
    void updateGoal({ ...goal, archivedAt: date }, 'Goal archived. You can bring it back any time.');
  }

  function restoreGoal(goal: PersonalGoal) {
    const { archivedAt: _archivedAt, ...restored } = goal;
    void updateGoal(restored, 'Goal restored.');
  }

  async function deleteGoal(goal: PersonalGoal) {
    if (!window.confirm(`Delete "${goal.title}"? This cannot be undone.`)) return;
    const next = goals.filter((entry) => entry.id !== goal.id);
    try {
      await savePersonalGoals(next);
      setGoals(next);
      const reminderMessage = await rescheduleGoalDates(next);
      setMessage({
        ok: !reminderMessage,
        text: reminderMessage ? `Goal deleted. ${reminderMessage}` : 'Goal deleted.',
      });
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : 'Could not delete this goal.' });
    }
  }

  function extendDate(goal: PersonalGoal) {
    void updateGoal(
      { ...goal, targetDate: extendGoalDate(goal, date) },
      'Date extended by one month. Keep moving at your own pace.',
    );
  }

  function renderGoal(goal: PersonalGoal, archived = false) {
    const progress = personalGoalProgress(goal, responses, date);
    const overdue = isGoalOverdue(goal, date);
    return (
      <article className="plan-goal-card" data-category={goal.category} key={goal.id}>
        <div className="row gap center-v">
          <IconTile kind={goal.category} />
          <div className="stack-sm" style={{ flex: 1, minWidth: 0, gap: 3 }}>
            <h3>{goal.title}</h3>
            <span className="xs muted">{CATEGORIES.find((category) => category.id === goal.category)?.label} · {dateLabel(goal.targetDate)}</span>
          </div>
          <strong className="small" aria-label={`${progress.percent}% complete`}>{progress.percent}%</strong>
        </div>
        {goal.target && <p className="small muted" style={{ margin: 0 }}>Target: {goal.target}</p>}
        <RangeBar min={0} max={100} value={progress.percent} label={`${goal.title} progress`} />
        {goal.routineItemId && (
          <p className="xs muted" style={{ margin: 0 }}>
            {routineItems.find((item) => item.id === goal.routineItemId)?.title ?? 'Linked routine'} · {progress.routineCompletions} of {goal.routineTarget} completions
          </p>
        )}
        {goal.milestones.length > 0 && (
          <ul className="plan-milestones">
            {goal.milestones.map((milestone) => (
              <li key={milestone.id}>
                <label className="plan-milestone">
                  <input
                    type="checkbox"
                    checked={!!milestone.completedAt}
                    disabled={archived || !!goal.completedAt}
                    onChange={() => toggleMilestone(goal, milestone)}
                  />
                  <span>{milestone.title}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
        {overdue && !archived && (
          <div className="plan-overdue stack-sm">
            <strong>Want to adjust the date?</strong>
            <p className="xs muted" style={{ margin: 0 }}>Plans can change. You can give yourself a little more time.</p>
            <div className="row gap wrap">
              <button type="button" className="btn sm" onClick={() => extendDate(goal)}>Extend by 1 month</button>
              <button type="button" className="btn sm ghost" onClick={() => startEdit(goal)}>Choose a date</button>
            </div>
          </div>
        )}
        {goal.completedAt && <p className="xs muted" style={{ margin: 0 }}>Completed {dateLabel(goal.completedAt)}</p>}
        <div className="row gap wrap">
          {!archived && !goal.completedAt && (
            <button type="button" className="btn sm" onClick={() => markComplete(goal)}>Mark complete</button>
          )}
          {!archived && <button type="button" className="btn sm ghost" onClick={() => startEdit(goal)}>Edit</button>}
          {!archived && <button type="button" className="btn sm ghost" onClick={() => archiveGoal(goal)}>Archive</button>}
          {archived && <button type="button" className="btn sm" onClick={() => restoreGoal(goal)}>Restore</button>}
          <button type="button" className="btn sm ghost" onClick={() => void deleteGoal(goal)}>Delete</button>
        </div>
      </article>
    );
  }

  return (
    <section className="ds-demo-page plan-page stack-lg">
      <ScreenHeader
        title="Goals"
        date="Small steps, on your timeline"
        onSettingsClick={() => onNavigate('me')}
      />
      <p className="small muted" style={{ margin: 0 }}>Personal-growth nudges, not medical advice. Progress is yours to define.</p>
      {message && (
        <div className={`status-banner ${message.ok ? 'ok' : 'error'}`} role={message.ok ? 'status' : 'alert'}>
          {message.text}
        </div>
      )}
      <div className="aura-segmented inline" role="tablist" aria-label="Goal timeline">
        {(['short-term', 'long-term'] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={term === value}
            className={term === value ? 'active' : ''}
            onClick={() => setTerm(value)}
          >
            {value === 'short-term' ? 'Short-term' : 'Long-term'}
          </button>
        ))}
      </div>

      <section className="stack-sm" aria-label={`${term} goals`}>
        <div className="section-heading">
          <div>
            <h2>{term === 'short-term' ? 'A few weeks to a few months' : 'Three months and beyond'}</h2>
            <p className="xs muted">{term === 'short-term' ? 'Goals due within about three months, including goals without a date.' : 'Goals with a target date at least three months away.'}</p>
          </div>
          <button type="button" className="btn sm primary" onClick={startNew}>Add goal</button>
        </div>
        {visibleGoals.length
          ? <div className="plan-goal-list">{visibleGoals.map((goal) => renderGoal(goal))}</div>
          : <p className="card small muted">No {term} goals yet. Add one when you feel ready.</p>}
      </section>

      {formOpen && (
        <form className="card stack-md" onSubmit={(event) => void saveGoal(event)}>
          <h2>{editingId ? 'Edit goal' : 'Add a goal'}</h2>
          <label className="stack-sm small">
            Title
            <input className="input" value={draft.title} maxLength={80} required onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
          </label>
          <label className="stack-sm small">
            Category
            <select className="input" value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value as GoalCategory })}>
              {CATEGORIES.map((category) => <option value={category.id} key={category.id}>{category.label}</option>)}
            </select>
          </label>
          <label className="stack-sm small">
            Target date (optional)
            <input className="input" type="date" value={draft.targetDate ?? ''} onChange={(event) => setDraft({ ...draft, targetDate: event.target.value || undefined, reminderEnabled: event.target.value ? draft.reminderEnabled : false })} />
          </label>
          <label className="stack-sm small">
            Measurable target (optional)
            <input className="input" maxLength={120} placeholder="e.g. walk 8,000 steps or read 20 pages" value={draft.target ?? ''} onChange={(event) => setDraft({ ...draft, target: event.target.value })} />
          </label>
          <label className="stack-sm small">
            Milestones (one small step per line)
            <textarea className="input" rows={4} maxLength={500} placeholder={'Choose a first step\nMake time for it'} value={milestonesText} onChange={(event) => setMilestonesText(event.target.value)} />
          </label>
          <label className="stack-sm small">
            Link a routine item (optional)
            <select className="input" value={draft.routineItemId ?? ''} onChange={(event) => {
              const routineItemId = event.target.value || undefined;
              setDraft({
                ...draft,
                routineItemId,
                routineLinkedAt: routineItemId
                  ? routineItemId !== draft.routineItemId ? date : draft.routineLinkedAt
                  : undefined,
              });
            }}>
              <option value="">No linked routine</option>
              {routineItems.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
            </select>
          </label>
          {draft.routineItemId && (
            <label className="stack-sm small">
              Routine completions that count toward this goal
              <input className="input" type="number" min="1" max="365" value={draft.routineTarget} onChange={(event) => setDraft({ ...draft, routineTarget: Number(event.target.value) })} />
            </label>
          )}
          <label className="toggle-row">
            <input type="checkbox" checked={!!draft.reminderEnabled} disabled={!draft.targetDate} onChange={(event) => setDraft({ ...draft, reminderEnabled: event.target.checked })} />
            <span className="small">Gentle reminder on the target date (optional)</span>
          </label>
          {!draft.targetDate && <p className="xs muted">Add a target date to enable a reminder.</p>}
          <div className="row gap wrap">
            <button type="submit" className="btn primary">Save goal</button>
            <button type="button" className="btn ghost" onClick={() => setFormOpen(false)}>Cancel</button>
          </div>
        </form>
      )}

      <details className="card stack-sm" open={showArchived} onToggle={(event) => setShowArchived(event.currentTarget.open)}>
        <summary className="small">Archived goals ({archivedGoals.length})</summary>
        {archivedGoals.length
          ? <div className="plan-goal-list">{archivedGoals.map((goal) => renderGoal(goal, true))}</div>
          : <p className="xs muted">Archived goals will be kept here.</p>}
      </details>

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
