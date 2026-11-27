import { useEffect, useMemo, useState } from 'react';
import { CloudRain, Download, Dumbbell, Droplet, Footprints, HeartPulse, MoonStar, Moon, Share2, Smartphone, Smile, Target, Trophy } from 'lucide-react';
import type { CompareRow } from '../summary/compare';

const COMPARE_ICON = { sleepHours: Moon, steps: Footprints, screenMinutes: Smartphone, lateScreenMin: MoonStar, mood: Smile, waterGlasses: Droplet, exerciseMinutes: Dumbbell };
function CompareIcon({ k }: { k: CompareRow['key'] }) {
  const I = COMPARE_ICON[k];
  return <I size={14} aria-hidden="true" />;
}
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
import { balanceScore } from '../insights/balance';
import { weeklySummary } from '../summary/weekly';
import { bestAndWorst, compareWeeks, reportText } from '../summary/compare';
import { buildPrivacySafeSummary, downloadSummaryCard } from '../summary/shareCard';
import { AuraAvatar } from '../avatar/AuraAvatar';
import { CharacterModal } from '../avatar/CharacterModal';
import { useMe } from '../avatar/AvatarContext';
import { avatarMood } from '../avatar/mood';
import { WeekCharts } from '../components/WeekCharts';
import { BadgeWall } from '../components/Streaks';
import { BalanceSimulator } from '../components/BalanceSimulator';
import { streaks } from '../goals/badges';
import { today } from '../lib/dates';
import { loadFood } from '../lib/store';
import { loadWorkouts } from '../exercise/workouts';
import { buildDayValues, loadGoals, weekProgress, type Goal } from '../goals/goals';
import { loadHealth, recentCounts } from '../health/symptoms';
import type { AppTab } from '../components/AppShell';
import { hasPermission } from '../lib/permissions';

const fmtDay = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' });

/** Weekly report: this week against last week, score breakdown, charts, goals and health log. */
export function Report({ days, onNavigate }: { days: DayRecord[]; onNavigate?: (tab: AppTab) => void }) {
  const date = today();
  const [range, setRange] = useState<7 | 14 | 30>(14);
  const [showScoreDetails, setShowScoreDetails] = useState(false);
  const [showWeeklyMore, setShowWeeklyMore] = useState(false);
  const [showCharacter, setShowCharacter] = useState(false);
  const [goals, setGoals] = useState<{ g: Goal; met: number; of: number }[]>([]);
  const [health, setHealth] = useState<{ label: string; n: number }[]>([]);
  const [shareMsg, setShareMsg] = useState<string | null>(null);
  const [familySharing, setFamilySharing] = useState(false);
  const me = useMe();

  const latest = days[days.length - 1];
  const balance = useMemo(() => (latest ? balanceScore(latest, days.slice(0, -1)) : null), [latest, days]);
  const mood = avatarMood(latest, balance?.score);
  const weekly = useMemo(() => weeklySummary(days), [days]);
  const rows = useMemo(() => compareWeeks(days, latest?.date ?? date), [days, latest, date]);
  const bw = useMemo(() => bestAndWorst(days, latest?.date ?? date), [days, latest, date]);
  const isDemo = latest?.source === 'demo';

  useEffect(() => {
    void (async () => {
      const values = buildDayValues(days, await loadFood(), await loadWorkouts());
      const gs = (await loadGoals()).filter((g) => !g.endsOn || g.endsOn >= date);
      setGoals(gs.map((g) => ({ g, ...weekProgress(g, values, date) })));
      setHealth(recentCounts(await loadHealth(), date, 7));
      setFamilySharing(await hasPermission('familySharing'));
    })();
  }, [days, date]);

  const chart = useMemo(
    () =>
      days.slice(-range).map((d) => ({
        date: d.date.slice(5),
        Sleep: d.sleepHours,
        'Late screen (hrs)': d.lateScreenMin !== undefined ? Math.round((d.lateScreenMin / 60) * 100) / 100 : undefined,
      })),
    [days, range],
  );

  async function share() {
    if (!(await hasPermission('familySharing'))) {
      setFamilySharing(false);
      setShareMsg('Enable Family sharing in Settings → Permissions before sharing a report.');
      return;
    }
    const extra = [
      ...(balance ? [`Balance Score today: ${balance.score}/100`] : []),
      ...goals.map(({ g, met, of }) => `${g.icon ?? '🎯'} ${g.title}: ${met}/${of} days`),
      ...(isDemo ? ['(sample DEMO data)'] : []),
      'Made with AURA. Only this summary is shared; your data stays on my phone.',
    ];
    const text = reportText(rows, latest?.date ?? date, extra);
    try {
      if (navigator.share) {
        await navigator.share({ title: 'My AURA weekly report', text });
        setShareMsg(null);
      } else {
        await navigator.clipboard.writeText(text);
        setShareMsg('Report copied. Paste it in WhatsApp or anywhere.');
      }
    } catch {
      /* person closed the share sheet */
    }
  }

  async function downloadCard() {
    const topStreak = streaks(days, latest?.date ?? date)
      .filter((s) => s.current > 0)
      .sort((a, b) => b.current - a.current)[0];
    const winRow = rows.find((r) => r.better === true && r.change !== null);
    const topWin = winRow
      ? `${winRow.label} (${winRow.change! > 0 ? '+' : ''}${winRow.change}% vs last week)`
      : bw.best
        ? `Best day: ${bw.best.date}`
        : 'Consistent wellness tracking';
    const last7 = days.slice(-7);
    const weekScores = last7.map((d, i, arr) =>
      balanceScore(d, days.slice(0, days.length - arr.length + i)).score,
    );
    const meanOf = (vals: (number | undefined)[]) => {
      const nums = vals.filter((v): v is number => typeof v === 'number');
      return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
    };
    const avgScreenMin = meanOf(last7.map((d) => d.screenMinutes));
    const goalsMet = goals.filter(({ met, of }) => met >= of && of > 0).length;
    await downloadSummaryCard(
      buildPrivacySafeSummary({
        score: balance?.score ?? null,
        statusLabel: mood.label,
        weekScores,
        avgSleepHours: meanOf(last7.map((d) => d.sleepHours)),
        avgSteps: meanOf(last7.map((d) => d.steps)),
        avgScreenHours: avgScreenMin !== null ? avgScreenMin / 60 : null,
        avgMood: meanOf(last7.map((d) => d.mood)),
        goalsMet,
        goalsTotal: goals.length,
        streakLabel: topStreak?.def.label,
        streakDays: topStreak?.current,
        topWin,
        date: latest?.date ?? date,
        isDemo,
      }),
    );
    setShareMsg('Downloaded privacy-safe summary card (PNG).');
  }

  if (!latest)
    return (
      <section className="card stack-sm">
        <h2>Weekly report</h2>
        <p className="small muted">Your report appears after a few days of data. Check in or allow phone data to start.</p>
        <button type="button" className="btn primary" onClick={() => onNavigate?.('checkin')}>Go to Check-in</button>
      </section>
    );

  return (
    <section className="stack-lg">
      <div className="card row between wrap center-v">
        <div>
          <h2 style={{ margin: 0 }}>Your week</h2>
          <p className="xs muted">7 days ending {fmtDay(latest.date)}, compared with the 7 days before{isDemo ? ' · DEMO data' : ''}</p>
        </div>
        <div className="row gap-sm wrap">
          <button type="button" className="btn" onClick={() => void downloadCard()}>
            <Download size={16} /> Download summary card
          </button>
          <button type="button" className="btn primary" onClick={() => void share()}>
            <Share2 size={16} /> Share report
          </button>
        </div>
        {!familySharing && <p className="xs muted">Turn on Family sharing in Settings → Permissions to share your report.</p>}
      </div>
      {shareMsg && <div className="status-banner ok" role="status">{shareMsg}</div>}

      {rows.length > 0 && (
        <div className="compare-grid">
          {rows.map((r) => (
            <div key={r.key} className="card compare-cell">
              <span className="xs muted row gap-sm center-v"><CompareIcon k={r.key} /> {r.label}</span>
              <strong className="compare-value">{r.fmt(r.now!)}</strong>
              {r.change !== null ? (
                <span className={`xs compare-change ${r.better === true ? 'good' : r.better === false ? 'bad' : ''}`}>
                  {r.change > 0 ? '▲' : r.change < 0 ? '▼' : '•'} {Math.abs(r.change)}% vs last week
                </span>
              ) : (
                <span className="xs muted">No data last week</span>
              )}
            </div>
          ))}
        </div>
      )}

      <BadgeWall list={streaks(days, latest.date)} />

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

      {(bw.best || bw.worst) && (
        <div className="grid-2">
          {bw.best && (
            <div className="card stack-sm">
              <span className="xs muted row gap-sm center-v"><Trophy size={14} /> Best day</span>
              <strong>{fmtDay(bw.best.date)}</strong>
              <span className="small muted">
                {[bw.best.sleepHours !== undefined && `${bw.best.sleepHours.toFixed(1)} h sleep`, bw.best.steps !== undefined && `${bw.best.steps.toLocaleString()} steps`, bw.best.screenMinutes !== undefined && `${(bw.best.screenMinutes / 60).toFixed(1)} h screen`].filter(Boolean).join(' · ')}
              </span>
            </div>
          )}
          {bw.worst && (
            <div className="card stack-sm">
              <span className="xs muted row gap-sm center-v"><CloudRain size={14} /> Hardest day</span>
              <strong>{fmtDay(bw.worst.date)}</strong>
              <span className="small muted">
                {[bw.worst.sleepHours !== undefined && `${bw.worst.sleepHours.toFixed(1)} h sleep`, bw.worst.steps !== undefined && `${bw.worst.steps.toLocaleString()} steps`, bw.worst.screenMinutes !== undefined && `${(bw.worst.screenMinutes / 60).toFixed(1)} h screen`].filter(Boolean).join(' · ')}
              </span>
            </div>
          )}
        </div>
      )}

      <WeekCharts days={days} hasDemo={isDemo} onNavigate={onNavigate} />

      <div className="grid-2">
        <button type="button" className="card stack-sm week-chart" onClick={() => onNavigate?.('goals')}>
          <strong className="row gap-sm center-v"><Target size={18} /> Goals this week</strong>
          {goals.length ? (
            goals.slice(0, 6).map(({ g, met, of }) => (
              <div key={g.id} className="stack-sm" style={{ gap: 2 }}>
                <div className="row between small"><span>{g.icon ?? '🎯'} {g.title}</span><span className="muted">{met}/{of} days</span></div>
                <div className="bar" aria-hidden="true"><div style={{ width: `${Math.min(100, (met / Math.max(1, of)) * 100)}%` }} /></div>
              </div>
            ))
          ) : (
            <p className="xs muted">No goals yet. Tap to add one.</p>
          )}
        </button>
        <button type="button" className="card stack-sm week-chart" onClick={() => onNavigate?.('health')}>
          <strong className="row gap-sm center-v"><HeartPulse size={18} /> Health log this week</strong>
          {health.length ? (
            <p className="small">{health.map((h) => `${h.label} ×${h.n}`).join(' · ')}</p>
          ) : (
            <p className="xs muted">Nothing logged this week.</p>
          )}
        </button>
      </div>

      <BalanceSimulator latest={latest} history={days.slice(0, -1)} />

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

    </section>
  );
}
