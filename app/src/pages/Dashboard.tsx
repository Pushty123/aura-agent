import { useEffect, useMemo, useState } from 'react';
import { BarChart3, Check, ChevronRight, Droplet, Dumbbell, HeartPulse, LayoutGrid, SmilePlus, Smartphone, Target, UserRound, Utensils, X } from 'lucide-react';
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
import { pinWidget, widgetStatus } from '../native/bridge';
import { db } from '../lib/db';
import { syncWidget } from '../widget/widget';
import { loadLimits, phoneLimit } from '../apps/appUsage';
import { generateDemoData } from '../lib/demoData';
import { today } from '../lib/dates';
import { patchDay, saveDay } from '../lib/store';
import { setConsent } from '../lib/vault';
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
  const [offerWidget, setOfferWidget] = useState(false);
  const [phoneMax, setPhoneMax] = useState<number | undefined>();
  useEffect(() => {
    void (async () => {
      setPhoneMax(phoneLimit(await loadLimits()));
      const st = await widgetStatus();
      const hidden = (await db.meta.get('widget-offer'))?.value === 'hide';
      setOfferWidget(!!st && st.placed === 0 && !hidden);
    })();
  }, []);

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

  if (!latest) {
    const steps = [
      { done: !!me.name, icon: UserRound, title: 'Set up your profile', sub: 'Name, height, weight and your character', tab: 'profile' as const },
      { done: false, icon: Smartphone, title: 'Connect your phone', sub: 'Steps, sleep and screen time, filled in automatically', tab: 'phone' as const },
      { done: false, icon: SmilePlus, title: 'Do your first check-in', sub: 'Mood, water and sleep in under a minute', tab: 'checkin' as const },
      { done: false, icon: Target, title: 'Add a goal', sub: 'Water, study, steps, or anything of your own', tab: 'goals' as const },
    ];
    return (
      <section className="stack-lg">
        <div>
          <h2 style={{ margin: 0 }}>{greeting}</h2>
          <p className="small muted" style={{ margin: '4px 0 0' }}>Let&apos;s get AURA ready for you. It takes about two minutes.</p>
        </div>
        <div className="card setup-list">
          {steps.map((st, k) => (
            <button key={st.title} type="button" className="setup-item" onClick={() => onNavigate?.(st.tab)}>
              <span className={`setup-num ${st.done ? 'done' : ''}`} aria-hidden="true">
                {st.done ? <Check size={16} /> : k + 1}
              </span>
              <span className="setup-icon" aria-hidden="true"><st.icon size={20} /></span>
              <span className="setup-text">
                <strong>{st.title}</strong>
                <span className="xs muted">{st.sub}</span>
              </span>
              <ChevronRight size={18} className="muted" aria-hidden="true" />
            </button>
          ))}
        </div>
        <div className="row between center-v wrap gap">
          <span className="small muted">Just looking around?</span>
          <button type="button" className="btn" onClick={loadDemo} disabled={busy}>
            Explore with sample data
          </button>
        </div>
        {msg && <p className="status-banner">{msg}</p>}
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
    setMsg('+1 glass of water logged.');
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
        thought={thought}
        onListen={() => void listen()}
        listening={speaking}
        screenLimit={phoneMax}
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

      {offerWidget && (
        <div className="card row between center-v gap wrap">
          <span className="row gap center-v small"><LayoutGrid size={18} aria-hidden="true" /> Put AURA on your home screen to see your score without opening the app.</span>
          <span className="row gap">
            <button
              type="button"
              className="btn sm primary"
              onClick={async () => {
                await syncWidget(days);
                const ok = await pinWidget();
                setMsg(ok ? 'Tap "Add" in the box that opens.' : 'Long-press your home screen → Widgets → find AURA.');
              }}
            >
              Add widget
            </button>
            <button
              type="button"
              className="btn sm ghost"
              aria-label="Hide this"
              onClick={() => {
                setOfferWidget(false);
                void db.meta.put({ key: 'widget-offer', value: 'hide' });
              }}
            >
              <X size={16} />
            </button>
          </span>
        </div>
      )}


      <StreakRow list={streakList} onOpen={() => onNavigate?.('report')} />

      <div className="quick-actions" role="group" aria-label="Quick actions">
        <button type="button" className="quick-action" onClick={() => void addWater()}><span><Droplet size={20} /></span>+1 water</button>
        <button type="button" className="quick-action" onClick={() => onNavigate?.('food')}><span><Utensils size={20} /></span>Log food</button>
        <button type="button" className="quick-action" onClick={() => onNavigate?.('exercise')}><span><Dumbbell size={20} /></span>Exercise</button>
        <button type="button" className="quick-action" onClick={() => onNavigate?.('health')}><span><HeartPulse size={20} /></span>How I feel</button>
      </div>
      {msg && <p className="status-banner ok" role="status">{msg}</p>}

      <button type="button" className="card row between center-v week-chart" onClick={() => onNavigate?.('report')}>
        <span className="stack-sm" style={{ gap: 2 }}>
          <strong className="row gap-sm center-v"><BarChart3 size={18} aria-hidden="true" /> Weekly report</strong>
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
