import { useRef, useState, type ReactNode } from 'react';
import { AuraAvatar } from '../avatar/AuraAvatar';
import { useMe } from '../avatar/AvatarContext';
import { SideDrawer } from './SideDrawer';
import {
  AskIcon,
  AuraLogoIcon,
  CheckInIcon,
  GoalsIcon,
  LockIcon,
  MenuIcon,
  MoonIcon,
  ProfileIcon,
  SunIcon,
  TodayIcon,
} from './Icons';

export type AppTab =
  | 'dashboard'
  | 'checkin'
  | 'food'
  | 'goals'
  | 'ask'
  | 'exercise'
  | 'health'
  | 'phone'
  | 'apps'
  | 'vault'
  | 'profile'
  | 'about'
  | 'me';
export type ThemeMode = 'dark' | 'light';

type GroupId = 'today' | 'track' | 'goals' | 'ask' | 'me';

interface Group {
  id: GroupId;
  label: string;
  icon: (props: { size?: number }) => JSX.Element;
  tabs: AppTab[];
}

/** Five bottom tabs, like most well-known apps. Related screens live inside a tab. */
export const GROUPS: Group[] = [
  { id: 'today', label: 'Home', icon: TodayIcon, tabs: ['dashboard'] },
  { id: 'track', label: 'Track', icon: CheckInIcon, tabs: ['checkin', 'food', 'exercise', 'health'] },
  { id: 'goals', label: 'Goals', icon: GoalsIcon, tabs: ['goals'] },
  { id: 'ask', label: 'Ask', icon: AskIcon, tabs: ['ask'] },
  { id: 'me', label: 'Me', icon: ProfileIcon, tabs: ['me', 'profile', 'phone', 'apps', 'vault', 'about'] },
];

const TITLES: Record<AppTab, string> = {
  dashboard: 'Home',
  checkin: 'Track',
  food: 'Track',
  exercise: 'Track',
  health: 'Track',
  goals: 'Goals',
  ask: 'Ask AURA',
  me: 'Me',
  profile: 'Profile',
  phone: 'Phone & band data',
  apps: 'App usage',
  vault: 'My data & privacy',
  about: 'About AURA',
};

const TRACK_TABS: { id: AppTab; label: string }[] = [
  { id: 'checkin', label: 'Check-in' },
  { id: 'food', label: 'Food' },
  { id: 'exercise', label: 'Exercise' },
  { id: 'health', label: 'Health' },
];

export const groupOf = (tab: AppTab): Group => GROUPS.find((g) => g.tabs.includes(tab)) ?? GROUPS[0];

interface AppShellProps {
  tab: AppTab;
  onTabChange: (tab: AppTab) => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
  onLock: () => void;
  hasDemo: boolean;
  children: ReactNode;
}

export function AppShell({ tab, onTabChange, theme, onToggleTheme, onLock, hasDemo, children }: AppShellProps) {
  const me = useMe();
  const group = groupOf(tab);
  const isMeSub = group.id === 'me' && tab !== 'me';
  const [drawerOpen, setDrawerOpen] = useState(false);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);

  const navButton = (g: Group, cls: string) => {
    const Icon = g.icon;
    const active = g.id === group.id;
    return (
      <button
        key={g.id}
        type="button"
        className={`${cls} ${active ? 'active' : ''}`}
        aria-current={active ? 'page' : undefined}
        onClick={() => onTabChange(g.tabs[0])}
      >
        {g.id === 'me' ? (
          <span className="aura-nav-avatar-wrap">
            <AuraAvatar choice={me.choice} photo={me.photo} name={me.name} size={20} />
          </span>
        ) : (
          <Icon size={20} />
        )}
        <span>{g.label}</span>
      </button>
    );
  };

  return (
    <div className="aura-shell">
      <aside className="aura-sidebar" aria-label="Primary navigation">
        <div className="aura-brand">
          <div className="aura-logo-mark">
            <AuraLogoIcon size={20} />
          </div>
          <div className="aura-brand-text">
            <span className="aura-brand-name">AURA</span>
            <span className="aura-brand-tag">Personal Intelligence</span>
          </div>
        </div>
        <nav className="aura-nav">{GROUPS.map((g) => navButton(g, 'aura-nav-btn'))}</nav>
        <div className="aura-sidebar-footer">
          <button type="button" className="aura-nav-btn" onClick={onToggleTheme}>
            {theme === 'dark' ? <SunIcon size={18} /> : <MoonIcon size={18} />}
            <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
          </button>
          <button type="button" className="aura-nav-btn" onClick={onLock}>
            <LockIcon size={18} />
            <span>Lock</span>
          </button>
        </div>
      </aside>

      <div className="aura-main-col">
        <header className="aura-topbar">
          <div className="aura-topbar-left">
            <button
              ref={menuTriggerRef}
              type="button"
              className="btn ghost icon-only aura-mobile-menu-btn"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open menu"
              aria-expanded={drawerOpen}
            >
              <MenuIcon size={20} />
            </button>
            {isMeSub && (
              <button
                type="button"
                className="btn ghost icon-only"
                onClick={() => onTabChange('me')}
                aria-label="Back to Me"
              >
                ‹
              </button>
            )}
            <h1 className="aura-page-title">{TITLES[tab]}</h1>
          </div>
          <div className="aura-topbar-actions">
            <span className="pill primary aura-encrypted-pill" title="Vault decrypted on this device">
              <LockIcon size={12} />
              <span>Encrypted</span>
            </span>
            <button
              type="button"
              className="btn ghost icon-only"
              onClick={onLock}
              aria-label="Lock AURA"
              title="Lock"
            >
              <LockIcon size={18} />
            </button>
          </div>
        </header>

        {group.id === 'track' && (
          <div className="aura-segmented-wrap">
            <div className="aura-segmented" role="tablist" aria-label="Track">
              {TRACK_TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.id}
                  className={tab === t.id ? 'active' : ''}
                  onClick={() => onTabChange(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <main className="aura-content">
          {hasDemo && (
            <button type="button" className="demo-strip" onClick={() => onTabChange('vault')}>
              <span className="pill demo">DEMO</span>
              <span>Showing sample data</span>
              <span className="muted">Manage ›</span>
            </button>
          )}
          {children}
        </main>
      </div>

      <nav className="aura-mobile-nav" aria-label="Main">
        {GROUPS.map((g) => navButton(g, 'aura-mobile-nav-btn'))}
      </nav>

      <SideDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        tab={tab}
        onNavigate={onTabChange}
        theme={theme}
        onToggleTheme={onToggleTheme}
        onLock={onLock}
        triggerRef={menuTriggerRef}
      />
    </div>
  );
}
