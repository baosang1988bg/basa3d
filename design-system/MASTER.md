# BaSa3D Design System — MASTER SPECIFICATION

> **Version**: 1.0.0  
> **Status**: Approved  
> **Aesthetic Archetype**: **Tactile Neo-Craft (Modern Maker Studio)**  
> **Source of Truth**: Aligned with ADR-0013 and `docs/exec-plans/active/phase-4.md`.

---

## 1. Brand Essence & Visual Archetype

BaSa3D is a modern 3D-printing studio bridging physical craftsmanship and digital precision.
- **Visual Personality**: Tactile, precise, approachable, authentic maker vibe.
- **Hero Principle**: The UI acts as a crisp, unobtrusive structural frame. Real 3D-printed product photography (layer textures, filament finishes, dimensional accuracy) remains the visual hero.
- **Tactile Details**: Subtle offset solid drop shadows (`shadow-tactile`) used strictly on high-intent CTAs and material badges to evoke physical depth without puffy decorative clutter.

---

## 2. Color System (Dual-Mode Calibrated Matrix)

All colors are calibrated for high legibility and strict **WCAG 2.1 AA** compliance (contrast ratio $\ge 4.5:1$ for normal text, $\ge 3:1$ for large text/icons).

### 2.1 Color Tokens Table

| Token Name | Role | Light Mode (Hex / OKLCH) | Dark Mode (Hex / OKLCH) | Contrast Ratio |
| :--- | :--- | :--- | :--- | :--- |
| `--background` | Page canvas | `#FAFAFA` (oklch 0.98 0 0) | `#0B1117` (oklch 0.14 0.01 240) | Base Canvas |
| `--foreground` | Default text & headings | `#0F172A` (oklch 0.15 0.02 260) | `#F8FAFC` (oklch 0.98 0.01 240) | $> 14:1$ on Canvas |
| `--card` | Card & container surface | `#FFFFFF` (oklch 1.0 0 0) | `#131C26` (oklch 0.19 0.02 240) | Elevation Surface |
| `--card-foreground` | Card body text | `#0F172A` (oklch 0.15 0.02 260) | `#F1F5F9` (oklch 0.96 0.01 240) | $> 13:1$ on Card |
| `--primary` | Brand Teal (Headings/Borders/Active) | `#0F766E` (oklch 0.51 0.10 185) | `#2DD4BF` (oklch 0.81 0.13 175) | $> 4.8:1$ (Light) / $> 9.5:1$ (Dark) |
| `--primary-foreground` | Text on Primary button | `#FFFFFF` (oklch 1.0 0 0) | `#042F2E` (oklch 0.22 0.06 185) | $> 4.8:1$ (Light) / $> 12:1$ (Dark) |
| `--accent` | Terracotta / Amber (CTAs/Buy Now) | `#D97706` (oklch 0.63 0.16 65) | `#F59E0B` (oklch 0.75 0.16 70) | Action Highlight |
| `--accent-foreground` | Text on CTA button | `#FFFFFF` (oklch 1.0 0 0) | `#0F172A` (oklch 0.15 0.02 260) | $> 4.5:1$ (Light) / $> 11:1$ (Dark) |
| `--secondary` | Subtle interactive surfaces | `#F1F5F9` (oklch 0.96 0.01 240) | `#1E293B` (oklch 0.25 0.02 240) | Low-emphasis chips |
| `--secondary-foreground`| Text on secondary | `#0F766E` (oklch 0.51 0.10 185) | `#E2E8F0` (oklch 0.91 0.01 240) | $> 5.2:1$ |
| `--muted` | Inactive backgrounds / table stripes | `#F1F5F9` (oklch 0.96 0.01 240) | `#1E293B` (oklch 0.25 0.02 240) | Neutral container |
| `--muted-foreground` | Subtitles, hints, metadata | `#64748B` (oklch 0.55 0.03 250) | `#94A3B8` (oklch 0.71 0.02 250) | $> 4.6:1$ |
| `--border` | Card, input & divider borders | `#E2E8F0` (oklch 0.92 0.01 240) | `rgba(255,255,255,0.10)` | Crisp 1px boundary |
| `--input` | Input field borders | `#CBD5E1` (oklch 0.86 0.02 250) | `rgba(255,255,255,0.15)` | Form focus base |
| `--ring` | Focus ring outline | `#0F766E` (oklch 0.51 0.10 185) | `#2DD4BF` (oklch 0.81 0.13 175) | a11y focus indicator |
| `--destructive` | Error / Alert / Cancel | `#DC2626` (oklch 0.57 0.22 25) | `#EF4444` (oklch 0.65 0.22 25) | High Alert |
| `--destructive-foreground`| Text on destructive button | `#FFFFFF` (oklch 1.0 0 0) | `#FFFFFF` (oklch 1.0 0 0) | $> 4.8:1$ |

### 2.2 Material Filament Swatch Tokens

Specialized semantic tokens for 3D printing material tags:

- **PLA Tag**: `bg-emerald-50 text-emerald-700 border-emerald-200` (Dark: `bg-emerald-950/50 text-emerald-300 border-emerald-800`)
- **PETG Tag**: `bg-sky-50 text-sky-700 border-sky-200` (Dark: `bg-sky-950/50 text-sky-300 border-sky-800`)
- **ABS Tag**: `bg-amber-50 text-amber-700 border-amber-200` (Dark: `bg-amber-950/50 text-amber-300 border-amber-800`)
- **Resin Tag**: `bg-purple-50 text-purple-700 border-purple-200` (Dark: `bg-purple-950/50 text-purple-300 border-purple-800`)
- **TPU / Flexible Tag**: `bg-rose-50 text-rose-700 border-rose-200` (Dark: `bg-rose-950/50 text-rose-300 border-rose-800`)

---

## 3. Typography System

Typography is loaded via `next/font/google` with full Vietnamese diacritics support.

### 3.1 Font Families
- **Display & Headings**: `Plus Jakarta Sans` (weights: 600, 700, 800) — Sturdy, geometric, modern industrial character.
- **Body & Data**: `Inter` (weights: 400, 500, 600) with `font-feature-settings: 'tnum'` for tabular numbers (prices, dimensions, infill %).
- **Mono / Technical Specs**: `JetBrains Mono` / `ui-monospace` (weight: 500) for G-code, dimensions, nozzle diameters.

### 3.2 Type Scale

| Level | Size | Line Height | Weight | Usage |
| :--- | :--- | :--- | :--- | :--- |
| **Display** | `2.5rem` (40px) / `3.25rem` (52px on desktop) | `1.15` | 800 | Hero title |
| **H1** | `2.0rem` (32px) / `2.5rem` (40px on desktop) | `1.2` | 700 | Page titles (`/products`, `/custom-print`) |
| **H2** | `1.5rem` (24px) / `1.875rem` (30px on desktop) | `1.25` | 700 | Section titles, feature headers |
| **H3** | `1.25rem` (20px) / `1.375rem` (22px on desktop) | `1.3` | 600 | Card titles, category headers |
| **H4** | `1.125rem` (18px) | `1.4` | 600 | Subsection headers, spec group headers |
| **Body Large** | `1.125rem` (18px) | `1.55` | 400 / 500 | Hero lead text, feature descriptions |
| **Body** | `1.0rem` (16px) | `1.5` | 400 / 500 | Default content, descriptions, inputs |
| **Body Small** | `0.875rem` (14px) | `1.45` | 400 / 500 | Specs, secondary text, metadata |
| **Caption** | `0.75rem` (12px) | `1.4` | 500 / 600 | Badges, tags, timestamps, legal copy |

---

## 4. Geometry, Elevation & Tactile Shadows

### 4.1 Border Radius Scale
- `rounded-sm`: `4px` (`calc(var(--radius) - 4px)`) — Badges, small pills, material color dots.
- `rounded-md`: `6px` (`calc(var(--radius) - 2px)`) — Form inputs, select dropdowns.
- `rounded-lg`: `10px` — Buttons, modal boxes.
- `rounded-xl`: `14px` (`var(--radius)`) — Product cards, feature containers.
- `rounded-2xl`: `20px` — Hero containers, promo banners.
- `rounded-full`: `9999px` — Status pills, avatar circles.

### 4.2 Elevation & Tactile Shadow Scale
- **Elevation 0 (Subtle)**: `border border-border bg-card` (Default card resting state).
- **Elevation 1 (Hover Card)**: `box-shadow: 0 4px 16px -2px rgba(15, 118, 110, 0.08), 0 2px 6px -1px rgba(0,0,0,0.04)` with `translate-y-[-2px]`.
- **Elevation 2 (Dropdown / Dialog)**: `box-shadow: 0 10px 30px -5px rgba(0, 0, 0, 0.15)`.
- **Tactile Offset Shadow (Primary CTA & Badges)**:
  - Class: `shadow-tactile`
  - CSS Light: `box-shadow: 3px 3px 0px 0px rgba(15, 118, 110, 0.9)` (or `#9A3412` for accent CTA).
  - CSS Dark: `box-shadow: 3px 3px 0px 0px rgba(45, 212, 191, 0.7)` (or `#D97706` for accent CTA).
  - Active State: `translate-x-[2px] translate-y-[2px] shadow-none`.

---

## 5. Core Component Tokens

### 5.1 Buttons
- **Primary CTA (Accent - Terracotta)**:
  - Light: `bg-[#D97706] text-white hover:bg-[#B45309] active:translate-y-[1px] shadow-tactile-accent font-semibold rounded-lg px-5 py-2.5`
  - Dark: `bg-[#F59E0B] text-[#0F172A] hover:bg-[#D97706] active:translate-y-[1px] shadow-tactile-accent font-semibold rounded-lg px-5 py-2.5`
- **Brand Action (Primary - Teal)**:
  - Light: `bg-[#0F766E] text-white hover:bg-[#115E59] active:translate-y-[1px] shadow-tactile-primary font-semibold rounded-lg px-5 py-2.5`
  - Dark: `bg-[#2DD4BF] text-[#042F2E] hover:bg-[#14B8A6] active:translate-y-[1px] shadow-tactile-primary font-semibold rounded-lg px-5 py-2.5`
- **Secondary / Outline**:
  - `border border-border bg-card hover:bg-secondary text-foreground rounded-lg px-4 py-2`

### 5.2 Product Card
- Container: `group relative rounded-xl border border-border bg-card p-4 transition-all duration-200 hover:shadow-md hover:border-primary/40`
- Image Frame: Aspect ratio 1:1 (`aspect-square`), `overflow-hidden rounded-lg bg-muted/50`, smooth zoom `group-hover:scale-105 transition-transform duration-300`.
- Price & Availability: Price in bold `text-lg font-bold text-foreground`, Stock status badge (`Sẵn hàng` green badge / `Đặt in 24h` blue-slate badge).

### 5.3 Technical Specifications Table (3D Print Details)
- Grid layout: 2 columns on mobile, 4 columns on desktop.
- Spec Pill: `bg-muted/60 border border-border/80 rounded-md p-2.5 text-center`
  - Label: `text-xs uppercase tracking-wider text-muted-foreground font-semibold`
  - Value: `text-sm font-bold text-foreground font-mono`

---

## 6. Accessibility & Motion Guidelines

1. **Focus State**: `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background`.
2. **Clickable Cursors**: Every interactive element MUST have `cursor-pointer`.
3. **Motion**: Standard micro-transitions `duration-150 ease-out` (hover, active).
4. **Reduced Motion**: Under `@media (prefers-reduced-motion: reduce)`, all transitions drop to `0ms` with zero translation transforms.
