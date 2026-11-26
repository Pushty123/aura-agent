import { useEffect, useState } from 'react';
import type { DayRecord } from '../types';
import type { AppTab } from './AppShell';
import { getAppUsage, type AppUse } from '../native/bridge';
import { demoApps, fmtMin, limitState, loadLimits, phoneLimit } from '../apps/appUsage';
import type { AppLimit } from '../native/bridge';
import { AppIcon } from './AppIcon';

const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function Bars({ values, labels, goal, color, fmt }: { values: (number | undefined)[]; labels: string[]; goal?: number; color: string; fmt: (v: number) => string }) {
  const W = 300;
  const H = 120;
  const max = Math.max(goal ?? 0, ...values.map((v) => v ?? 0), 1) * 1.15;
  const bw = W / values.length;
  const y = (v: number) => H - (v / max) * H;
  return (
    <svg viewBox={`0 0 ${W} ${H + 34}`} width="100%" role="img" aria-label={values.map((v, i) => `${labels[i]} ${v === undefined ? 'no data' : fmt(v)}`).join(', ')}>
      {goal !== undefined && (
        <>
          <line x1={0} x2={W} y1={y(goal)} y2={y(goal)} stroke="currentColor" strokeOpacity={0.35} strokeDasharray="4 4" />
        </>
      )}
      {values.map((v, i) => {
        const last = i === values.length - 1;
        return (
          <g key={i}>
            {v !== undefined ? (
              <>
                <rect x={i * bw + bw * 0.18} y={y(v)} width={bw * 0.64} height={Math.max(2, H - y(v))} rx={5} fill={color} opacity={last ? 1 : 0.55} />
                <text x={i * bw + bw / 2} y={Math.max(10, y(v) - 4)} textAnchor="middle" fontSize={10} fill="currentColor" opacity={last ? 1 : 0.7}>{fmt(v)}</text>
              </>
            ) : (
              <rect x={i * bw + bw * 0.18} y={H - 2} width={bw * 0.64} height={2} rx={1} fill="currentColor" opacity={0.2} />
            )}
            <text x={i * bw + bw / 2} y={H + 16} textAnchor="middle" fontSize={11} fill="currentColor" opacity={last ? 1 : 0.6} fontWeight={last ? 700 : 400}>{labels[i]}</text>
          </g>
        );
      })}
    </svg>
  );
}

/** Home-screen visuals: this week's steps and screen time, and today's top apps. */
export function WeekCharts({ days, hasDemo, onNavigate }: { days: DayRecord[]; hasDemo: boolean; onNavigate?: (t: AppTab) => void }) {
  const [apps, setApps] = useState<AppUse[] | null>(null);
  const [appsDemo, setAppsDemo] = useState(false);
  const [limits, setLimits] = useState<AppLimit[]>([]);

  useEffect(() => {
    void loadLimits().then(setLimits);
    void getAppUsage().then((r) => {
      if (r.ok) setApps(r.apps.slice(0, 4));
      else if (r.reason === 'web' && hasDemo) {
        setApps(demoApps().apps.slice(0, 4));
        setAppsDemo(true);
      } else setApps([]);
    });
  }, [hasDemo]);

  const week = days.slice(-7);
  const labels = week.map((d, i) => (i === week.length - 1 ? 'Today' : DAY[new Date(`${d.date}T12:00:00`).getDay()]));
  const steps = week.map((d) => d.steps);
  const screen = week.map((d) => (d.screenMinutes !== undefined ? d.screenMinutes / 60 : undefined));
  const avg = (v: (number | undefined)[]) => {
    const x = v.filter((n): n is number => n !== undefined);
    return x.length ? x.reduce((a, b) => a + b, 0) / x.length : null;
  };
  const sAvg = avg(steps);
  const tAvg = avg(screen);
  const maxApp = Math.max(1, ...(apps ?? []).map((a) => a.minutes));
  const phoneMax = phoneLimit(limits);
  const limitOf = (pkg: string) => limits.find((l) => l.pkg === pkg)?.minutes;

  if (!week.length) return null;
  return (
    <div className="grid-3">
      <button type="button" className="card stack-sm week-chart" onClick={() => onNavigate?.('goals')}>
        <div className="row between center-v">
          <strong>🚶 Steps this week</strong>
          {sAvg !== null && <span className="xs muted">avg {Math.round(sAvg).toLocaleString()} · goal 8k (dashed)</span>}
        </div>
        <Bars values={steps} labels={labels} goal={8000} color="#60a5fa" fmt={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(Math.round(v)))} />
      </button>
      <button type="button" className="card stack-sm week-chart" onClick={() => onNavigate?.('apps')}>
        <div className="row between center-v">
          <strong>📱 Screen time</strong>
          {tAvg !== null && <span className="xs muted">avg {tAvg.toFixed(1)} h{phoneMax ? ` · limit ${fmtMin(phoneMax)} (dashed)` : ''}</span>}
        </div>
        <Bars values={screen} labels={labels} goal={phoneMax ? phoneMax / 60 : undefined} color="#fb7185" fmt={(v) => `${v.toFixed(1)}`} />
        {!phoneMax && <span className="xs muted">Tap to set a daily phone limit.</span>}
      </button>
      <button type="button" className="card stack-sm week-chart" onClick={() => onNavigate?.('apps')}>
        <div className="row between center-v">
          <strong>⏳ Top apps today</strong>
          {appsDemo && <span className="pill demo">DEMO</span>}
        </div>
        {apps && apps.length > 0 ? (
          <div className="stack-sm">
            {apps.map((a) => (
              <div key={a.pkg} className="row gap center-v">
                <AppIcon pkg={a.pkg} label={a.label} icon={a.icon} size={26} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="row between xs">
                    <span>{a.label}</span>
                    <span className={limitOf(a.pkg) && limitState(a.minutes, limitOf(a.pkg)) === 'over' ? 'limit-over' : 'muted'}>
                      {fmtMin(a.minutes)}{limitOf(a.pkg) ? ` / ${fmtMin(limitOf(a.pkg)!)}` : ''}
                    </span>
                  </div>
                  {limitOf(a.pkg) ? (
                    <div className={`limit-bar ${limitState(a.minutes, limitOf(a.pkg))}`}><span style={{ width: `${Math.min(100, (a.minutes / limitOf(a.pkg)!) * 100)}%` }} /></div>
                  ) : (
                    <div className="app-bar"><span style={{ width: `${(a.minutes / maxApp) * 100}%` }} /></div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="xs muted">Allow usage access in the Usage tab to see which apps take your time.</p>
        )}
      </button>
    </div>
  );
}
