import { useCallback, useEffect, useState } from 'react';
import type { DayRecord } from '../types';
import {
  connectHealth,
  getHealthState,
  getUsage,
  getUsageState,
  isNative,
  type HealthState,
  type UsageState,
} from '../native/bridge';
import {
  getSyncPrefs,
  loadLastSync,
  originLabel,
  setSyncPrefs,
  syncPhoneData,
  type OriginKind,
  type SyncPrefs,
  type SyncReport,
} from '../sync/phoneSync';

const dash = '–';
const fmt = (n: number | undefined, suffix = '') => (n === undefined ? dash : `${Math.round(n).toLocaleString()}${suffix}`);

function ago(ms: number): string {
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}

const HEALTH_TEXT: Record<HealthState, string> = {
  web: 'Needs the Android app',
  unavailable: 'Health Connect not installed',
  'needs-update': 'Health Connect needs an update',
  'needs-permission': 'Not connected yet',
  ready: 'Connected',
};
const USAGE_TEXT: Record<UsageState, string> = {
  web: 'Needs the Android app',
  'needs-permission': 'Not allowed yet',
  ready: 'Allowed',
};

const KIND_LABEL: Record<OriginKind, string> = { steps: 'Steps', sleep: 'Sleep', heartRate: 'Heart rate', exercise: 'Exercise' };

export function PhoneData({ days, onChange }: { days: DayRecord[]; onChange: () => Promise<void> | void }) {
  const [usage, setUsage] = useState<UsageState>('web');
  const [health, setHealth] = useState<HealthState>('web');
  const [prefs, setPrefs] = useState<SyncPrefs>({ screen: true, health: true });
  const [last, setLast] = useState<SyncReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const refreshStates = useCallback(async () => {
    setUsage(await getUsageState());
    setHealth(await getHealthState());
    setPrefs(await getSyncPrefs());
    setLast(await loadLastSync());
  }, []);

  useEffect(() => {
    void refreshStates();
    // Permissions are granted in other screens: look again when the app comes back.
    const onVis = () => document.visibilityState === 'visible' && void refreshStates();
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [refreshStates]);

  async function syncNow() {
    setBusy(true);
    setMsg('');
    try {
      const r = await syncPhoneData({ interactive: true });
      await onChange();
      const parts: string[] = [];
      if (r.screen.state === 'synced') parts.push(`screen time for ${r.screen.days} days`);
      if (r.health.state === 'synced') parts.push(`health data for ${r.health.days} days`);
      setMsg(
        parts.length
          ? `Synced ${parts.join(' and ')}.`
          : r.screen.message || r.health.message || 'Nothing was synced. Allow a source below first.',
      );
      await refreshStates();
    } finally {
      setBusy(false);
    }
  }

  async function allowUsage() {
    await getUsage(1, true); // opens Android's Usage access screen
    setMsg('Turn on "Allow usage access" for AURA, then come back to this screen.');
  }

  async function connect() {
    setBusy(true);
    try {
      const r = await connectHealth();
      setMsg(r.message);
      await refreshStates();
      if (r.ok) await syncNow();
    } finally {
      setBusy(false);
    }
  }

  async function toggle(key: keyof SyncPrefs, on: boolean) {
    const next = { ...prefs, [key]: on };
    setPrefs(next);
    await setSyncPrefs(next);
  }

  const week = days.slice(-7).reverse();
  const origins = last?.health.origins;
  const hasOrigins = origins && (Object.values(origins) as string[][]).some((a) => a.length);

  return (
    <section className="stack-lg">
      <div className="card stack-md">
        <div className="row between wrap">
          <div>
            <h2 style={{ margin: 0 }}>Phone and band data</h2>
            <p className="xs muted">
              AURA reads screen time from your phone and steps, sleep, heart rate and workouts from your fitness band
              (through Android Health Connect), saves them encrypted on this phone and uses them for your insights.
            </p>
          </div>
          <button type="button" className="btn primary" onClick={() => void syncNow()} disabled={busy || !isNative()}>
            {busy ? 'Syncing…' : 'Sync now'}
          </button>
        </div>
        {!isNative() && (
          <div className="status-banner error" role="status">
            This screen reads real phone data in the Android app. In the browser you can use demo data or import a CSV in
            My Data.
          </div>
        )}
        {msg && (
          <div className="status-banner ok" role="status">
            {msg}
          </div>
        )}
        <p className="xs muted">
          {last ? `Last sync ${ago(last.at)}. ` : 'Not synced yet. '}It also syncs by itself when you open AURA, once you
          have allowed a source. Nothing leaves your phone.
        </p>
      </div>

      <div className="grid-2">
        <article className="card stack-sm">
          <div className="row between">
            <h3 style={{ margin: 0 }}>Screen time</h3>
            <span className={`pill ${usage === 'ready' ? 'ok' : ''}`}>{USAGE_TEXT[usage]}</span>
          </div>
          <p className="small muted">
            Daily phone use and late-night use (11 pm to 4 am), from Android's usage statistics. You allow this once in
            Android settings under "Usage access".
          </p>
          {usage === 'needs-permission' && (
            <button type="button" className="btn" onClick={() => void allowUsage()}>
              Allow usage access
            </button>
          )}
          <label className="row gap center-v">
            <input type="checkbox" checked={prefs.screen} onChange={(e) => void toggle('screen', e.target.checked)} />
            <span className="small">Use screen time</span>
          </label>
        </article>

        <article className="card stack-sm">
          <div className="row between">
            <h3 style={{ margin: 0 }}>Fitness band and health apps</h3>
            <span className={`pill ${health === 'ready' ? 'ok' : ''}`}>{HEALTH_TEXT[health]}</span>
          </div>
          <p className="small muted">
            Works with any band whose app shares to Health Connect (Mi Fitness, Zepp, Google Fit, Samsung Health and
            others). In your band's app, open Settings and look for "Health Connect", then allow it to share steps, sleep,
            heart rate and exercise.
          </p>
          {health !== 'ready' && health !== 'web' && (
            <button type="button" className="btn" onClick={() => void connect()} disabled={busy}>
              {health === 'unavailable' || health === 'needs-update' ? 'Install or update Health Connect' : 'Connect Health Connect'}
            </button>
          )}
          {hasOrigins && (
            <div className="stack-sm">
              {(Object.keys(KIND_LABEL) as OriginKind[])
                .filter((k) => origins![k].length)
                .map((k) => (
                  <p key={k} className="xs">
                    <strong>{KIND_LABEL[k]}</strong> from {origins![k].map(originLabel).join(', ')}
                  </p>
                ))}
            </div>
          )}
          {health === 'ready' && !hasOrigins && (
            <p className="xs muted">Connected, but no band data found yet. Sync your band's app, then press Sync now.</p>
          )}
          <label className="row gap center-v">
            <input type="checkbox" checked={prefs.health} onChange={(e) => void toggle('health', e.target.checked)} />
            <span className="small">Use band and health data</span>
          </label>
          <p className="xs muted">
            If your band's app can't share to Health Connect, export its data as a file and import it in My Data.
          </p>
        </article>
      </div>

      <article className="card stack-sm">
        <h3 style={{ margin: 0 }}>Last 7 days</h3>
        {week.length === 0 ? (
          <p className="small muted">No records yet. Press Sync now, or check in on the Check-in tab.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="small" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr className="xs muted" style={{ textAlign: 'left' }}>
                  <th>Date</th>
                  <th>Steps</th>
                  <th>Sleep</th>
                  <th>Screen</th>
                  <th>Late screen</th>
                  <th>Heart</th>
                  <th>Exercise</th>
                </tr>
              </thead>
              <tbody>
                {week.map((d) => (
                  <tr key={d.date}>
                    <td>
                      {d.date.slice(5)} {d.source === 'demo' && <span className="pill demo">DEMO</span>}
                    </td>
                    <td>{fmt(d.steps)}</td>
                    <td>{d.sleepHours === undefined ? dash : `${d.sleepHours} h`}</td>
                    <td>{d.screenMinutes === undefined ? dash : `${Math.round(d.screenMinutes / 60 * 10) / 10} h`}</td>
                    <td>{fmt(d.lateScreenMin, ' min')}</td>
                    <td>{fmt(d.avgHeartRate, ' bpm')}</td>
                    <td>{fmt(d.exerciseMinutes, ' min')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="xs muted">
          Your own check-in entries are never overwritten by synced data. Switching a source off stops future syncs; use My
          Data to delete stored records.
        </p>
      </article>
    </section>
  );
}
