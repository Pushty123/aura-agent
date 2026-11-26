import { useCallback, useEffect, useRef, useState } from 'react';
import { isUnlocked, lock, vaultExists } from './lib/vault';
import { loadThemePreference, saveThemePreference, type ThemePreference } from './lib/theme';
import { Unlock } from './pages/Unlock';
import { Account } from './pages/Account';
import { Dashboard } from './pages/Dashboard';
import { CheckIn } from './pages/CheckIn';
import { Food } from './pages/Food';
import { Goals } from './pages/Goals';
import { PlanGoals } from './pages/PlanGoals';
import { BucketList } from './pages/BucketList';
import { Ask } from './pages/Ask';
import { VaultPage } from './pages/VaultPage';
import { About } from './pages/About';
import { Profile } from './pages/Profile';
import { Health } from './pages/Health';
import { Report } from './pages/Report';
import { Exercise } from './pages/Exercise';
import { PhoneData } from './pages/PhoneData';
import { AppUsage } from './pages/AppUsage';
import { Me } from './pages/Me';
import { Design } from './pages/Design';
import { PermissionsPage } from './pages/Permissions';
import { Routine } from './pages/Routine';
import { syncPhoneData } from './sync/phoneSync';
import { AvatarProvider } from './avatar/AvatarContext';
import { syncWidget } from './widget/widget';
import { loadDays } from './lib/store';
import { startAutoLock } from './lib/autolock';
import { getLockAfter, lockLabel } from './lib/security';
import { AppShell, type AppTab } from './components/AppShell';
import type { DayRecord } from './types';
import type { ActionPerformed } from '@capacitor/local-notifications';
import { addNotificationActionListener } from './native/bridge';
import {
  loadRoutineItems,
  loadRoutineResponses,
  recordDueRoutineMisses,
  recordRoutineResponse,
  routineForNotificationId,
  routineOccurrenceDate,
  saveRoutineResponses,
} from './reminders/routine';
import {
  addWaterGlass,
  loadWaterResponses,
  loadWaterSettings,
  recordWaterResponse,
  saveWaterResponses,
  waterSlotForNotificationId,
} from './reminders/water';
import { patchDay } from './lib/store';
import { today } from './lib/dates';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function App() {
  const [ready, setReady] = useState(false);
  const [exists, setExists] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [idleLocked, setIdleLocked] = useState(false);
  const [tab, setTab] = useState<AppTab>('dashboard');
  const [days, setDays] = useState<DayRecord[]>([]);
  const [theme, setTheme] = useState<ThemePreference>('system');
  const [themeVaultReady, setThemeVaultReady] = useState(false);
  const [pendingNotificationAction, setPendingNotificationAction] = useState<ActionPerformed | null>(null);
  const [notificationError, setNotificationError] = useState('');
  const themeTouchedWhileLocked = useRef(false);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const applyTheme = () => {
      document.documentElement.dataset.theme = theme === 'system' ? (media.matches ? 'dark' : 'light') : theme;
    };
    applyTheme();
    media.addEventListener('change', applyTheme);
    return () => media.removeEventListener('change', applyTheme);
  }, [theme]);

  useEffect(() => {
    if (!unlocked) {
      setThemeVaultReady(false);
      return;
    }

    let active = true;
    setThemeVaultReady(false);
    void loadThemePreference().then((savedTheme) => {
      if (!active) return;
      if (savedTheme && !themeTouchedWhileLocked.current) setTheme(savedTheme);
      themeTouchedWhileLocked.current = false;
      setThemeVaultReady(true);
    }).catch((error: unknown) => {
      console.error('Unable to load the saved theme from the vault.', error);
      if (active) {
        themeTouchedWhileLocked.current = false;
        setThemeVaultReady(true);
      }
    });

    return () => {
      active = false;
    };
  }, [unlocked]);

  useEffect(() => {
    if (!unlocked || !themeVaultReady) return;
    void saveThemePreference(theme).catch((error: unknown) => {
      console.error('Unable to save the theme preference to the vault.', error);
    });
  }, [theme, themeVaultReady, unlocked]);

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
    let active = true;
    let listener: { remove: () => Promise<void> } | undefined;
    void addNotificationActionListener((event) => {
      setPendingNotificationAction(event);
    }).then((registered) => {
      if (active) listener = registered;
      else void registered.remove();
    }).catch((error: unknown) => {
      if (active) setNotificationError(error instanceof Error ? error.message : 'Could not listen for reminder actions.');
    });
    return () => {
      active = false;
      if (listener) void listener.remove();
    };
  }, []);

  useEffect(() => {
    if (!unlocked || !pendingNotificationAction) return;
    const payload = isRecord(pendingNotificationAction.notification.extra)
      ? pendingNotificationAction.notification.extra
      : null;
    const kind = payload?.kind;
    if (pendingNotificationAction.actionId === 'tap') {
      setTab(kind === 'routine' ? 'routine' : kind === 'goal-date' ? 'plan-goals' : 'dashboard');
      setPendingNotificationAction(null);
      return;
    }

    let active = true;
    void (async () => {
      const recordedAt = new Date();
      const notificationId = pendingNotificationAction.notification.id;
      if (kind === 'routine' && typeof notificationId === 'number'
        && ['routine-done', 'routine-not-now'].includes(pendingNotificationAction.actionId)) {
        const scheduled = routineForNotificationId(await loadRoutineItems(), notificationId);
        if (!scheduled) throw new Error('This routine has changed; open Routine to review its current schedule.');
        const date = routineOccurrenceDate(scheduled.weekday, scheduled.item.time, recordedAt);
        const existing = await loadRoutineResponses();
        await saveRoutineResponses(recordRoutineResponse(
          existing,
          scheduled.item.id,
          date,
          pendingNotificationAction.actionId === 'routine-done' ? 'done' : 'not-now',
          recordedAt.toISOString(),
        ));
        if (active) setTab('routine');
      } else if (kind === 'water' && typeof notificationId === 'number'
        && ['water-drank', 'water-not-now'].includes(pendingNotificationAction.actionId)) {
        const slot = waterSlotForNotificationId(await loadWaterSettings(), notificationId);
        if (!slot) throw new Error('This water reminder has changed; open Today to review your settings.');
        const date = today();
        const existing = await loadWaterResponses();
        await saveWaterResponses(recordWaterResponse(
          existing,
          `${slot.weekday}:${slot.hour}:${slot.minute}`,
          date,
          pendingNotificationAction.actionId === 'water-drank' ? 'drank-water' : 'not-now',
          recordedAt.toISOString(),
        ));
        if (pendingNotificationAction.actionId === 'water-drank') {
          const current = (await loadDays()).find((day) => day.date === date);
          await patchDay(date, addWaterGlass(current));
          await refresh();
        }
        if (active) setTab('dashboard');
      }
      if (active) {
        setNotificationError('');
        setPendingNotificationAction(null);
      }
    })().catch((error: unknown) => {
      if (active) {
        setTab(kind === 'routine' ? 'routine' : 'dashboard');
        setNotificationError(error instanceof Error ? error.message : 'Could not save your reminder response.');
        setPendingNotificationAction(null);
      }
    });
    return () => {
      active = false;
    };
  }, [pendingNotificationAction, unlocked, refresh]);

  useEffect(() => {
    if (unlocked) void refresh();
  }, [unlocked, refresh]);

  useEffect(() => {
    if (!unlocked) return;
    let active = true;
    const recordMisses = async () => {
      try {
        await recordDueRoutineMisses(await loadRoutineItems());
      } catch (error) {
        if (active) setNotificationError(error instanceof Error ? error.message : 'Could not record missed routine items.');
      }
    };
    void recordMisses();
    const interval = window.setInterval(() => void recordMisses(), 15 * 60 * 1000);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void recordMisses();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      active = false;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [unlocked]);

  // Lock automatically after 5 minutes without activity, and drop the
  // decrypted data held in memory.
  // Lock automatically after the chosen idle time (Profile → Security).
  const [lockMs, setLockMs] = useState(0);
  useEffect(() => {
    if (!unlocked) return;
    let stop: (() => void) | undefined;
    let cancelled = false;
    void getLockAfter().then((ms) => {
      if (cancelled) return;
      setLockMs(ms);
      if (ms === 0) return; // only when the app is closed
      stop = startAutoLock(ms, () => {
        setDays([]);
        setIdleLocked(true);
        setUnlocked(false);
      });
    });
    return () => {
      cancelled = true;
      stop?.();
    };
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
    setTheme((prev) => {
      const current = prev === 'system'
        ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : prev;
      return current === 'dark' ? 'light' : 'dark';
    });
    if (!unlocked) themeTouchedWhileLocked.current = true;
  }, [unlocked]);

  if (window.location.pathname.replace(/\/+$/, '') === '/design') {
    return <Design theme={theme} onToggleTheme={toggleTheme} />;
  }

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
        notice={idleLocked ? `Locked after ${lockLabel(lockMs)} of inactivity to protect your data.` : undefined}
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
      {tab === 'report' && <Report days={days} onNavigate={setTab} />}
      {tab === 'checkin' && <CheckIn days={days} onChange={refresh} />}
      {tab === 'food' && <Food />}
      {tab === 'goals' && <Goals days={days} onChange={refresh} />}
      {tab === 'plan-goals' && <PlanGoals onNavigate={setTab} />}
      {tab === 'bucket-list' && <BucketList onNavigate={setTab} />}
      {tab === 'exercise' && <Exercise />}
      {tab === 'health' && <Health days={days} />}
      {tab === 'phone' && <PhoneData days={days} onChange={refresh} />}
      {tab === 'apps' && <AppUsage />}
      {tab === 'me' && (
        <Me
          onOpen={setTab}
          theme={theme}
          onThemeChange={setTheme}
          onLock={() => {
            lock();
            setUnlocked(false);
          }}
        />
      )}
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
      {tab === 'permissions' && <PermissionsPage onChanged={refresh} />}
      {tab === 'routine' && <Routine onOpenPermissions={() => setTab('permissions')} />}
      {notificationError && <div className="status-banner error" role="alert">{notificationError}</div>}
      {tab === 'about' && <About />}
    </AppShell>
    </AvatarProvider>
  );
}
