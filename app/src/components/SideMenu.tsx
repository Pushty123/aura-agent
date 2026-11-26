import { useEffect, useRef, useState } from 'react';
import { Hourglass, Info, KeyRound, Lock, LogOut, Moon, Settings, ShieldCheck, Sun, User, Watch, type LucideIcon } from 'lucide-react';
import { AuraAvatar } from '../avatar/AuraAvatar';
import { useMe } from '../avatar/AvatarContext';
import { getSession, logout } from '../lib/account';
import { LoginSheet } from './LoginSheet';
import type { AppTab, ThemeMode } from './AppShell';

interface Item {
  tab: AppTab;
  icon: LucideIcon;
  label: string;
  sub: string;
}

const SECTIONS: { title: string; items: Item[] }[] = [
  {
    title: 'Your phone',
    items: [
      { tab: 'apps', icon: Hourglass, label: 'App usage & limits', sub: 'Time per app, opens, daily limits' },
      { tab: 'phone', icon: Watch, label: 'Phone & band data', sub: 'Steps, sleep, screen time, Health Connect' },
    ],
  },
  {
    title: 'Account & settings',
    items: [
      { tab: 'profile', icon: User, label: 'Profile & character', sub: 'Details, avatar, fingerprint, widget' },
      { tab: 'me', icon: Settings, label: 'Settings', sub: 'Theme, lock, app preferences' },
      { tab: 'vault', icon: ShieldCheck, label: 'My data & privacy', sub: 'Export, delete, network log' },
      { tab: 'about', icon: Info, label: 'About & help', sub: 'How AURA protects your data' },
    ],
  },
];

/** Left-side menu: account, secondary screens and settings. The bottom bar keeps only the daily tabs. */
export function SideMenu({
  open,
  onClose,
  tab,
  onNavigate,
  theme,
  onToggleTheme,
  onLock,
}: {
  open: boolean;
  onClose: () => void;
  tab: AppTab;
  onNavigate: (t: AppTab) => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
  onLock: () => void;
}) {
  const me = useMe();
  const [email, setEmail] = useState<string | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    void getSession().then((s) => setEmail(s?.email ?? null));
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const go = (t: AppTab) => {
    onNavigate(t);
    onClose();
  };

  async function signOut() {
    if (!window.confirm('Log out of your AURA account? Your encrypted data stays on this phone, and AURA will lock.')) return;
    await logout();
    onClose();
    onLock();
  }

  return (
    <>
      <div className={`side-backdrop ${open ? 'open' : ''}`} onClick={onClose} aria-hidden={!open} />
      <aside
        ref={panel}
        tabIndex={-1}
        className={`side-menu ${open ? 'open' : ''}`}
        aria-label="Menu"
        aria-hidden={!open}
      >
        <button type="button" className="side-profile" onClick={() => go('profile')}>
          <AuraAvatar choice={me.choice} photo={me.photo} name={me.name} size={52} />
          <span className="stack-sm" style={{ gap: 2, textAlign: 'left', minWidth: 0 }}>
            <strong>{me.name || 'Set up your profile'}</strong>
            <span className="xs muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{email ?? 'Not logged in · data on this phone only'}</span>
          </span>
        </button>

        {SECTIONS.map((s) => (
          <nav key={s.title} className="side-section" aria-label={s.title}>
            <span className="side-title">{s.title}</span>
            {s.items.map((i) => (
              <button key={i.tab} type="button" className={`side-item ${tab === i.tab ? 'active' : ''}`} onClick={() => go(i.tab)}>
                <span className="side-emoji" aria-hidden="true"><i.icon size={20} /></span>
                <span className="side-text">
                  <span>{i.label}</span>
                  <span className="xs muted">{i.sub}</span>
                </span>
              </button>
            ))}
          </nav>
        ))}

        <div className="side-section">
          <button type="button" className="side-item" onClick={onToggleTheme}>
            <span className="side-emoji" aria-hidden="true">{theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}</span>
            <span className="side-text"><span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span></span>
          </button>
          <button type="button" className="side-item" onClick={() => { onClose(); onLock(); }}>
            <span className="side-emoji" aria-hidden="true"><Lock size={20} /></span>
            <span className="side-text"><span>Lock AURA</span><span className="xs muted">Unlock with fingerprint or password</span></span>
          </button>
          {email ? (
            <button type="button" className="side-item danger" onClick={() => void signOut()}>
              <span className="side-emoji" aria-hidden="true"><LogOut size={20} /></span>
              <span className="side-text"><span>Log out</span><span className="xs muted">{email}</span></span>
            </button>
          ) : (
            <button type="button" className="side-item" onClick={() => setShowLogin(true)}>
              <span className="side-emoji" aria-hidden="true"><KeyRound size={20} /></span>
              <span className="side-text"><span>Log in or create account</span><span className="xs muted">For AI replies and encrypted backup</span></span>
            </button>
          )}
        </div>
        <p className="xs muted side-foot">AURA · your data stays encrypted on this phone</p>
      </aside>
      {showLogin && (
        <LoginSheet
          onClose={() => setShowLogin(false)}
          onDone={(e) => {
            setEmail(e);
            setShowLogin(false);
          }}
        />
      )}
    </>
  );
}
