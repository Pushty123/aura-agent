import { useCallback, useEffect, useState } from 'react';
import { isUnlocked, lock, vaultExists } from './lib/vault';
import { Unlock } from './pages/Unlock';
import { Dashboard } from './pages/Dashboard';
import { CheckIn } from './pages/CheckIn';
import { Food } from './pages/Food';
import { Goals } from './pages/Goals';
import { Ask } from './pages/Ask';
import { VaultPage } from './pages/VaultPage';
import { loadDays } from './lib/store';
import { startAutoLock } from './lib/autolock';
import type { DayRecord } from './types';

const AUTO_LOCK_MS = 5 * 60 * 1000;

type Tab ='dashboard' | 'checkin' | 'food' | 'goals' | 'ask' | 'vault';

const TABS: { id: Tab; label: string }[] = [
  { id: 'dashboard', label: 'Today' },
  { id: 'checkin', label: 'Check-in' },
  { id: 'food', label: 'Food' },
  { id: 'goals', label: 'Goals' },
  { id: 'ask', label: 'Ask AURA' },
  { id: 'vault', label: 'My Data' },
];

export function App() {
  const [ready, setReady] = useState(false);
  const [exists, setExists] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [tab, setTab] = useState<Tab>('dashboard');
  const [days, setDays] = useState<DayRecord[]>([]);

  useEffect(() => {
    vaultExists().then((e) => {
      setExists(e);
      setUnlocked(isUnlocked());
      setReady(true);
    });
  }, []);

  const refresh = useCallback(async () => {
    setDays(await loadDays());
  }, []);

  useEffect(() => {
    if (unlocked) void refresh();
  }, [unlocked, refresh]);

  // Lock automatically after 5 minutes without activity, and drop the
  // decrypted data held in memory.
  useEffect(() => {
    if (!unlocked) return;
    return startAutoLock(AUTO_LOCK_MS, () => {
      setDays([]);
      setUnlocked(false);
    });
  }, [unlocked]);

  if (!ready) return <div className="center">Loading…</div>;

  if (!unlocked) {
    return (
      <Unlock
        exists={exists}
        onDone={() => {
          setExists(true);
          setUnlocked(true);
        }}
      />
    );
  }

  const hasDemo = days.some((d) => d.source === 'demo');

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <span className="logo">AURA</span>
          <span className="tag">Your data. Your intelligence.</span>
        </div>
        <button
          className="ghost"
          onClick={() => {
            lock();
            setUnlocked(false);
          }}
        >
          Lock
        </button>
      </header>
      {hasDemo && <div className="demo-banner">Demo data is switched on: the numbers below are sample data, not a real person.</div>}
      <main>
        {tab === 'dashboard' && <Dashboard days={days} onChange={refresh} />}
        {tab === 'checkin' && <CheckIn days={days} onChange={refresh} />}
        {tab === 'food' && <Food />}
        {tab === 'goals' && <Goals days={days} />}
        {tab === 'ask' && <Ask days={days} />}
        {tab === 'vault' && (
          <VaultPage
            onChange={refresh}
            onDeleted={() => {
              setExists(false);
              setUnlocked(false);
              setDays([]);
            }}
          />
        )}
      </main>
      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
