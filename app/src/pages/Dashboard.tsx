import { useMemo, useState } from 'react';
import type { DayRecord } from '../types';
import { runInsights } from '../insights/engine';
import { balanceScore } from '../insights/balance';
import { weeklySummary } from '../summary/weekly';
import { AuraAvatar } from '../avatar/AuraAvatar';
import { CharacterModal } from '../avatar/CharacterModal';
import { useMe } from '../avatar/AvatarContext';
import { avatarMood } from '../avatar/mood';
import { InsightCard } from '../components/InsightCard';
import { StillLearningCard } from '../components/StillLearningCard';
import { AuraWidget } from '../components/AuraWidget';
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
  const [showCharacter, setShowCharacter] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const streakList = useMemo(() => streaks(days, today()), [days]);

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

  const weekScores = days.slice(-7).map((d, i, arr) => balanceScore(d, days.slice(0, days.length - arr.length + i)).score);

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
    <section className="stack-lg">
      <AuraWidget
        name={me.name}
        sleepHours={latest.sleepHours}
        steps={latest.steps}
        screenMinutes={latest.screenMinutes}
        mood={latest.mood}
        balanceScore={balance?.score}
        weekScores={weekScores}
        isDemo={latest.source === 'demo'}
        moodLabel={mood.label}
        subline={line}
        ringContent={balance ? <AuraAvatar choice={me.choice} photo={me.photo} name={me.name} size={88} /> : undefined}
        onRingClick={() => (me.choice.kind === 'character' ? setShowCharacter(true) : onNavigate?.('report'))}
        onOpen={(s) => onNavigate?.(s === 'sleep' || s === 'mood' ? 'checkin' : s === 'steps' ? 'phone' : s === 'screen' ? 'apps' : 'report')}
      />
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
