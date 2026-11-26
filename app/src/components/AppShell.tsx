import { useState, type ReactNode } from 'react';
import { SideMenu } from './SideMenu';
import { AuraAvatar } from '../avatar/AuraAvatar';
import { useMe } from '../avatar/AvatarContext';
import {
  AskIcon,
  AuraLogoIcon,
  CheckInIcon,
  GoalsIcon,
  LockIcon,
  AppsIcon,
  MenuIcon,
  MoonIcon,
  ProfileIcon,
  SunIcon,
  TodayIcon,
} from './Icons';

export type AppTab =
  | 'dashboard'
  | 'report'
  | 'checkin'
  | 'routine'
  | 'food'
  | 'goals'
  | 'plan-goals'
  | 'bucket-list'
  | 'ask'
  | 'exercise'
  | 'health'
  | 'phone'
  | 'apps'
  | 'vault'
  | 'profile'
  | 'permissions'
  | 'about'
  | 'me';
export type ThemeMode = 'dark' | 'light' | 'system';

type GroupId = 'today' | 'track' | 'report' | 'goals' | 'plan' | 'usage' | 'ask' | 'me';

interface Group {
  id: GroupId;
  label: string;
  icon: (props: { size?: number }) => JSX.Element;
  tabs: AppTab[];
}

/** Five bottom tabs for daily use. Everything else lives in the left menu (☰). */
export const GROUPS: Group[] = [
  { id: 'today', label: 'Home', icon: TodayIcon, tabs: ['dashboard'] },
  { id: 'track', label: 'Track', icon: CheckInIcon, tabs: ['checkin', 'food', 'exercise', 'health', 'routine'] },
  { id: 'report', label: 'Report', icon: ReportIcon, tabs: ['report'] },
  { id: 'goals', label: 'Targets', icon: GoalsIcon, tabs: ['goals'] },
  { id: 'ask', label: 'Ask', icon: AskIcon, tabs: ['ask'] },
];

/** Screens opened from the left menu. */
const MENU_GROUPS: Group[] = [
  { id: 'plan', label: 'Plan', icon: GoalsIcon, tabs: ['plan-goals', 'bucket-list'] },
  { id: 'usage', label: 'Usage', icon: AppsIcon, tabs: ['apps', 'phone'] },
  { id: 'me', label: 'Me', icon: ProfileIcon, tabs: ['me', 'profile', 'permissions', 'vault', 'about'] },
];

function ReportIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </svg>
  );
}

const TITLES: Record<AppTab, string> = {
  dashboard: 'Today',
  report: 'Weekly report',
  checkin: 'Track',
  routine: 'Routine',
  food: 'Track',
  exercise: 'Track',
  health: 'Track',
  goals: 'Daily targets',
  'plan-goals': 'Goals',
  'bucket-list': 'Bucket list',
  ask: 'Ask AURA',
  me: 'Settings',
  profile: 'Profile',
  permissions: 'Permissions',
  phone: 'Phone & band data',
  apps: 'App usage',
  vault: 'My data & privacy',
  about: 'About AURA',
};

const SUB_TABS: Partial<Record<GroupId, { id: AppTab; label: string }[]>> = {
  track: [
    { id: 'checkin', label: 'Check-in' },
    { id: 'food', label: 'Food' },
    { id: 'exercise', label: 'Exercise' },
    { id: 'health', label: 'Health' },
    { id: 'routine', label: 'Routine' },
  ],
  usage: [
    { id: 'apps', label: 'Apps & limits' },
    { id: 'phone', label: 'Phone & band data' },
  ],
};

export const groupOf = (tab: AppTab): Group => [...GROUPS, ...MENU_GROUPS].find((g) => g.tabs.includes(tab)) ?? GROUPS[0];

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
  const inMenu = MENU_GROUPS.some((g) => g.id === group.id);
  const subTabs = SUB_TABS[group.id];
  const [menuOpen, setMenuOpen] = useState(false);

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
        <nav className="aura-nav">
          {GROUPS.map((g) => navButton(g, 'aura-nav-btn'))}
          <button type="button" className="aura-nav-btn" onClick={() => setMenuOpen(true)}>
            <MenuIcon size={20} />
            <span>More</span>
          </button>
        </nav>
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
            {inMenu ? (
              <button type="button" className="btn ghost icon-only" onClick={() => onTabChange('dashboard')} aria-label="Back to Home">
                ‹
              </button>
            ) : (
              <button type="button" className="btn ghost icon-only" onClick={() => setMenuOpen(true)} aria-label="Open menu" aria-expanded={menuOpen}>
                <MenuIcon size={22} />
              </button>
            )}
            {tab !== 'dashboard' && tab !== 'routine' && <h1 className="aura-page-title">{TITLES[tab]}</h1>}
          </div>
          <div className="aura-topbar-actions">
            <button type="button" className="btn ghost icon-only" onClick={() => setMenuOpen(true)} aria-label="Open menu and profile" title="Menu" style={{ padding: 2 }}>
              <AuraAvatar choice={me.choice} photo={me.photo} name={me.name} size={30} />
            </button>
          </div>
        </header>

        {subTabs && (
          <div className="aura-segmented-wrap">
            <div className="aura-segmented" role="tablist" aria-label={group.label}>
              {subTabs.map((t) => (
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
          {hasDemo && (tab === 'dashboard' || tab === 'report') && (
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

      <SideMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        tab={tab}
        onNavigate={onTabChange}
        theme={theme}
        onToggleTheme={onToggleTheme}
        onLock={onLock}
      />

    </div>
  );
}
