import { useMemo, useState } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { DayRecord } from '../types';
import { runInsights } from '../insights/engine';
import { balanceScore } from '../insights/balance';
import { Ring } from '../components/Ring';
import { InsightCard } from '../components/InsightCard';
import { generateDemoData } from '../lib/demoData';
import { today } from '../lib/dates';
import { patchDay, saveDay } from '../lib/store';
import { setConsent } from '../lib/vault';
import { getUsage, notify } from '../native/bridge';

export function Dashboard({ days, onChange }: { days: DayRecord[]; onChange: () => Promise<void> }) {
  const [msg, setMsg] = useState('');
  const latest = days[days.length - 1];
  const insights = useMemo(() => runInsights(days), [days]);
  const balance = useMemo(() => (latest ? balanceScore(latest, days.slice(0, -1)) : null), [latest, days]);
  const chart = useMemo(
    () => days.slice(-30).map((d) => ({ date: d.date.slice(5), Sleep: d.sleepHours, 'Late screen (hrs)': d.lateScreenMin !== undefined ? Math.round((d.lateScreenMin / 60) * 100) / 100 : undefined })),
    [days],
  );

  async function loadDemo() {
    await setConsent('demo', true);
    for (const d of generateDemoData(today())) await saveDay(d);
    await onChange();
    setMsg('Loaded 30 days of DEMO data (clearly labelled as sample data).');
  }

  async function readPhone() {
    const r = await getUsage(7);
    if (!r.ok) return setMsg(r.message);
    await setConsent('device', true);
    for (const u of r.days) await patchDay(u.date, { screenMinutes: u.screenMinutes, lateScreenMin: u.lateScreenMin, source: 'device' }, 'device');
    await onChange();
    setMsg(`Read ${r.days.length} days of screen time from this phone.`);
  }

  async function testNudge() {
    const r = await notify('AURA', 'Late screens cost you sleep. Try putting the phone down by 11 pm.', 5);
    setMsg(r.message);
  }

  if (!latest) {
    return (
      <section className="card">
        <h2>Welcome to AURA</h2>
        <p>No data yet. To try AURA, load clearly-labelled demo data, or read real screen time on Android, or add a check-in.</p>
        <div className="row gap wrap">
          <button className="primary" onClick={loadDemo}>Load demo data</button>
          <button onClick={readPhone}>Read my screen time (Android)</button>
        </div>
        {msg && <p className="muted">{msg}</p>}
      </section>
    );
  }

  return (
    <section>
      <div className="card row gap center-v wrap">
        {balance && <Ring value={balance.score} />}
        <div className="grow">
          <h2>Balance Score · {latest.date}</h2>
          <ul className="reasons">
            {balance?.reasons.map((r) => (
              <li key={r.label}>
                <strong>{r.label}</strong> {r.points}/{r.max} <span className="muted">· {r.note}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <h3>What AURA noticed</h3>
      {insights.map((i) => (
        <InsightCard key={i.id} insight={i} />
      ))}

      <h3>Sleep and late-night screen time (last 30 days)</h3>
      <div className="card chart">
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={chart} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e6dcc6" />
            <XAxis dataKey="date" fontSize={11} />
            <YAxis fontSize={11} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="Sleep" stroke="#1a1a6e" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="Late screen (hrs)" stroke="#e8832a" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="row gap wrap">
        <button onClick={readPhone}>Read my screen time (Android)</button>
        <button onClick={testNudge}>Send a test nudge</button>
        <button onClick={loadDemo}>Reload demo data</button>
      </div>
      {msg && <p className="muted">{msg}</p>}
    </section>
  );
}
