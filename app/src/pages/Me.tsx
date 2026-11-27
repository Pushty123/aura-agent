import { useEffect, useState, type ReactNode } from 'react';
import {
  Bell,
  ChevronRight,
  Fingerprint,
  Hourglass,
  Info,
  LayoutGrid,
  Lock,
  LogOut,
  Moon,
  ShieldCheck,
  User,
  Watch,
} from 'lucide-react';
import { AuraAvatar } from '../avatar/AuraAvatar';
import { useMe } from '../avatar/AvatarContext';
import { getSession, logout } from '../lib/account';
import type { AppTab, ThemeMode } from '../components/AppShell';

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

/** Settings: grouped like standard apps (Account, Preferences, Privacy, About). */
export function Me({
  onOpen,
  theme,
  onToggleTheme,
  onLock,
}: {
  onOpen: (tab: AppTab) => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
  onLock: () => void;
}) {
  const me = useMe();
  const [email, setEmail] = useState<string | null>(null);
  useEffect(() => {
    void getSession().then((s) => setEmail(s?.email ?? null));
  }, []);

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
        <Row
          icon={<Moon size={20} />}
          title="Dark mode"
          onClick={onToggleTheme}
          right={
            <span className="switch" aria-hidden="true">
              <input type="checkbox" checked={theme === 'dark'} readOnly tabIndex={-1} />
              <span />
            </span>
          }
        />
        <Row icon={<Bell size={20} />} title="Reminders & notifications" sub="Water, goals, study blocks" onClick={() => onOpen('goals')} />
        <Row icon={<LayoutGrid size={20} />} title="Home-screen widget" sub="Show your score on the home screen" onClick={() => onOpen('profile')} />
      </Group>

      <Group title="Phone & data">
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
