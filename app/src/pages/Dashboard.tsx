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
import { useMe } from '../avatar/AvatarContext';
import { avatarMood } from '../avatar/mood';
import { InsightCard } from '../components/InsightCard';
import { MetricCard } from '../components/MetricCard';
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

  const latest = days[days.length - 1];
  const insights = useMemo(() => runInsights(days), [days]);
  const balance = useMemo(
    () => (latest ? balanceScore(latest, days.slice(0, -1)) : null),
    [latest, days],
  );
  const weekly = useMemo(() => weeklySummary(days), [days]);
  const me = useMe();
  const mood = avatarMood(latest, balance?.score);

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
              <button
                type="button"
                onClick={() => setShowScoreDetails((s) => !s)}
                aria-label={`Balance Score ${balance.score} out of 100. ${mood.label}. Show breakdown.`}
                style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer' }}
                className="stack-sm center"
              >
                <AuraAvatar choice={me.choice} photo={me.photo} name={me.name} size={132} score={balance.score} mood={mood} threeD />
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '2rem', fontWeight: 700, lineHeight: 1, color: mood.color }}>{balance.score}</div>
                  <div className="xs muted">{mood.label}</div>
                </div>
              </button>
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
          <div className="row between">
            <div>
              <h2>Weekly Summary</h2>
              <p className="xs muted">
                Last {weekly.daysCount} day{weekly.daysCount === 1 ? '' : 's'}
              </p>
            </div>
            <span className="pill primary">7-day view</span>
          </div>

          <div className="stack-sm">
            {weekly.sentences.map((s) => (
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
          value={latest.sleepHours !== undefined ? `${latest.sleepHours.toFixed(1)} h` : '—'}
          sub={latest.sleepHours !== undefined ? 'Last logged night' : 'Tap to log sleep'}
          accent="purple"
          onClick={() => onNavigate?.('checkin')}
        />
        <MetricCard
          label="Movement"
          value={latest.steps !== undefined ? latest.steps.toLocaleString() : '—'}
          sub={latest.steps !== undefined ? 'Steps on latest day' : 'Not recorded yet'}
          accent="blue"
          onClick={() => onNavigate?.('goals')}
        />
        <MetricCard
          label="Screen time"
          value={
            latest.screenMinutes !== undefined
              ? `${(latest.screenMinutes / 60).toFixed(1)} h`
              : '—'
          }
          sub={
            latest.lateScreenMin !== undefined
              ? `${Math.round(latest.lateScreenMin)} min after 23:00`
              : 'Tap to manage sources'
          }
          accent="coral"
          onClick={() => onNavigate?.('vault')}
        />
        <MetricCard
          label="Mood"
          value={latest.mood !== undefined ? MOOD_LABELS[latest.mood] : '—'}
          sub={latest.mood !== undefined ? 'Latest check-in' : 'Tap to check in'}
          accent="primary"
          onClick={() => onNavigate?.('checkin')}
        />
      </div>

      {/* Ranked Insights */}
      <div className="stack-sm">
        <div className="section-heading">
          <h3>What AURA noticed</h3>
          <span className="xs muted">Ranked by statistical signal</span>
        </div>
        <div className="grid-2">
          {insights.map((insight, idx) => (
            <InsightCard key={insight.id} insight={insight} rank={idx + 1} />
          ))}
        </div>
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
