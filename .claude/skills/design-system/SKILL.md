---
name: design-system
description: Follow the Trip Expenses design system when building or changing UI. Use when creating screens, lists, forms, badges, buttons, empty states, headings, charts, or status indicators, when choosing colors, Tailwind classes, or copy, or when the user mentions design system, UI patterns, visual consistency, typography, brand, or UX canon.
---

# Trip Expenses Design System

Trip Expenses looks like a desktop instrument: a warm near-black canvas, dense mono-labelled chrome, one amber accent, and numbers that always line up. Tokens live in the `@theme` block of `apps/web/app/ui/styles.css` (Tailwind CSS v4 — the CLI compiles it to `public/styles.css`); every screen speaks in those token-backed utility classes (`bg-panel`, `text-muted`, `border-line`) instead of raw hex values. When a screen disagrees with this file, the screen is wrong.

## Palette (`@theme` in styles.css)

| Token | Value | Role |
|---|---|---|
| `canvas` | `#0B0A08` | Page backdrop — the deepest well |
| `chrome` | `#121009` | App chrome: the sticky top bar |
| `panel` | `#18150E` | Panels, cards, list containers, skeletons |
| `raised` | `#211D14` | Hover states, active tab fill, avatar backgrounds |
| `ink` / `muted` / `faint` | `#F0EDE6` / `#A49C8C` / `#6F6A5E` | Body text / secondary text / labels and hints |
| `line` / `line-bright` | 9% / 20% alpha ink | Hairlines: `line` for panel edges, `line-bright` for interactive borders |
| `amber` | `#FFB03A` | THE accent: primary actions, active tab, selection, totals, focus |
| `amber-bright` / `amber-wash` | `#FFC669` / 13%-alpha amber | Hover accents / selected fills (picked emoji, chosen member chip) |
| `green` / `green-wash` | `#3DD68C` / 12% alpha | **Credit only**: positive balances, "all settled up", record-payment actions |
| `red` / `red-wash` | `#FF6B5C` / 12% alpha | **Debt and destruction only**: negative balances, errors, delete buttons |
| `sky` | `#58A6FF` | Reserved cool accent — links in running text if ever needed |
| `chart-paid` / `chart-share` | `#C6821F` / `#4C92E6` | The chart series pair: what a member paid vs their share. Validated for color-vision deficiency against `panel` — never substitute other hues |
| `violet` / `rose` / `teal` | `#B18AFF` / `#FF7AB6` / `#2EC9B8` | Categorical spares for future data series |

One accent, everywhere: interface intent (act, select, focus) is always amber. Green and red are **strictly semantic** — green means someone is owed, red means someone owes (or something failed/destroys). Never use them decoratively, never use amber for a balance, and never encode credit/debt in any other pair.

## Surfaces: dark only

There are no light surfaces and no theme toggle. Every screen sits on `canvas`; structure comes from panel steps (`chrome` → `panel` → `raised`) and hairlines, not from background swaps. The standing panel idiom is `rounded-2xl border border-line bg-panel` — cards, empty states, the scanner frame, and loading skeletons all use it. Interactive sub-surfaces step up to `raised`. The one white thing in the product is the QR code plate (`bg-white rounded-2xl p-3`) — scanners need the contrast; nothing else may be white.

## Typography

Two self-hosted variable families (`@font-face` in styles.css, files in `public/fonts/`) — never a third:

- **`font-sans`** (Inter Variable) for prose, headings, names, and amounts in running text. Headings are tight and bold: `text-[22px] font-bold tracking-tight` for page h1, `text-[19px]` for section h2, body 13–15px.
- **`font-mono`** (JetBrains Mono Variable) for chrome text, via two custom utilities:
  - `mono-label` — 10px/700, 0.14em tracking, uppercase. Buttons, tabs, section labels, badges, nav chips.
  - `mono-caption` — 11px, 0.08em tracking. Metadata lines, hints, helper copy, error notes.

Money and counts are measured values: render them with the `tabular` utility (`font-variant-numeric: tabular-nums`) so columns align — `<span class="tabular text-amber">{formatCents(...)}</span>` is the canonical total. If it is a number the product computed, it is tabular; no exceptions.

## App chrome

`AppShell` (`app/ui/app-shell.tsx`) is the frame every page lives in: a sticky 52px top bar (`border-b border-line bg-chrome/90 backdrop-blur`) holding the wordmark (`app/ui/brand.tsx` — amber dotted trail, ink plane) and the mono `Scan` chip, over a centered `max-w-3xl` content column. Trip pages open with `TripChrome` (`app/assets/trip-chrome.tsx`): back link, emoji plate + trip name + amber total, invite button, and a 4-tab segmented nav (`bg-panel p-1`, active tab `bg-raised text-amber`, `aria-current="page"`).

## Component idioms

The shared constants and widgets live in `app/assets/widgets.tsx` — use them, never re-derive their class strings:

- **`buttonPrimary`** — mono-label, `bg-amber text-canvas`, rounded-lg. **One amber primary per screen.**
- **`buttonGhost`** — mono-label, `border-line-bright text-muted`, hover `border-amber text-ink`. Everything secondary.
- **`buttonDanger`** — mono-label, `border-red/40 text-red`, hover `bg-red-wash`. Destructive actions only.
- **`inputClass`** — the text-input recipe: `bg-panel`, `border-line-bright`, focus `border-amber`, `placeholder:text-faint`. Inputs are uncontrolled: `defaultValue` + `on('input')`, never a controlled `value`.
- **`Avatar`** — people are **emoji avatars**: a rounded-full `bg-raised border-line-bright` plate holding the member's emoji (`sm`/`md`/`lg`). Trips get square plates (`rounded-2xl`) with the trip emoji. Never initials, never images.
- **`BottomBar`** — the home of every screen's primary action: a fixed full-width bar at the bottom of the viewport (border-t hairline over a `bg-chrome/90` blur, gradient fade above, safe-area bottom padding), its buttons stretching across the centered `max-w-3xl` column. One amber primary per screen still applies; a destructive sibling (edit form's delete) sits beside it as `buttonDanger`.
- **`SectionLabel`** — `mono-label text-faint`, the heading for every form section and list group.
- **`ErrorNote`** — `mono-caption` in a `border-red/40 bg-red-wash` pill; render mutation error messages through it, nothing custom.
- **`EmojiPicker`** — an emoji tile button (`h-11 w-11`, square for trips/categories, `shape="circle"` for people) that opens an anchored popover (`remix/ui/popover`): a 6-column emoji grid, or emoji+label rows when options carry labels (the category picker). Selection state is `border-amber bg-amber-wash` with `aria-pressed`; the same selected-chip pattern applies to any pick-one row (member chips on the invite screen).

**Lists** are hairline-separated rows inside one panel, not card grids. **Empty states** are a panel with generous padding (`px-6 py-14 text-center`), an emoji or short headline, a `mono-caption text-muted` explanation, and at most one action. **Loading** is pulsing panel-shaped skeletons (`animate-pulse rounded-2xl bg-panel`) — every screen renders the skeleton until `bindDocument` reports ready, identically on server and first client render.

## Charts

Chart bars are plain divs on token colors — no chart library. The series pair is fixed: `chart-paid` (burnt amber) for what a member paid, `chart-share` (blue) for their share, with a dot legend naming both. The pair is CVD-validated against `panel`; if a new series family appears, draw from `violet`/`rose`/`teal` and validate contrast and CVD before shipping. Balance bars reuse the semantic pair: green fill for credit, red for debt.

## Voice and language

- The product speaks Brazilian Portuguese (pt-BR), lowercase-calm and human: "Compartilhe esta viagem", "Peça para abrirem a viagem e tocarem no botão de QR", "Tudo acertado". Code identifiers and routes stay in English.
- Tone: direct and concrete, a friend doing the math — no hype, no exclamation marks. States describe facts ("Camera unavailable"), never scold.
- Money is always formatted through `formatCents` with the trip's currency; days through `formatDay` (see the `formatting-datetimes` skill).
- Pluralize properly ("1 person", "3 people") — never "person(s)".
- Domain words: a **trip** has **people** (members in code) and **expenses**; paying a debt is **settling up**; the QR flow is **invite** (showing) and **scan** (joining).

## Accessibility floors

- Contrast: body text ≥ 4.5:1, mono labels ≥ 3:1 against their surface. `muted` clears 4.5:1 on `canvas` and `panel`; `faint` is for 10–11px mono labels only — never body copy.
- Keyboard focus is always visible — interactive elements get an amber outline (`outline-amber` / focus classes), never `outline-none` without a replacement.
- Touch targets ≥ 44px tall on primary controls; the 36px emoji-picker cells are compact-grid affordances with generous spacing.
- Icon-only links carry visually-hidden text (`sr-only`), decorative SVGs are `aria-hidden`, toggle chips carry `aria-pressed`, the active tab `aria-current="page"`.
- Never encode state by color alone: balances pair the green/red number with "gets back"/"owes" copy, errors are sentences in `ErrorNote`, the selected chip changes border and fill together.
