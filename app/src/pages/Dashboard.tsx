import { useMemo, useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { DayRecord } from '../types';
import { runInsights } from '../insights/engine';
import { balanceScore } from '../insights/balance';
import { weeklySummary } from '../summary/weekly';
import { AuraAvatar } from '../avatar/AuraAvatar';
import { CharacterModal } from '../avatar/CharacterModal';
import { useMe } from '../avatar/AvatarContext';
import { avatarMood } from '../avatar/mood';
import { InsightCard } from '../components/InsightCard';
import { MetricCard } from '../components/MetricCard';
import { StillLearningCard } from '../components/StillLearningCard';
import { MoodIcon, PhoneIcon, SleepIcon, StepsIcon } from '../components/Icons';
import { generateDemoData } from '../lib/demoData';
import { today } from '../lib/dates';
import { saveDay } from '../lib/store';
import { setConsent } from '../lib/vault';
import { notify } from '../native/bridge';
import { syncPhoneData } from '../sync/phoneSync';
import type { AppTab } from '../components/AppShell';

const MOOD_LABELS: Record<NonNullable<DayRecord['mood']>, string> = {
  1: 'Low (1/5)',
  2: 'Tired (2/5)',
  3: 'Okay (3/5)',
  4: 'Good (4/5)',
  5: 'Great (5/5)',
};

function greetingForNow(name?: string): string {
  const hour = new Date().getHours();
  const base = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
  const cleanName = name?.trim();
  return cleanName ? `${base}, ${cleanName}!` : `${base}!`;
}

interface DashboardProps {
  days: DayRecord[];
  onChange: () => Promise<void>;
  onNavigate?: (tab: AppTab) => void;
}

export function Dashboard({ days, onChange, onNavigate }: DashboardProps) {
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [range, setRange] = useState<7 | 14 | 30>(30);
  const [showScoreDetails, setShowScoreDetails] = useState(false);
  const [showWeeklyMore, setShowWeeklyMore] = useState(false);
  const [showCharacter, setShowCharacter] = useState(false);

  const latest = days[days.length - 1];
  const insights = useMemo(() => runInsights(days), [days]);
  const readyInsights = useMemo(() => insights.filter((i) => !i.notEnoughData), [insights]);
  const pendingInsights = useMemo(() => insights.filter((i) => i.notEnoughData), [insights]);
  const balance = useMemo(
    () => (latest ? balanceScore(latest, days.slice(0, -1)) : null),
    [latest, days],
  );
  const weekly = useMemo(() => weeklySummary(days), [days]);
  const me = useMe();
  const greeting = greetingForNow(me.name);
  const mood = avatarMood(latest, balance?.score);

  const sleepSeries = useMemo(
    () => days.slice(-7).map((d) => d.sleepHours).filter((v): v is number => v !== undefined),
    [days],
  );
  const stepSeries = useMemo(
    () => days.slice(-7).map((d) => d.steps).filter((v): v is number => v !== undefined),
    [days],
  );
  const screenSeries = useMemo(
    () => days.slice(-7).map((d) => d.screenMinutes).filter((v): v is number => v !== undefined),
    [days],
  );
  const moodSeries = useMemo(
    () => days.slice(-7).map((d) => d.mood).filter((v): v is NonNullable<DayRecord['mood']> => v !== undefined),
    [days],
  );

  const chart = useMemo(
    () =>
      days.slice(-range).map((d) => ({
        date: d.date.slice(5),
        Sleep: d.sleepHours,
        'Late screen (hrs)':
          d.lateScreenMin !== undefined
            ? Math.round((d.lateScreenMin / 60) * 100) / 100
            : undefined,
      })),
    [days, range],
  );

  async function loadDemo() {
    setBusy(true);
    try {
      await setConsent('demo', true);
      const demo = generateDemoData(today());
      for (const d of demo) await saveDay(d);
      await onChange();
      setMsg(`Loaded ${demo.length} days of DEMO data (clearly labelled as sample data).`);
    } finally {
      setBusy(false);
    }
  }

  async function readPhone() {
    setBusy(true);
    try {
      const r = await syncPhoneData({ interactive: true });
      await onChange();
      const parts: string[] = [];
      if (r.screen.state === 'synced') parts.push(`${r.screen.days} days of screen time`);
      if (r.health.state === 'synced') parts.push(`${r.health.days} days of band and health data`);
      setMsg(
        parts.length
          ? `Read ${parts.join(' and ')} from this phone.`
          : r.screen.message || r.health.message || 'Open the Phone data tab to allow a source.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function testNudge() {
    const r = await notify(
      'AURA',
      'Late screens cost you sleep. Try putting the phone down by 11 pm.',
      5,
    );
    setMsg(r.message);
  }

  if (!latest) {
    return (
      <section className="stack-lg">
        <div>
          <h2 style={{ margin: 0 }}>{greeting}</h2>
          <p className="xs muted">Welcome to AURA · {today()}</p>
        </div>
        <div className="card stack-md">
          <div>
            <h2>Welcome to AURA</h2>
            <p className="muted small">
              Your vault is unlocked, and there is no wellness data yet. Start with clearly labelled
              demo data, read Android screen time, or record a quick check-in.
            </p>
          </div>
          <div className="row gap wrap">
            <button type="button" className="btn primary" onClick={loadDemo} disabled={busy}>
              Load DEMO data
            </button>
            <button type="button" className="btn" onClick={readPhone} disabled={busy}>
              Read my screen time (Android)
            </button>
            {onNavigate && (
              <button type="button" className="btn" onClick={() => onNavigate('checkin')}>
                Go to Check-in
              </button>
            )}
          </div>
          {msg && <p className="status-banner">{msg}</p>}
        </div>
      </section>
    );
  }

  return (
    <section className="stack-lg">
      <div>
        <h2 style={{ margin: 0 }}>{greeting}</h2>
        <p className="xs muted">Your daily wellness overview · {latest.date}</p>
      </div>
      {/* Top Hero: Balance Score + Weekly Summary */}
      <div className="dashboard-hero-grid">
        <div className="card stack-md">
          <div className="row between wrap">
            <div>
              <h2>Balance Score</h2>
              <p className="xs muted">Latest day: {latest.date}</p>
            </div>
            <div className="row gap-sm center-v">
              {latest.source === 'demo' && <span className="pill demo">DEMO</span>}
              <button
                type="button"
                className="btn sm"
                onClick={() => setShowScoreDetails((s) => !s)}
                aria-expanded={showScoreDetails}
              >
                {showScoreDetails ? 'Hide breakdown' : 'Score details'}
              </button>
            </div>
          </div>

          <div className="row gap center-v wrap">
            {balance && (
              <div className="stack-sm center">
                <button
                  type="button"
                  onClick={() => (me.choice.kind === 'character' ? setShowCharacter(true) : setShowScoreDetails((s) => !s))}
                  aria-label={`Your avatar. Balance Score ${balance.score} out of 100. ${mood.label}.${me.choice.kind === 'character' ? ' Tap to see your character.' : ''}`}
                  style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer' }}
                >
                  <AuraAvatar choice={me.choice} photo={me.photo} name={me.name} size={120} score={balance.score} mood={mood} />
                </button>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '2rem', fontWeight: 700, lineHeight: 1, color: mood.color }}>{balance.score}</div>
                  <div className="xs muted">{mood.label}</div>
                </div>
              </div>
            )}
            {showCharacter && (
              <CharacterModal
                choice={me.choice}
                mood={mood}
                score={balance?.score}
                sleepy={latest.sleepHours !== undefined && latest.sleepHours < 6}
                active={(latest.steps ?? 0) >= 8000}
                onClose={() => setShowCharacter(false)}
                onChange={() => {
                  setShowCharacter(false);
                  onNavigate?.('profile');
                }}
              />
            )}
            <div className="grow">
              <ul className="reasons-list">
                {balance?.reasons.map((r) => {
                  const pct = Math.round((r.points / r.max) * 100);
                  return (
                    <li key={r.label} className="reason-row">
                      <div className="row between small">
                        <strong>{r.label}</strong>
                        <span className="muted">
                          {r.points}/{r.max} pts
                        </span>
                      </div>
                      <div className="bar" aria-hidden="true">
                        <div style={{ width: `${pct}%` }} />
                      </div>
                      {showScoreDetails && <span className="xs muted">{r.note}</span>}
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>

        <div className="card stack-md">
          <div className="row between wrap">
            <div>
              <h2>Weekly Summary</h2>
              <p className="xs muted">
                Last {weekly.daysCount} day{weekly.daysCount === 1 ? '' : 's'}
              </p>
            </div>
            <div className="row gap-sm center-v">
              <span className="pill primary">7-day view</span>
              {weekly.sentences.length > 2 && (
                <button
                  type="button"
                  className="btn sm"
                  aria-expanded={showWeeklyMore}
                  onClick={() => setShowWeeklyMore((v) => !v)}
                >
                  {showWeeklyMore ? 'Less' : 'More'}
                </button>
              )}
            </div>
          </div>

          <div className="stack-sm">
            {(showWeeklyMore ? weekly.sentences : weekly.sentences.slice(0, 2)).map((s) => (
              <p key={s} className="small" style={{ lineHeight: 1.55 }}>
                {s}
              </p>
            ))}
          </div>

          <div className="suggest-box" style={{ marginTop: 'auto' }}>
            <strong>Suggestion:</strong> {weekly.suggestion}
          </div>
        </div>
      </div>

      {/* Daily Snapshot Metric Cards */}
      <div className="grid-4">
        <MetricCard
          label="Sleep"
          dateLabel={latest.date}
          value={latest.sleepHours !== undefined ? latest.sleepHours.toFixed(1) : undefined}
          unit={latest.sleepHours !== undefined ? 'h' : undefined}
          sub={latest.sleepHours !== undefined ? 'Last logged night' : 'No sleep data yet'}
          emptyAction="Log sleep"
          accent="purple"
          icon={<SleepIcon size={18} />}
          series={sleepSeries}
          onClick={() => onNavigate?.('checkin')}
        />
        <MetricCard
          label="Movement"
          dateLabel={latest.date}
          value={latest.steps !== undefined ? latest.steps.toLocaleString() : undefined}
          unit={latest.steps !== undefined ? 'steps' : undefined}
          sub={latest.steps !== undefined ? 'Daily steps' : 'No step data yet'}
          emptyAction="View goals"
          accent="blue"
          icon={<StepsIcon size={18} />}
          series={stepSeries}
          onClick={() => onNavigate?.('goals')}
        />
        <MetricCard
          label="Screen time"
          dateLabel={latest.date}
          value={latest.screenMinutes !== undefined ? (latest.screenMinutes / 60).toFixed(1) : undefined}
          unit={latest.screenMinutes !== undefined ? 'h' : undefined}
          sub={
            latest.lateScreenMin !== undefined
              ? `${Math.round(latest.lateScreenMin)} min after 23:00`
              : 'Manage in Phone data'
          }
          emptyAction="Connect source"
          accent="coral"
          icon={<PhoneIcon size={18} />}
          series={screenSeries}
          onClick={() => onNavigate?.('phone')}
        />
        <MetricCard
          label="Mood"
          dateLabel={latest.date}
          value={latest.mood !== undefined ? MOOD_LABELS[latest.mood].split(' ')[0] : undefined}
          unit={latest.mood !== undefined ? `${latest.mood}/5` : undefined}
          sub={latest.mood !== undefined ? 'Latest check-in' : 'No mood logged yet'}
          emptyAction="Check in"
          accent="primary"
          icon={<MoodIcon size={18} />}
          series={moodSeries}
          onClick={() => onNavigate?.('checkin')}
        />
      </div>

      {/* Ranked Insights */}
      <div className="stack-sm">
        <div className="section-heading">
          <h3>What AURA noticed</h3>
          <span className="xs muted">Ranked by statistical signal</span>
        </div>
        {readyInsights.length > 0 && (
          <div className="grid-2">
            {readyInsights.map((insight, idx) => (
              <InsightCard key={insight.id} insight={insight} rank={idx + 1} />
            ))}
          </div>
        )}
        <StillLearningCard insights={pendingInsights} />
      </div>

      {/* Sleep vs Late-Screen Chart */}
      <div className="card stack-md">
        <div className="row between wrap">
          <div>
            <h3>Sleep vs. late-night screen time</h3>
            <p className="xs muted">
              Comparing hours slept against screen time after 23:00 (correlation does not imply causation)
            </p>
          </div>
          <div className="row gap-sm">
            {([7, 14, 30] as const).map((r) => (
              <button
                key={r}
                type="button"
                className={`btn sm ${range === r ? 'primary' : ''}`}
                onClick={() => setRange(r)}
              >
                {r}d
              </button>
            ))}
          </div>
        </div>

        <p className="sr-only">
          {chart.length > 0
            ? `Showing ${chart.length} days from ${chart[0].date} to ${chart[chart.length - 1].date}. Latest sleep: ${latest.sleepHours ?? 'not logged'} hours.`
            : 'No chart data logged yet.'}
        </p>
        <div style={{ width: '100%', height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chart} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--aura-border)" strokeOpacity={0.5} />
              <XAxis dataKey="date" fontSize={11} stroke="var(--aura-muted)" />
              <YAxis fontSize={11} stroke="var(--aura-muted)" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--aura-shell)',
                  borderColor: 'var(--aura-border)',
                  borderRadius: 10,
                  color: 'var(--aura-text)',
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="Sleep"
                name="Sleep (hrs)"
                stroke="var(--aura-primary)"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5 }}
              />
              <Line
                type="monotone"
                dataKey="Late screen (hrs)"
                name="Late screen (hrs)"
                stroke="var(--aura-coral)"
                strokeWidth={2.2}
                dot={false}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Actions */}
      <div className="card row between wrap">
        <div className="row gap wrap">
          <button type="button" className="btn" onClick={readPhone} disabled={busy}>
            Read screen time (Android)
          </button>
          <button type="button" className="btn" onClick={testNudge} disabled={busy}>
            Send test nudge
          </button>
          <button type="button" className="btn" onClick={loadDemo} disabled={busy}>
            Reload DEMO data
          </button>
        </div>
        {msg && <span className="small muted">{msg}</span>}
      </div>
    </section>
  );
}
