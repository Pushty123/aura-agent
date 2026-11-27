import { useEffect, useState, type ReactNode } from 'react';
import {
  Bell,
  ChevronRight,
  Fingerprint,
  Hourglass,
  Info,
  KeySquare,
  LayoutGrid,
  Lock,
  LogOut,
  Palette,
  PartyPopper,
  ShieldCheck,
  User,
  Watch,
} from 'lucide-react';
import { AuraAvatar } from '../avatar/AuraAvatar';
import { useMe } from '../avatar/AvatarContext';
import { getSession, logout } from '../lib/account';
import type { AppTab } from '../components/AppShell';
import type { ThemePreference } from '../lib/theme';
import { loadCelebrationsEnabled, saveCelebrationsEnabled } from '../goals/personalGoals';

const VERSION = '1.0.0';

function Row({ icon, title, sub, onClick, right, danger }: { icon: ReactNode; title: string; sub?: string; onClick?: () => void; right?: ReactNode; danger?: boolean }) {
  return (
    <button type="button" className={`list-row ${danger ? 'danger' : ''}`} onClick={onClick}>
      <span className="list-emoji" aria-hidden="true">{icon}</span>
      <span className="list-text">
        <strong>{title}</strong>
        {sub && <span className="xs muted">{sub}</span>}
      </span>
      {right ?? <ChevronRight size={18} className="muted" aria-hidden="true" />}
    </button>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="settings-group">
      <span className="settings-title">{title}</span>
      <div className="card list-card">{children}</div>
    </div>
  );
}

/** Settings: grouped like standard apps (Account, Preferences, Phone & data, About). */
export function Me({
  onOpen,
  theme,
  onThemeChange,
  onLock,
}: {
  onOpen: (tab: AppTab) => void;
  theme: ThemePreference;
  onThemeChange: (theme: ThemePreference) => void;
  onLock: () => void;
}) {
  const me = useMe();
  const [email, setEmail] = useState<string | null>(null);
  const [celebrations, setCelebrations] = useState<boolean | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void getSession().then((s) => active && setEmail(s?.email ?? null));
    void loadCelebrationsEnabled()
      .then((on) => active && setCelebrations(on))
      .catch((e: unknown) => active && setError(e instanceof Error ? e.message : 'Could not load celebration settings.'));
    return () => {
      active = false;
    };
  }, []);

  async function toggleCelebrations(on: boolean) {
    try {
      await saveCelebrationsEnabled(on);
      setCelebrations(on);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save this setting.');
    }
  }

  async function signOut() {
    if (!window.confirm('Log out of your AURA account? Your encrypted data stays on this phone, and AURA will lock.')) return;
    await logout();
    onLock();
  }

  return (
    <section className="stack-lg">
      <button type="button" className="card row center-v gap me-hero" onClick={() => onOpen('profile')}>
        <AuraAvatar choice={me.choice} photo={me.photo} name={me.name} size={60} />
        <div style={{ textAlign: 'left', minWidth: 0 }}>
          <h2 style={{ margin: 0 }}>{me.name || 'Set up your profile'}</h2>
          <p className="xs muted" style={{ margin: 0 }}>{email ?? 'Not logged in · data on this phone only'}</p>
        </div>
        <ChevronRight size={20} className="muted" style={{ marginLeft: 'auto' }} aria-hidden="true" />
      </button>

      <Group title="Account">
        <Row icon={<User size={20} />} title="Profile & character" sub="Name, body details, avatar" onClick={() => onOpen('profile')} />
        <Row icon={<Fingerprint size={20} />} title="Fingerprint unlock" sub="Open AURA without typing your password" onClick={() => onOpen('profile')} />
      </Group>

      <Group title="Preferences">
        <label className="list-row">
          <span className="list-emoji" aria-hidden="true"><Palette size={20} /></span>
          <span className="list-text">
            <strong>Theme</strong>
            <span className="xs muted">Light, dark, or follow your phone</span>
          </span>
          <select
            className="input"
            aria-label="Theme"
            value={theme}
            onChange={(e) => onThemeChange(e.target.value as ThemePreference)}
            style={{ width: 'auto', minWidth: 104 }}
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
        <label className="list-row">
          <span className="list-emoji" aria-hidden="true"><PartyPopper size={20} /></span>
          <span className="list-text">
            <strong>Celebrations</strong>
            <span className="xs muted">A small moment when you reach a goal or dream</span>
          </span>
          <span className="switch">
            <input
              type="checkbox"
              aria-label="Celebrations"
              checked={celebrations ?? false}
              disabled={celebrations === null}
              onChange={(e) => void toggleCelebrations(e.target.checked)}
            />
            <span />
          </span>
        </label>
        <Row icon={<Bell size={20} />} title="Reminders & notifications" sub="Water, goals, study blocks" onClick={() => onOpen('goals')} />
        <Row icon={<LayoutGrid size={20} />} title="Home-screen widget" sub="Show your score on the home screen" onClick={() => onOpen('profile')} />
      </Group>
      {error && <p className="status-banner error" role="alert">{error}</p>}

      <Group title="Phone & data">
        <Row icon={<KeySquare size={20} />} title="Permissions" sub="Choose which data sources AURA can use" onClick={() => onOpen('permissions')} />
        <Row icon={<Hourglass size={20} />} title="App usage & limits" sub="Screen time, daily phone limit" onClick={() => onOpen('apps')} />
        <Row icon={<Watch size={20} />} title="Phone & band data" sub="Steps, sleep, Health Connect" onClick={() => onOpen('phone')} />
        <Row icon={<ShieldCheck size={20} />} title="My data & privacy" sub="Export, delete, what is shared" onClick={() => onOpen('vault')} />
      </Group>

      <Group title="About">
        <Row icon={<Info size={20} />} title="About AURA" sub="How your data is protected" onClick={() => onOpen('about')} />
      </Group>

      <div className="card list-card">
        <Row icon={<Lock size={20} />} title="Lock AURA" onClick={onLock} right={<span />} />
        {email && <Row icon={<LogOut size={20} />} title="Log out" sub={email} onClick={() => void signOut()} right={<span />} danger />}
      </div>

      <p className="xs muted" style={{ textAlign: 'center' }}>
        AURA v{VERSION} · Team Phoenix
      </p>
    </section>
  );
}
