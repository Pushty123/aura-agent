# AURA Android Home-Screen Widget Kit (**Proposal for Backend A — not wired**)

These files are design/resource proposals for Backend A (Part 1). No native Kotlin, Java, or Gradle files were modified.

## Contents
- `colors.xml` — AURA dark/light color tokens mapped to Android color resources
- `widget_card_bg.xml` — Rounded widget card surface (`24dp` corner radius, `#1F212C` fill, `1dp` `#454B5C` stroke)
- `widget_ring_track.xml` & `widget_ring_arc.xml` — Vector drawables for the Balance Score ring
- `widget_layout_small.xml` — 2×2 widget layout (`minWidth="110dp"`, `minHeight="110dp"`)
- `widget_layout_medium.xml` — 4×2 widget layout (`minWidth="250dp"`, `minHeight="110dp"`)
- `appwidget_info.xml` — `appwidget-provider` metadata sketch

## Required Privacy & Honesty Rules
1. **Locked vault:** When `vault` is locked, hide the score and insights; show a neutral lock icon + `"Unlock AURA to view"`.
2. **Insufficient data:** When no score is available, show `—` + `"Not enough data yet"` (never a fake `0`).
3. **Demo data:** Show the `"DEMO"` badge whenever the underlying record has `source == "demo"`.
4. **No medical claims:** AURA is a wellness tool, not medical advice.
