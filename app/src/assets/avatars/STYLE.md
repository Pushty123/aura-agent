# AURA Human Profile Avatars — Visual Style Guide

## 1. Chosen Style: Option A — Soft-3D Cartoon
Every character in the AURA avatar library is a matte, soft-3D vector illustration built from clean SVG shapes, radial/linear gradients, soft rim lighting, and gentle contact shadows.

### Core Proportions & Anchor (`256×256` viewBox)
- **Safe Zone:** All head, hair, face, and accessory geometry sits inside the central 80% circle (`r = 102` around `(128, 128)`) so circular crops never clip ears, headwear, or headphones.
- **Head Anchor:** Centered at `(128, 124)` with a slightly oversized, friendly rounded cranium (`rx ≈ 46, ry ≈ 52`).
- **Shoulders / Outfit:** Anchored below `y = 172` with rounded, soft-3D shaded collars/hoodies.
- **Facial Features:**
  - **Eyes:** Large, warm, expressive dark irises with a consistent top-left specular catchlight (`cx - 3, cy - 3`).
  - **Brows:** Rounded-cap strokes (`stroke-width: 4.5`) tuned to each calm expression (`smiling`, `relaxed`, `curious`, `sleepy-calm`, `focused`).
  - **Nose:** Minimalist soft shadow pill/curve centered at `(128, 134)`.
  - **Mouth:** Clean rounded-cap arc or gentle open smile centered at `(128, 150)`.

### Lighting & Shading Rules
- **Key Light:** Top-left (`35% 25%` radial highlight on skin and hair).
- **Turquoise Rim Light:** Subtle `#35CFC8` edge highlight on the right/top-right cheek and hair silhouette, tying every character into AURA's visual identity.
- **Contact Shadow:** Soft dark shadow under the chin onto the neck (`#070F0D` at low opacity).
- **Signature Halo Ring:** Behind every character sits a thin `#35CFC8` turquoise "aura" halo ring (`r = 106`) over a dark shell gradient (`#1F212C` → `#070F0D`), ensuring crisp separation on both dark and light themes.

### Palette Usage
- **Backgrounds & Outfits:** `#070F0D` (bg), `#1F212C` (shell), `#323848` (surface), `#454B5C` (border), `#35CFC8` (primary turquoise), `#438CCB` (blue), `#8974E8` (purple), `#F04460` (coral, tiny accents only), `#F4F5F7` (text).
- **Skin, Hair & Eyes:** Natural, varied range across deep, brown, olive, tan, and light tones, plus playful turquoise/purple hair streaks.

### Originality & Privacy Confirmation
- All 12 characters are **100% original** vector compositions created specifically for AURA.
- No character, mascot, or style from any external streaming, messaging, or entertainment brand is imitated or referenced.
- No real people, celebrities, logos, text, or embedded bitmaps are used.
- Avatar selection stays strictly on-device with zero external network requests.
