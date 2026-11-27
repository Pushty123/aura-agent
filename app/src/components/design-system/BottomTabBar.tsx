import type { LucideIcon } from 'lucide-react';

export interface BottomTab {
  id: string;
  label: string;
  icon: LucideIcon;
}

interface BottomTabBarProps {
  tabs: BottomTab[];
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function BottomTabBar({ tabs, activeTab, onTabChange }: BottomTabBarProps) {
  return (
    <nav className="ds-bottom-tab-bar" aria-label="Main navigation">
      {tabs.map(({ id, label, icon: Icon }) => {
        const active = id === activeTab;
        return (
          <button
            className={`ds-bottom-tab${active ? ' is-active' : ''}`}
            type="button"
            key={id}
            aria-current={active ? 'page' : undefined}
            onClick={() => onTabChange(id)}
          >
            <Icon size={22} strokeWidth={active ? 2.2 : 1.8} aria-hidden="true" />
            <span>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export type { BottomTabBarProps };
