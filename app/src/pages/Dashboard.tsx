import { useEffect, useMemo, useState } from 'react';
import type { DayRecord } from '../types';
import { runInsights } from '../insights/engine';
import { balanceScore } from '../insights/balance';
import { weeklySummary } from '../summary/weekly';
import { useMe } from '../avatar/AvatarContext';
import { InsightCard } from '../components/InsightCard';
import { StillLearningCard } from '../components/StillLearningCard';
import { StreakRow } from '../components/Streaks';
import { streaks } from '../goals/badges';
import { thoughtFor, todayLine } from '../home/thoughts';
import { speak, stopSpeaking } from '../voice/voice';
import { generateDemoData } from '../lib/demoData';
import { today } from '../lib/dates';
import { patchDay, saveDay } from '../lib/store';
import { setConsent } from '../lib/vault';
import { syncPhoneData } from '../sync/phoneSync';
import type { AppTab } from '../components/AppShell';
import { MetricCard, ScreenHeader } from '../components/design-system';
import { DEFAULT_PERMISSIONS, getPermissions, type Permissions } from '../lib/permissions';
import { loadWorkouts, type Workout } from '../exercise/workouts';
import { todayMetrics } from '../home/todayMetrics';

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
  const [speaking, setSpeaking] = useState(false);
  const [permissions, setPermissions] = useState<Permissions | null>(null);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const streakList = useMemo(() => streaks(days, today()), [days]);

  const latest = days[days.length - 1];
  const todayRecord = days.find((d) => d.date === today());
  useEffect(() => {
    void getPermissions().then(setPermissions);
    void loadWorkouts().then(setWorkouts);
  }, []);
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

  const metrics = todayMetrics(
    todayRecord,
    days.filter((d) => todayRecord && d.date < todayRecord.date),
    permissions ?? DEFAULT_PERMISSIONS,
    workouts,
  );
  const metricsSection = (
    <>
      <div className="ds-metric-grid ds-today-grid">
        {metrics.map((metric) => <MetricCard key={metric.kind} {...metric} />)}
      </div>
      {(permissions ?? DEFAULT_PERMISSIONS).heartRate && <p className="ds-wellness-note">wellness info, not medical advice</p>}
    </>
  );
  const screenDate = new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(new Date());
  const screenHeader = (
    <ScreenHeader title="Today" date={screenDate} onSettingsClick={() => onNavigate?.('me')} />
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


  if (!latest) {
    return (
      <section className="ds-demo-page aura-today-page stack-lg">
        {screenHeader}
        {metricsSection}
        <div className="card stack-md">
          <div>
            <h2>{greeting}</h2>
            <p className="muted small">
              No wellness data is recorded yet. Start with clearly labelled demo data or record a check-in.
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
              <button type="button" className="btn ghost" onClick={() => onNavigate('me')}>
                Manage permissions
              </button>
            )}
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

  const thought = thoughtFor(today());
  const line = todayLine(latest, balance?.score);

  async function listen() {
    if (speaking) {
      await stopSpeaking();
      setSpeaking(false);
      return;
    }
    setSpeaking(true);
    const h = new Date().getHours();
    const hello = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
    const name = me.name?.trim().split(' ')[0];
    try {
      await speak(
        `${hello}${name ? `, ${name}` : ''}. ${line} Your balance score is ${balance?.score ?? 'not ready yet'}. Thought for today: ${thought}`,
        me.choice.kind === 'character' ? me.choice.id : undefined,
      );
    } catch {
      setMsg('Could not play the voice on this device.');
    }
    setSpeaking(false);
  }

  async function addWater() {
    await patchDay(today(), { waterGlasses: ((days.find((d) => d.date === today())?.waterGlasses) ?? 0) + 1 });
    await onChange();
    setMsg('💧 +1 glass of water logged.');
  }

  return (
    <section className="ds-demo-page aura-today-page stack-lg">
      {screenHeader}
      {metricsSection}

      <div className="card thought-card stack-sm">
        <div className="row between center-v">
          <span className="xs muted">💭 Thought for today</span>
          <button type="button" className="btn sm ghost" onClick={() => void listen()} aria-label={speaking ? 'Stop' : 'Listen to your daily brief'}>
            {speaking ? '⏹ Stop' : '🔊 Listen'}
          </button>
        </div>
        <blockquote>{thought}</blockquote>
      </div>

      <StreakRow list={streakList} onOpen={() => onNavigate?.('report')} />

      <div className="quick-actions" role="group" aria-label="Quick actions">
        <button type="button" className="quick-action" onClick={() => void addWater()}><span>💧</span>+1 water</button>
        <button type="button" className="quick-action" onClick={() => onNavigate?.('food')}><span>🍽️</span>Log food</button>
        <button type="button" className="quick-action" onClick={() => onNavigate?.('exercise')}><span>🏃</span>Exercise</button>
        <button type="button" className="quick-action" onClick={() => onNavigate?.('health')}><span>🩺</span>How I feel</button>
      </div>
      {msg && <p className="status-banner ok" role="status">{msg}</p>}

      <button type="button" className="card row between center-v week-chart" onClick={() => onNavigate?.('report')}>
        <span className="stack-sm" style={{ gap: 2 }}>
          <strong>📊 Weekly report</strong>
          <span className="xs muted">{weekly.sentences[0] ?? 'See how this week compares with last week.'}</span>
        </span>
        <span aria-hidden="true">›</span>
      </button>

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

    </section>
  );
}
