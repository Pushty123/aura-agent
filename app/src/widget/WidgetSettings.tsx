import { useEffect, useState } from 'react';
import { loadDays } from '../lib/store';
import { isNative, pinWidget, widgetStatus } from '../native/bridge';
import type { DayRecord } from '../types';
import { buildSnapshot, getWidgetPrefs, setWidgetPrefs, syncWidget, turnWidgetOff, type WidgetPrefs } from './widget';
import { WidgetPreview } from './WidgetPreview';

export function WidgetSettings() {
  const [prefs, setPrefs] = useState<WidgetPrefs>({ enabled: false, showNumbers: true });
  const [days, setDays] = useState<DayRecord[]>([]);
  const [msg, setMsg] = useState('');
  const [status, setStatus] = useState<{ supported: boolean; placed: number } | null>(null);

  useEffect(() => {
    void (async () => {
      setPrefs(await getWidgetPrefs());
      setDays(await loadDays());
      setStatus(await widgetStatus());
    })();
    const onVis = () => document.visibilityState === 'visible' && void widgetStatus().then(setStatus);
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  async function addToHome() {
    if (!prefs.enabled) await change({ ...prefs, enabled: true });
    await syncWidget(days);
    const ok = await pinWidget();
    setMsg(
      ok
        ? 'Choose "Add" in the box that opens. The AURA widget will appear on your home screen.'
        : 'Your launcher does not allow this. Long-press an empty spot on the home screen → Widgets, then search or scroll to AURA.',
    );
  }

  async function change(next: WidgetPrefs) {
    setPrefs(next);
    if (!next.enabled) {
      await turnWidgetOff();
      setMsg('Widget turned off and its stored numbers were cleared.');
      return;
    }
    await setWidgetPrefs(next);
    await syncWidget(days);
    setMsg(
      isNative()
        ? 'Updated. Long-press your home screen → Widgets → AURA to add it.'
        : 'Saved. The real widget appears in the Android app.',
    );
  }

  const snap = buildSnapshot(days, { ...prefs, enabled: true });

  return (
    <article className="card stack-sm">
      <div className="row between">
        <h3 style={{ margin: 0 }}>Home-screen widget</h3>
        <span className={`pill ${prefs.enabled ? 'ok' : ''}`}>{prefs.enabled ? 'On' : 'Off'}</span>
      </div>
      <WidgetPreview snap={snap} />
      {isNative() && (
        <div className="row gap wrap center-v">
          <button type="button" className="btn primary" onClick={() => void addToHome()}>
            ➕ Add widget to home screen
          </button>
          {status && status.placed > 0 && <span className="xs">✓ {status.placed} on your home screen</span>}
        </div>
      )}
      <label className="row gap center-v">
        <input type="checkbox" checked={prefs.enabled} onChange={(e) => void change({ ...prefs, enabled: e.target.checked })} />
        <span className="small">Show AURA on my home screen</span>
      </label>
      <label className="row gap center-v">
        <input
          type="checkbox"
          checked={!prefs.showNumbers}
          disabled={!prefs.enabled}
          onChange={(e) => void change({ ...prefs, showNumbers: !e.target.checked })}
        />
        <span className="small">Score only (hide sleep, steps and screen time)</span>
      </label>
      {msg && <p className="xs">{msg}</p>}
      <p className="xs muted">
        On by default: anyone who sees your home screen can see the widget, even while AURA is locked. Turning it off,
        or deleting everything in My Data, removes its numbers.
      </p>
    </article>
  );
}
