import { useCallback, useEffect, useState } from 'react';
import { isUnlocked, lock, vaultExists } from './lib/vault';
import { Unlock } from './pages/Unlock';
import { Dashboard } from './pages/Dashboard';
import { CheckIn } from './pages/CheckIn';
import { Food } from './pages/Food';
import { Goals } from './pages/Goals';
import { Ask } from './pages/Ask';
import { VaultPage } from './pages/VaultPage';
import { About } from './pages/About';
import { loadDays } from './lib/store';
import { AppShell, type AppTab, type ThemeMode } from './components/AppShell';
import type { DayRecord } from './types';

const THEME_STORAGE_KEY = 'aura-theme';

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

  if (!unlocked) {
    return (
      <Unlock
        exists={exists}
        theme={theme}
        onToggleTheme={toggleTheme}
        onDone={() => {
          setExists(true);
          setUnlocked(true);
        }}
      />
    );
  }

  const hasDemo = days.some((d) => d.source === 'demo');

  return (
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
      {tab === 'about' && <About />}
    </AppShell>
  );
}
