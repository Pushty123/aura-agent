import { useEffect, useState } from 'react';
import { Bell, Hourglass, Sparkles } from 'lucide-react';
import { today } from '../lib/dates';
import { getSession } from '../lib/account';
import { askSmart, buildContext, getAiConsent } from '../lib/ai';
import { getAppUsage, isNative, pushAppLimits, type AppUse } from '../native/bridge';
import { demoApps, fmtMin, loadLimits, saveLimits } from '../apps/appUsage';
import { applyReminders, loadReminders } from '../reminders/reminders';
import { deleteGoal, loadGoals, saveGoal, METRICS } from '../goals/goals';
import { buildPlan, EXAMPLES, loadPlans, mergeLimits, parseGoal, savePlans, summarise, type Plan, type SavedPlan } from '../goals/planner';
import type { DayRecord } from '../types';

const fmt = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
const KIND_LABEL = { exam: 'Exam plan', fitness: 'Fitness plan', sleep: 'Sleep plan', screen: 'Screen-time plan', habit: 'Habit plan' };

/** Type a goal in your own words; AURA builds a plan from your data. Nothing is set until you tap Apply. */
export function PlanCard({ days, onApplied }: { days: DayRecord[]; onApplied: () => Promise<void> | void }) {
  const date = today();
  const [text, setText] = useState('');
  const [plan, setPlan] = useState<Plan | null>(null);
  const [skip, setSkip] = useState<Set<string>>(new Set());
  const [apps, setApps] = useState<AppUse[]>([]);
  const [demoUsage, setDemoUsage] = useState(false);
  const [plans, setPlans] = useState<SavedPlan[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [ai, setAi] = useState<{ busy: boolean; text?: string; error?: string }>({ busy: false });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void loadPlans().then(setPlans);
  }, []);

  async function usage(): Promise<AppUse[]> {
    const r = await getAppUsage();
    if (r.ok) return r.apps;
    if (r.reason === 'web') {
      setDemoUsage(true);
      return demoApps().apps;
    }
    return [];
  }

  async function make(input = text) {
    setMsg(null);
    setAi({ busy: false });
    try {
      const a = apps.length ? apps : await usage();
      setApps(a);
      const p = buildPlan(parseGoal(input, date), { today: date, days, apps: a });
      setPlan(p);
      setSkip(new Set());
    } catch (e) {
      setPlan(null);
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Could not make a plan.' });
    }
  }

  const keep = <T extends { id?: string; pkg?: string }>(x: T) => !skip.has((x.id ?? x.pkg)!);
  const toggle = (k: string) => setSkip((s) => {
    const n = new Set(s);
    if (n.has(k)) n.delete(k);
    else n.add(k);
    return n;
  });

  async function apply() {
    if (!plan) return;
    setBusy(true);
    try {
      const goals = plan.goals.filter(keep);
      const rems = plan.reminders.filter(keep);
      const limits = plan.limits.filter(keep);
      for (const g of goals) await saveGoal(g);
      const r = await applyReminders([...(await loadReminders()), ...rems]);
      let limitNote = '';
      if (limits.length) {
        const merged = mergeLimits(await loadLimits(), limits);
        await saveLimits(merged);
        const pushed = await pushAppLimits(merged);
        limitNote = pushed ? ` ${limits.length} app limit${limits.length > 1 ? 's' : ''} on.` : ' App limits saved (they work in the Android app).';
      }
      const saved = { ...summarise(plan), limitPkgs: limits.map((l) => l.pkg) };
      const next = [saved, ...plans.filter((x) => x.id !== plan.id)];
      await savePlans(next);
      setPlans(next);
      setPlan(null);
      setText('');
      setMsg({ ok: true, text: `Plan applied: ${goals.length} goals, ${rems.length} reminders.${limitNote}${isNative() && !r.ok ? ` ${r.message}` : ''}` });
      await onApplied();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Could not apply the plan.' });
    } finally {
      setBusy(false);
    }
  }

  async function remove(p: SavedPlan) {
    if (!window.confirm(`Remove "${p.title}"? Its goals, reminders and app limits will be removed.`)) return;
    for (const g of (await loadGoals()).filter((g) => g.planId === p.id)) await deleteGoal(g.id);
    await applyReminders((await loadReminders()).filter((r) => r.planId !== p.id));
    if (p.limitPkgs.length) {
      const rest = (await loadLimits()).filter((l) => !p.limitPkgs.includes(l.pkg));
      await saveLimits(rest);
      await pushAppLimits(rest);
    }
    const next = plans.filter((x) => x.id !== p.id);
    await savePlans(next);
    setPlans(next);
    setMsg({ ok: true, text: `Removed "${p.title}".` });
    await onApplied();
  }

  async function askAi() {
    if (!plan) return;
    setAi({ busy: true });
    try {
      if (!(await getAiConsent()) || !(await getSession())) throw new Error('Turn on smart replies in Ask (and log in) to get AI advice.');
      const q = `I made this plan: "${plan.title}"${plan.daysLeft !== null ? `, ${plan.daysLeft} days left` : ''}. Goals: ${plan.goals.map((g) => g.title).join(', ')}. Give me 4 short, practical tips to stick to it, based on my data.`;
      setAi({ busy: false, text: await askSmart(q, [], buildContext(days)) });
    } catch (e) {
      setAi({ busy: false, error: e instanceof Error ? e.message : 'AI advice is not available right now.' });
    }
  }

  const active = plans.filter((p) => !p.until || p.until >= date);

  return (
    <div className="card stack-md">
      <div>
        <h2 className="row gap-sm center-v" style={{ margin: 0 }}><Sparkles size={20} aria-hidden="true" /> Plan with AURA</h2>
        <p className="xs muted">Type a goal in your own words. AURA builds a plan from your sleep, screen time and app usage. You review it before anything is set.</p>
      </div>
      <form className="row gap wrap" onSubmit={(e) => { e.preventDefault(); void make(); }}>
        <input className="input grow" placeholder='e.g. "Exams on 15 Dec: Maths, Physics, Chemistry"' value={text} onChange={(e) => setText(e.target.value)} maxLength={160} aria-label="Your goal" />
        <button type="submit" className="btn primary" disabled={!text.trim()}>Make my plan</button>
      </form>
      {!plan && (
        <div className="row gap wrap center-v">
          <span className="xs muted">Try:</span>
          {EXAMPLES.map((ex) => (
            <button key={ex} type="button" className="pill" style={{ cursor: 'pointer', border: '1px solid var(--aura-border)' }} onClick={() => { setText(ex); void make(ex); }}>{ex}</button>
          ))}
        </div>
      )}
      {msg && <div className={`status-banner ${msg.ok ? 'ok' : 'error'}`} role="status">{msg.text}</div>}

      {plan && (
        <div className="card-subtle stack-md">
          <div className="row between wrap center-v">
            <div>
              <span className="pill primary">{KIND_LABEL[plan.kind]}</span>
              <h3 style={{ margin: '6px 0 0' }}>{plan.title}</h3>
            </div>
            {plan.daysLeft !== null && (
              <div style={{ textAlign: 'right' }}>
                <div className="big-number" style={{ fontSize: '2rem' }}>{plan.daysLeft}</div>
                <span className="xs muted">days left · until {fmt(plan.until!)}</span>
              </div>
            )}
          </div>

          {plan.phases.length > 0 && (
            <div className="stack-sm">
              <strong className="small">Schedule</strong>
              {plan.phases.map((ph) => (
                <div key={ph.label} className="row gap">
                  <strong className="small" style={{ flex: '0 0 96px', color: 'var(--aura-primary, #2dd4bf)' }}>{ph.label}</strong>
                  <span className="small" style={{ flex: 1, minWidth: 0 }}><span className="muted" style={{ display: 'block' }}>{fmt(ph.from)} – {fmt(ph.to)}</span>{ph.detail}</span>
                </div>
              ))}
            </div>
          )}
          {plan.timetable.length > 0 && (
            <div className="stack-sm">
              <strong className="small">This week</strong>
              <ul className="audit-list">
                {plan.timetable.map((t) => (
                  <li key={t.date} className="audit-item"><span className="xs muted" style={{ minWidth: 92 }}>{fmt(t.date)}</span><span className="small">{t.task}</span></li>
                ))}
              </ul>
            </div>
          )}

          <div className="stack-sm">
            <strong className="small">What will be set (untick anything you don’t want)</strong>
            {plan.goals.map((g) => (
              <label key={g.id} className="row gap center-v small">
                <input type="checkbox" checked={keep(g)} onChange={() => toggle(g.id)} />
                {g.icon} Goal: {g.title}
                {g.metric !== 'habit' && <span className="muted">({METRICS[g.metric].direction === 'atMost' ? 'at most' : 'at least'} {g.target} {METRICS[g.metric].unit})</span>}
              </label>
            ))}
            {plan.reminders.map((r) => (
              <label key={r.id} className="row gap center-v small">
                <input type="checkbox" checked={keep(r)} onChange={() => toggle(r.id)} />
                <Bell size={14} aria-hidden="true" /> {r.time} · {r.title}
              </label>
            ))}
            {plan.limits.map((l) => (
              <label key={l.pkg} className="row gap center-v small">
                <input type="checkbox" checked={keep(l)} onChange={() => toggle(l.pkg)} />
                <Hourglass size={14} aria-hidden="true" /> Limit {l.label} to {fmtMin(l.minutes)} a day
              </label>
            ))}
            {demoUsage && plan.limits.length > 0 && <p className="xs muted">App limits here use DEMO app usage in the browser. The Android app uses your real usage.</p>}
          </div>

          {plan.reasons.length > 0 && (
            <div className="stack-sm">
              <strong className="small">Why these numbers</strong>
              <ul className="small reasons-list">{plan.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
            </div>
          )}
          <div className="stack-sm">
            <strong className="small">Tips</strong>
            <ul className="small">{plan.tips.map((t) => <li key={t}>{t}</li>)}</ul>
          </div>

          {ai.text && <div className="chat-bubble-aura small" style={{ whiteSpace: 'pre-wrap' }}>{ai.text}</div>}
          {ai.error && <p className="xs muted">{ai.error}</p>}

          <div className="row gap wrap">
            <button type="button" className="btn primary" disabled={busy} onClick={() => void apply()}>{busy ? 'Applying…' : 'Apply plan'}</button>
            <button type="button" className="btn" disabled={ai.busy} onClick={() => void askAi()}>{ai.busy ? 'Asking…' : 'AI tips for this plan'}</button>
            <button type="button" className="btn ghost" onClick={() => setPlan(null)}>Cancel</button>
          </div>
        </div>
      )}

      {active.length > 0 && (
        <div className="stack-sm">
          <strong className="small">Active plans</strong>
          {active.map((p) => {
            const left = p.until ? Math.round((new Date(`${p.until}T12:00:00`).getTime() - new Date(`${date}T12:00:00`).getTime()) / 86_400_000) : null;
            const now = p.phases.find((ph) => date >= ph.from && date <= ph.to);
            return (
              <div key={p.id} className="card-subtle row between center-v gap">
                <div className="stack-sm" style={{ gap: 2 }}>
                  <strong className="small">{p.title}</strong>
                  <span className="xs muted">
                    {left !== null ? `${left} day${left === 1 ? '' : 's'} left` : ''}
                    {now ? ` · Now: ${now.label}` : ''}
                  </span>
                </div>
                <button type="button" className="btn sm ghost" onClick={() => void remove(p)}>Remove</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
