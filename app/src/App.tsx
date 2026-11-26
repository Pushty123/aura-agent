import { useCallback, useEffect, useState } from 'react';
import { isUnlocked, lock, vaultExists } from './lib/vault';
import { Unlock } from './pages/Unlock';
import { Account } from './pages/Account';
import { Dashboard } from './pages/Dashboard';
import { CheckIn } from './pages/CheckIn';
import { Food } from './pages/Food';
import { Goals } from './pages/Goals';
import { Ask } from './pages/Ask';
import { VaultPage } from './pages/VaultPage';
import { About } from './pages/About';
import { Profile } from './pages/Profile';
import { Exercise } from './pages/Exercise';
import { PhoneData } from './pages/PhoneData';
import { syncPhoneData } from './sync/phoneSync';
import { AvatarProvider } from './avatar/AvatarContext';
import { syncWidget } from './widget/widget';
import { loadDays } from './lib/store';
import { startAutoLock } from './lib/autolock';
import { AppShell, type AppTab, type ThemeMode } from './components/AppShell';
import type { DayRecord } from './types';

const THEME_STORAGE_KEY = 'aura-theme';
const AUTO_LOCK_MS = 5 * 60 * 1000;

function readInitialTheme(): ThemeMode {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // Ignore storage access errors
  }
  return 'dark';
}

export function App() {
  const [ready, setReady] = useState(false);
  const [exists, setExists] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [idleLocked, setIdleLocked] = useState(false);
  const [tab, setTab] = useState<AppTab>('dashboard');
  const [days, setDays] = useState<DayRecord[]>([]);
  const [theme, setTheme] = useState<ThemeMode>(readInitialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Ignore storage access errors
    }
  }, [theme]);

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
      setIdleLocked(true);
      setUnlocked(false);
    });
  }, [unlocked]);

  // Keep phone and band data fresh: sync when the vault opens and whenever the app
  // comes back to the screen (at most every 10 minutes). Only runs if the person
  // has allowed device data; it never opens permission screens by itself.
  useEffect(() => {
    if (!unlocked) return;
    let last = 0;
    const run = async () => {
      if (Date.now() - last < 10 * 60 * 1000) return;
      last = Date.now();
      try {
        const r = await syncPhoneData({ interactive: false });
        if (r.screen.state === 'synced' || r.health.state === 'synced') await refresh();
      } catch {
        // Background sync must never break the app.
      }
    };
    void run();
    const onVis = () => document.visibilityState === 'visible' && void run();
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [unlocked, refresh]);

  // Keep the home-screen widget in step with the latest data (only if turned on).
  useEffect(() => {
    if (!unlocked) return;
    void syncWidget(days).catch(() => undefined);
  }, [unlocked, days]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  if (!ready) {
    return (
      <div className="unlock-screen">
        <p className="muted">Loading AURA…</p>
      </div>
    );
  }

  if (!exists) {
    return (
      <Account
        theme={theme}
        onToggleTheme={toggleTheme}
        onDone={() => {
          setExists(true);
          setUnlocked(true);
        }}
      />
    );
  }

  if (!unlocked) {
    return (
      <Unlock
        exists={exists}
        theme={theme}
        onToggleTheme={toggleTheme}
        notice={idleLocked ? 'Locked after 5 minutes of inactivity to protect your data.' : undefined}
        onDone={() => {
          setIdleLocked(false);
          setExists(true);
          setUnlocked(true);
        }}
      />
    );
  }

  const hasDemo = days.some((d) => d.source === 'demo');

  return (
    <AvatarProvider>
    <AppShell
      tab={tab}
      onTabChange={setTab}
      theme={theme}
      onToggleTheme={toggleTheme}
      onLock={() => {
        lock();
        setUnlocked(false);
      }}
      hasDemo={hasDemo}
    >
      {tab === 'dashboard' && <Dashboard days={days} onChange={refresh} onNavigate={setTab} />}
      {tab === 'checkin' && <CheckIn days={days} onChange={refresh} />}
      {tab === 'food' && <Food />}
      {tab === 'goals' && <Goals days={days} />}
      {tab === 'exercise' && <Exercise />}
      {tab === 'phone' && <PhoneData days={days} onChange={refresh} />}
      {tab === 'ask' && <Ask days={days} />}
      {tab === 'vault' && (
        <VaultPage
          onChange={refresh}
          onDeleted={() => {
            setExists(false);
            setUnlocked(false);
            setDays([]);
            setTab('dashboard');
          }}
        />
      )}
      {tab === 'profile' && <Profile />}
      {tab === 'about' && <About />}
    </AppShell>
    </AvatarProvider>
  );
}
