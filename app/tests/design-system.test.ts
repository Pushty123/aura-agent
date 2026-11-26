import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { Heart, House } from 'lucide-react';
import {
  BottomTabBar,
  IconTile,
  MetricCard,
  RangeBar,
  ScreenHeader,
} from '../src/components/design-system';

describe('design system components', () => {
  it('renders a labeled metric, accent tile, and optional range', () => {
    const markup = renderToStaticMarkup(createElement(MetricCard, {
      kind: 'heart',
      label: 'Heart rate',
      value: 72,
      unit: 'bpm',
      timestamp: 'Updated 9:41 AM',
      range: { min: 40, max: 180, value: 72, label: 'Heart rate range' },
    }));

    expect(markup).toContain('data-metric="heart"');
    expect(markup).toContain('Heart rate');
    expect(markup).toContain('72');
    expect(markup).toContain('bpm');
    expect(markup).toContain('Updated 9:41 AM');
    expect(markup).toContain('aria-label="Heart rate range"');
  });

  it('clamps a range marker to the visible track', () => {
    const markup = renderToStaticMarkup(createElement(RangeBar, {
      min: 0,
      max: 100,
      value: 140,
      label: 'Demo range',
    }));
    expect(markup).toContain('style="left:100%"');
    expect(markup).toContain('aria-valuenow="100"');
  });

  it('provides a settings action and marks the active navigation tab', () => {
    const markup = renderToStaticMarkup(createElement('div', null,
      createElement(ScreenHeader, {
        title: 'Today',
        date: 'WEDNESDAY, NOVEMBER 26',
        onSettingsClick: vi.fn(),
      }),
      createElement(BottomTabBar, {
        tabs: [
          { id: 'home', label: 'Home', icon: House },
          { id: 'health', label: 'Health', icon: Heart },
        ],
        activeTab: 'health',
        onTabChange: vi.fn(),
      }),
    ));

    expect(markup).toContain('aria-label="Open settings"');
    expect(markup).toContain('aria-current="page"');
    expect(markup).toContain('Health');
  });

  it('renders every supported metric icon tile without emoji', () => {
    const kinds = ['heart', 'exercise', 'blood-pressure', 'sleep', 'steps', 'water', 'mood', 'food'] as const;
    const markup = renderToStaticMarkup(createElement('div', null,
      ...kinds.map((kind) => createElement(IconTile, { key: kind, kind })),
    ));
    for (const kind of kinds) expect(markup).toContain(`data-metric="${kind}"`);
    expect(markup).not.toContain('❤️');
  });
});
