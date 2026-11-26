import { useCallback, useEffect, useState } from 'react';
import { getAppUsage, getUsage, isNative, notify, pushAppLimits, type AppLimit, type AppUse } from '../native/bridge';
import { ALL_APPS, demoApps, fmtMin, limitState, loadLimits, phoneLimit, saveLimits, setLimit } from '../apps/appUsage';
import { AppIcon } from '../components/AppIcon';

const COLORS = { none: 'var(--aura-blue)', ok: 'var(--aura-primary)', near: '#E8A33D', over: '#E2626B' } as const;
const PRESETS = [15, 30, 45, 60, 90, 120];

/** Per-app screen time, opens and unlocks for today, with daily app limits. */
export function AppUsage() {
  const [apps, setApps] = useState<AppUse[]>([]);
  const [unlocks, setUnlocks] = useState(0);
  const [demo, setDemo] = useState(false);
  const [limits, setLimits] = useState<AppLimit[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [needsPermission, setNeedsPermission] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      setLimits(await loadLimits());
      const r = await getAppUsage();
      if (r.ok) {
        setApps(r.apps);
        setUnlocks(r.unlocks);
        setDemo(false);
        setNeedsPermission(false);
      } else if (r.reason === 'web') {
        const d = demoApps();
        setApps(d.apps);
        setUnlocks(d.unlocks);
        setDemo(true);
      } else {
        setNeedsPermission(r.reason === 'permission');
        setMsg({ ok: false, text: r.message });
      }
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onVis = () => document.visibilityState === 'visible' && void refresh();
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [refresh]);

  async function changeLimit(app: AppUse, minutes: number | null) {
    const next = setLimit(limits, app, minutes);
    try {
      await saveLimits(next);
      setLimits(next);
      setEditing(null);
      const pushed = await pushAppLimits(next);
      if (minutes !== null && isNative()) await notify('AURA app limits', `We'll remind you when ${app.label} reaches ${fmtMin(minutes)} today.`, 1);
      setMsg({
        ok: true,
        text:
          minutes === null
            ? `Limit removed for ${app.label}.`
            : pushed
              ? `Limit set: ${app.label}, ${fmtMin(minutes)} a day. You'll get a reminder at 80% and at the limit.`
              : `Limit saved. Reminders pop up in the Android app.`,
      });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Could not save the limit.' });
    }
  }

  const total = apps.reduce((s, a) => s + a.minutes, 0);
  const totalOpens = apps.reduce((s, a) => s + a.opens, 0);
  const top = Math.max(1, ...apps.map((a) => a.minutes));
  const limitFor = (pkg: string) => limits.find((l) => l.pkg === pkg)?.minutes;

  return (
    <section className="stack-lg">
      {demo && (
        <div className="status-banner" role="status" style={{ borderColor: '#E8A33D' }}>
          <span className="pill demo">DEMO</span> Sample apps shown in the browser. The Android app shows your real apps.
        </div>
      )}
      {needsPermission && (
        <div className="card stack-sm">
          <strong>Allow usage access</strong>
          <p className="small muted">AURA needs Android's "Usage access" to see which apps you use. It stays on this phone.</p>
          <button type="button" className="btn primary" onClick={() => void getUsage(1, true)}>
            Open Usage access settings
          </button>
        </div>
      )}
      {msg && <div className={`status-banner ${msg.ok ? 'ok' : 'error'}`}>{msg.text}</div>}

      <div className="card stack-sm">
        <div className="row between center-v wrap gap">
          <div>
            <h3 style={{ margin: 0 }}>📱 Daily phone limit</h3>
            <p className="xs muted" style={{ margin: 0 }}>All apps together. AURA reminds you at 80% and when you reach it.</p>
          </div>
          {phoneLimit(limits) !== undefined && (
            <span className={`pill ${limitState(total, phoneLimit(limits)) === 'over' ? '' : 'ok'}`} style={limitState(total, phoneLimit(limits)) === 'over' ? { background: '#E2626B33' } : undefined}>
              {limitState(total, phoneLimit(limits)) === 'over' ? 'Over limit' : limitState(total, phoneLimit(limits)) === 'near' ? 'Almost there' : 'On track'}
            </span>
          )}
        </div>
        {phoneLimit(limits) !== undefined && (
          <>
            <div className="row between small">
              <span><strong>{fmtMin(total)}</strong> used today</span>
              <span className="muted">limit {fmtMin(phoneLimit(limits)!)}</span>
            </div>
            <div className={`limit-bar ${limitState(total, phoneLimit(limits))}`} aria-hidden="true">
              <span style={{ width: `${Math.min(100, Math.round((total / phoneLimit(limits)!) * 100))}%` }} />
            </div>
          </>
        )}
        <div className="row gap wrap">
          {[120, 180, 240, 300, 360].map((m) => (
            <button
              key={m}
              type="button"
              className={`btn sm ${phoneLimit(limits) === m ? 'primary' : ''}`}
              onClick={() => void changeLimit({ pkg: ALL_APPS, label: 'Your phone (all apps)', minutes: total, opens: 0 } as AppUse, m)}
            >
              {m / 60} h
            </button>
          ))}
          {phoneLimit(limits) !== undefined && (
            <button type="button" className="btn sm ghost" onClick={() => void changeLimit({ pkg: ALL_APPS, label: 'Your phone (all apps)', minutes: total, opens: 0 } as AppUse, null)}>
              Remove
            </button>
          )}
        </div>
      </div>

      <div className="grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        {[
          ['Screen time', fmtMin(total)],
          ['App opens', totalOpens.toLocaleString()],
          ['Unlocks', unlocks.toLocaleString()],
        ].map(([k, v]) => (
          <article key={k} className="card stack-sm" style={{ textAlign: 'center', padding: 12 }}>
            <span className="xs muted">{k}</span>
            <strong style={{ fontSize: '1.3rem' }}>{v}</strong>
          </article>
        ))}
      </div>

      <div className="card stack-md">
        <div className="row between wrap">
          <div>
            <h2 style={{ margin: 0 }}>Today by app</h2>
            <p className="xs muted">Time on screen and how many times you opened each app since midnight.</p>
          </div>
          <button type="button" className="btn sm" onClick={() => void refresh()} disabled={busy}>
            {busy ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        {apps.length === 0 && !busy && <p className="small muted">No app use recorded yet today.</p>}

        {apps.map((a) => {
          const limit = limitFor(a.pkg);
          const st = limitState(a.minutes, limit);
          return (
            <div key={a.pkg} className="stack-sm" style={{ paddingBottom: 6, borderBottom: '1px solid var(--aura-border)' }}>
              <div className="row between center-v gap">
                <div className="row center-v gap" style={{ minWidth: 0 }}>
                  <AppIcon pkg={a.pkg} label={a.label} icon={a.icon} size={34} />
                  <div style={{ minWidth: 0 }}>
                    <strong className="small">{a.label}</strong>
                    <div className="xs muted">
                      {fmtMin(a.minutes)} · opened {a.opens}×{limit ? ` · limit ${fmtMin(limit)}` : ''}
                    </div>
                  </div>
                </div>
                <button type="button" className={`btn sm ${limit ? '' : 'ghost'}`} onClick={() => setEditing(editing === a.pkg ? null : a.pkg)}>
                  {limit ? (st === 'over' ? '⛔ Limit' : '⏳ Limit') : 'Set limit'}
                </button>
              </div>
              <div className="bar" aria-hidden="true">
                <div
                  style={{
                    width: `${Math.round(((limit ? Math.min(a.minutes, limit) / limit : a.minutes / top) * 100))}%`,
                    background: COLORS[st],
                  }}
                />
              </div>
              {editing === a.pkg && (
                <div className="row gap wrap">
                  {PRESETS.map((m) => (
                    <button key={m} type="button" className={`btn sm ${limit === m ? 'primary' : ''}`} onClick={() => void changeLimit(a, m)}>
                      {fmtMin(m)}
                    </button>
                  ))}
                  {limit && (
                    <button type="button" className="btn sm ghost" onClick={() => void changeLimit(a, null)}>
                      Remove limit
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {limits.length > 0 && (
        <div className="card stack-sm">
          <h3 style={{ margin: 0 }}>My app limits</h3>
          {limits.map((l) => {
            const used = l.pkg === ALL_APPS ? total : apps.find((a) => a.pkg === l.pkg)?.minutes ?? 0;
            const st = limitState(used, l.minutes);
            return (
              <div key={l.pkg} className="row between center-v">
                <span className="small">
                  <strong>{l.label}</strong> · {fmtMin(used)} of {fmtMin(l.minutes)}
                </span>
                <span className={`pill ${st === 'ok' ? 'ok' : ''}`} style={st === 'over' ? { background: '#E2626B33' } : undefined}>
                  {st === 'over' ? 'Over limit' : st === 'near' ? 'Almost there' : 'On track'}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <p className="xs muted">
        App names and times are read by Android on this phone and never leave it. AURA checks your limits about every 15
        minutes in the background and reminds you at 80% and at 100%. It does not block apps.
      </p>
    </section>
  );
}
