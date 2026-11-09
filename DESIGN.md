---
name: Yo-Yo Event Management
description: Live-event production kit for yo-yo contests; a modular tournament broadcast kit on stream, a dark utility console at the table.
colors:
  gfx-navy: "#0c1a45"
  gfx-gold: "#f2c230"
  gfx-white: "#ffffff"
  op-ground: "#1a1a1a"
  op-panel: "#242424"
  op-hover: "#2c2c2c"
  op-border: "#333333"
  op-field-border: "#3a3a3a"
  op-raised: "#444444"
  op-text: "#eeeeee"
  op-muted: "#999999"
  op-blue: "#1565c0"
  op-green: "#2e7d32"
  op-red: "#c62828"
  op-amber: "#f9a825"
  op-focus: "#64b5f6"
  op-guide: "#ff4fd8"
  op-info-bg: "#12304d"
  op-info-text: "#cfe3ff"
  op-err-bg: "#7f1d1d"
  op-err-edge: "#ef5350"
  op-err-text: "#ffd6d6"
  op-warn-bg: "#4a3600"
  op-warn-text: "#ffd54f"
typography:
  gfx-display:
    fontFamily: "Saira, Arial Narrow, sans-serif"
    fontSize: "150px"
    fontWeight: 900
    lineHeight: 0.86
    letterSpacing: "-0.012em"
    fontVariation: "'wdth' 75"
  gfx-mark:
    fontFamily: "Saira, Arial Narrow, sans-serif"
    fontSize: "170px"
    fontWeight: 900
    lineHeight: 0.88
    letterSpacing: "-0.01em"
    fontVariation: "'wdth' 72"
  gfx-clock:
    fontFamily: "Saira, Arial Narrow, sans-serif"
    fontSize: "200px"
    fontWeight: 800
    lineHeight: 1.1
    fontVariation: "'wdth' 100"
  gfx-bar-event:
    fontFamily: "Saira, Arial Narrow, sans-serif"
    fontSize: "46px"
    fontWeight: 800
    letterSpacing: "-0.005em"
    fontVariation: "'wdth' 78"
  gfx-title:
    fontFamily: "Saira, Arial Narrow, sans-serif"
    fontSize: "32px"
    fontWeight: 600
    letterSpacing: "0.01em"
    fontVariation: "'wdth' 85"
  gfx-place:
    fontFamily: "Saira, Arial Narrow, sans-serif"
    fontSize: "30px"
    fontWeight: 600
    letterSpacing: "0.05em"
    fontVariation: "'wdth' 85"
  gfx-label:
    fontFamily: "Saira, Arial Narrow, sans-serif"
    fontSize: "30px"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "0.06em"
    fontVariation: "'wdth' 85"
  gfx-tag:
    fontFamily: "Saira, Arial Narrow, sans-serif"
    fontSize: "22px"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "0.08em"
    fontVariation: "'wdth' 85"
  op-headline:
    fontFamily: "-apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "20px"
    fontWeight: 800
  op-title:
    fontFamily: "-apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "18px"
    fontWeight: 700
  op-body:
    fontFamily: "-apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  op-label:
    fontFamily: "-apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "12px"
    fontWeight: 600
  op-readout:
    fontFamily: "Share Tech Mono, Consolas, monospace"
    fontSize: "56px"
    fontWeight: 400
    lineHeight: 1
    fontFeature: "tnum"
rounded:
  gfx-none: "0px"
  op-tag: "4px"
  op-control: "6px"
  op-row: "8px"
  op-panel: "10px"
  op-pill: "12px"
spacing:
  s1: "4px"
  s2: "8px"
  s3: "12px"
  s4: "16px"
  s5: "24px"
  s6: "32px"
  s7: "48px"
components:
  gfx-piece-logo:
    width: "700px"
    height: "520px"
  gfx-piece-headline:
    width: "920px"
    height: "300px"
  gfx-piece-countdown:
    width: "894px"
    height: "270px"
  gfx-piece-runofshow:
    width: "820px"
    height: "246px"
  gfx-piece-eventbar:
    width: "1144px"
    height: "104px"
  gfx-piece-sponsors:
    width: "924px"
    height: "104px"
  gfx-headline-panel:
    backgroundColor: "{colors.gfx-navy}"
    textColor: "{colors.gfx-white}"
    typography: "{typography.gfx-display}"
    rounded: "{rounded.gfx-none}"
    padding: "14px 44px 18px"
  gfx-mark-panel:
    backgroundColor: "{colors.gfx-navy}"
    textColor: "{colors.gfx-white}"
    typography: "{typography.gfx-mark}"
    rounded: "{rounded.gfx-none}"
    padding: "34px 46px 38px"
  gfx-plate-tab:
    backgroundColor: "{colors.gfx-gold}"
    textColor: "{colors.gfx-navy}"
    typography: "{typography.gfx-label}"
    rounded: "{rounded.gfx-none}"
    padding: "10px 30px 8px"
  gfx-plate-body:
    backgroundColor: "{colors.gfx-navy}"
    textColor: "{colors.gfx-white}"
    typography: "{typography.gfx-clock}"
    rounded: "{rounded.gfx-none}"
    height: "200px"
  gfx-tag-now:
    backgroundColor: "{colors.gfx-gold}"
    textColor: "{colors.gfx-navy}"
    typography: "{typography.gfx-tag}"
    rounded: "{rounded.gfx-none}"
    padding: "5px 16px 4px"
  gfx-tag-next:
    textColor: "{colors.gfx-gold}"
    typography: "{typography.gfx-tag}"
    rounded: "{rounded.gfx-none}"
    padding: "5px 16px 4px"
  gfx-run-row:
    backgroundColor: "{colors.gfx-navy}"
    textColor: "{colors.gfx-white}"
    typography: "{typography.gfx-title}"
    height: "54px"
    padding: "0 26px 0 30px"
  gfx-slab-event:
    backgroundColor: "{colors.gfx-gold}"
    textColor: "{colors.gfx-navy}"
    typography: "{typography.gfx-bar-event}"
    height: "104px"
    padding: "0 46px 0 110px"
  gfx-slab-place:
    backgroundColor: "{colors.gfx-navy}"
    textColor: "{colors.gfx-white}"
    typography: "{typography.gfx-place}"
    height: "104px"
    padding: "0 70px 0 40px"
  gfx-sponsor-strip:
    backgroundColor: "{colors.gfx-white}"
    height: "104px"
    padding: "0 60px"
  op-button-primary:
    backgroundColor: "{colors.op-blue}"
    textColor: "#ffffff"
    rounded: "{rounded.op-control}"
    padding: "8px 14px"
  op-button-grey:
    backgroundColor: "{colors.op-raised}"
    textColor: "#ffffff"
    rounded: "{rounded.op-control}"
    padding: "8px 14px"
  op-button-green:
    backgroundColor: "{colors.op-green}"
    textColor: "#ffffff"
    rounded: "{rounded.op-control}"
    padding: "8px 14px"
  op-button-red:
    backgroundColor: "{colors.op-red}"
    textColor: "#ffffff"
    rounded: "{rounded.op-control}"
    padding: "8px 14px"
  op-button-armed:
    backgroundColor: "{colors.op-red}"
    textColor: "#ffffff"
    rounded: "{rounded.op-control}"
    padding: "8px 14px"
  op-button-small:
    rounded: "{rounded.op-control}"
    padding: "5px 10px"
  op-input:
    backgroundColor: "{colors.op-ground}"
    textColor: "{colors.op-text}"
    rounded: "{rounded.op-control}"
    padding: "8px 10px"
  op-color-input:
    backgroundColor: "{colors.op-ground}"
    rounded: "{rounded.op-control}"
    width: "40px"
    height: "32px"
    padding: "2px"
  op-panel:
    backgroundColor: "{colors.op-panel}"
    rounded: "{rounded.op-panel}"
    padding: "{spacing.s4}"
  op-pill:
    backgroundColor: "{colors.op-raised}"
    textColor: "#dddddd"
    typography: "{typography.op-label}"
    rounded: "{rounded.op-pill}"
    padding: "4px 10px"
  op-pill-ok:
    backgroundColor: "{colors.op-green}"
    textColor: "#ffffff"
    rounded: "{rounded.op-pill}"
    padding: "4px 10px"
  op-pill-warn:
    backgroundColor: "{colors.op-amber}"
    textColor: "#000000"
    rounded: "{rounded.op-pill}"
    padding: "4px 10px"
  op-chip:
    backgroundColor: "{colors.op-border}"
    textColor: "#dddddd"
    rounded: "{rounded.op-control}"
    padding: "6px 10px"
  op-chip-pressed:
    backgroundColor: "{colors.op-blue}"
    textColor: "#ffffff"
    rounded: "{rounded.op-control}"
    padding: "6px 10px"
  op-banner-error:
    backgroundColor: "{colors.op-err-bg}"
    textColor: "{colors.op-err-text}"
    rounded: "{rounded.op-control}"
    padding: "10px 12px"
  op-banner-warn:
    backgroundColor: "{colors.op-warn-bg}"
    textColor: "{colors.op-warn-text}"
    rounded: "{rounded.op-control}"
    padding: "10px 12px"
  op-toast:
    backgroundColor: "{colors.op-info-bg}"
    textColor: "{colors.op-info-text}"
    rounded: "{rounded.op-row}"
    padding: "12px 14px"
  op-nav-link:
    textColor: "#bbbbbb"
    rounded: "{rounded.op-control}"
    padding: "5px 10px"
  op-nav-link-current:
    backgroundColor: "{colors.op-hover}"
    textColor: "#ffffff"
    rounded: "{rounded.op-control}"
    padding: "5px 10px"
---

# Design System: Yo-Yo Event Management

## Overview

**Creative North Star: "The Broadcast and the Booth"**

The product has two visual systems that never mix, because they face two different audiences. **On stream** (the broadcast graphics, `gfx.html`) the viewer sees a tournament broadcast kit played straight: six free-standing pieces (logo, headline, countdown, run of show, event bar, sponsors), each on its own parallelogram panel cut on one 12° angle, gold as the single live accent, heavy condensed Saira type, and the client's logo as the hero. The graphics draw no background at all; the ground is whatever the crew runs in OBS underneath. It is held to the standard of YCS and Pokémon Regional Championships streams, and it carries no trace of the operator's own brand. **At the table** (the operator pages: `score.html`, `music.html`, `broadcast.html`, `admin.html`, `index.html`, `timer.html`) the crew works in a dark, dense utility console: near-black ground, charcoal panels, system sans, Material-style role colours for state, and a monospace face wherever a clock or a number has to be read at a glance.

The broadcast world is a house kit, a frame for the client's identity rather than an identity of its own. Navy, gold, white and Saira are its defaults; the producer may override panel, accent and text colours and the font per piece, but nothing recolours itself for a client automatically. The client shows up through their logo, their sponsor logos, their event name, place and date. The operator world is quiet, flat and functional. It shouts only when something is wrong, with loud colour-coded banners and pills that always carry words as well as colour.

A third look exists and is deliberately outside both systems: the live score overlay (`overlay.html`) is a single user-styled bar (default Share Tech Mono, white on 72% black, uppercase, tabular numerals) whose font, size, colours and position are set from the music page. It stays as it is and is not part of the broadcast kit.

**Key Characteristics:**
- Two separate systems: the on-stream broadcast kit and the operator console. Tokens are prefixed `gfx-` and `op-` and never cross over.
- Broadcast: always transparent. No field, no glow, no chevrons, no grain; every piece carries its own panel and the background lives in OBS.
- Broadcast: six pieces with fixed native boxes, laid out as one 1920×1080 scene by the producer or used one at a time as DIY sources (`?piece=`).
- Broadcast: one 12° angle for every edge, parallelograms instead of boxes, gold (by default) used sparingly as the live signal.
- Broadcast: navy / gold / white and Saira are defaults the producer may override per piece; never recoloured automatically per client.
- Operator: dark, flat, dense; a 4px spacing scale (`--s1`..`--s7`); state always shown in words plus colour.
- Operator: Share Tech Mono for every clock and number readout, system sans for everything else.

## Colors

The broadcast kit runs on three per-piece colours (panel, accent, text) defaulting to navy, gold and white, plus shades derived from them; the operator palette is neutral charcoal with Material role colours for state.

### Primary
- **Championship Gold** (gfx-gold): the default accent on stream, the one live signal. It fills the countdown label tab and the NOW tag, outlines the NEXT tag, colours the run-of-show times, fills the event-name slab, the place/date "/" separator, the double edge beside the clock plate, the "Any moment now" text at zero, and the underline bar under the no-logo event name.
- **Console Blue** (op-blue): the operator primary. Default button fill, the current-page underline in the header nav, the toast border, the info banner border, the NEXT tag on the producer's run of show, the pressed piece chip and the selected piece's name tag in the scene editor, checkbox accent, and text selection on the Broadcast page.

### Secondary
- **Go Green** (op-green): the success and live-safe role: green buttons, `pill-ok`, the active badge, and the NOW tag and NOW row border on the producer's run of show (row tint #17301a).
- **Stop Red** (op-red): destructive buttons, armed two-click confirm buttons, the LIVE "on air" badge, `pill-bad` on the scoring page.
- **Caution Amber** (op-amber): `pill-warn` (with black text), and the 1px edge of warning and offline banners.
- **Snap Magenta** (op-guide): the 1px snap guides in the Broadcast page's scene editor, shown only while a dragged piece is snapped. A tooling colour, chosen to read against any OBS background; never used for content.

### Neutral
- **Panel Navy** (gfx-navy): the default panel of every piece except sponsors: the headline and no-logo name panels (at 90% opacity), the clock plate, run-of-show rows (at 90%), and the place-and-date band. Also the default text colour on the accent.
- **Broadcast White** (gfx-white): the default text colour on stream, and the default panel of the sponsor strip (sponsor logos sit on white so any logo reads).
- **Derived shades (per piece, computed in JS, not tokens).** From each piece's panel, accent and text, `gfx.html` computes: **panel-hi** (panel mixed 6% toward white, or toward black on a light panel; the top of the clock plate gradient), **panel-now** (the same mix at 20%; the NOW row), **panel-a** (the panel at 90% alpha; headline and mark panels, run-of-show rows), **on-accent** (the panel colour when its luminance differs from the accent by more than .3, otherwise black or white by the accent's luminance; text on the tab, NOW tag and event slab), and **ink-soft** (text mixed 22% toward the panel; the date in the event bar). With the defaults these resolve to #1b2850, #3d486a, rgba(12, 26, 69, .9), navy, and #cacdd6. Mixing is done in JS because OBS ships an older Chromium without `color-mix()`.
- **Booth Ground** (op-ground): page background, sticky header background, input and colour-input fill, and counters/code wells inside panels.
- **Booth Panel** (op-panel): panels, cards, run-of-show and competitor rows.
- **Hover Charcoal** (op-hover): nav-link hover and current state.
- **Hairline** (op-border, op-field-border): row and card borders and the inspector's top rule (#333; also the unpressed chip fill), input borders (#3a3a3a); the header divider is #2a2a2a.
- **Raised Grey** (op-raised): grey buttons, neutral pills and badges, disabled buttons (with #888 text).
- **Console Text** (op-text, op-muted): primary text #eee; hints, meta and muted labels #999 (labels #aaa, section titles #ccc).
- **Focus Sky** (op-focus): the 2px focus outline (offset 2px) on every interactive element, the 2px border of the selected piece box and its corner grip in the scene editor, and link-style accents on the landing page.
- **Banner and toast fills**: info (op-info-bg / op-info-text), error (op-err-bg, op-err-edge, op-err-text), warning (op-warn-bg / op-warn-text). The warning text yellow #ffd54f also marks a countdown at zero and a low stage timer; #ef9a9a is inline error text.

### Named Rules
**The Default Palette Rule.** Navy panel, gold accent and white text (white panel for sponsors) are the kit's defaults, not a lock. The producer may override panel, accent and text per piece, and every derived shade follows from those three. Nothing recolours itself per client: no automatic brand extraction, no client-colour theming. Client identity still enters as their logo, sponsor logos, event name, place and date. No yo-yo imagery, no operator branding.

**The One Accent Rule.** Each piece has one accent and it always means "this is the live signal": the clock label and double edge, NOW/NEXT, the run-of-show times, the event slab. Do not use it for decoration elsewhere.

**The Words-And-Colour Rule.** On operator pages, state is never colour alone: every pill, banner, badge, tag and chip carries a word (Connected, Saving on this device, NOW, NEXT, LIVE, hidden).

## Typography

**Broadcast Font:** Saira (with Arial Narrow, sans-serif) by default, self-hosted from `/fonts/saira-latin.woff2`: variable weight 400–900 and width 50–125%, `font-display: block`, preloaded. Per piece the producer may pick instead Barlow Condensed, Roboto Condensed, Oswald, Teko, Rajdhani, Chakra Petch, Exo 2, Anton, Bebas Neue or Russo One; a picked face loads from Google Fonts only when used (`display=block`), with Saira as its fallback, and the piece refits once it arrives.
**Operator Font:** system sans (-apple-system, Segoe UI, Roboto, sans-serif).
**Readout Font:** Share Tech Mono (with Consolas, monospace) from Google Fonts, operator pages only. Codes and links use plain Consolas.

**Character:** On stream, one variable family does the work by changing width: heavy and condensed for display (72–75%), semi-condensed for text (78–90%), full width only for the clock digits. The alternative faces are all broadcast-condensed or sport display faces, so a producer's swap stays in the same register. At the table, the system face stays out of the way and the mono face makes numbers steady and scannable.

### Hierarchy: broadcast (stage pixels; each piece fits its words inside its own box)
- **Display** (900, 150px, line-height .86, width 75%, uppercase, -.012em): the headline (default "Starting soon"). It tries one line first, stepping from 150px down to 112px in 4px steps; if it still does not fit, it wraps and steps down from 150px until it fits the 268px-tall box.
- **Mark** (900, width 72%, line-height .88, -.01em, uppercase): the event name standing in for a missing logo. Fitted from 170px down in 6px steps until the words fit the 700×520 box (measured on the words, inside the panel padding).
- **Clock** (800, 200px, line-height 1.1, width 100%): countdown digits, each in a fixed slot (.6em per digit, .3em for the colon) so nothing shifts as numbers change. At zero it becomes "Any moment now" (900, 100px, width 75%, accent).
- **Bar Event** (800, 46px, width 78%, uppercase, -.005em): the event name on the accent slab; shrinks in 2px steps to 32px, then wraps to two lines (line-height .95) from 38px down to 22px.
- **Title** (600, 32px, width 85%, uppercase, .01em): run-of-show segment titles; shrink to 26px, then narrow to width 72%, then take two lines at 24px (line-height 1, clamped to two).
- **Row Time** (700, 30px, width 90%, accent, tabular numerals): run-of-show times.
- **Place** (600, 30px, width 85%, uppercase, .05em): the place in the text colour at 700, the date in ink-soft, an accent "/" between. Place and date shrink together as one unit, 30px down to 18px.
- **Label** (800, 30px, width 85%, uppercase, .06em): the clock plate tab (producer-set, default "Show starts in"); steps down to 18px to stay within 760px.
- **Tag** (800, 22px, width 85%, uppercase, .08em): NOW / NEXT.

### Hierarchy: operator
- **Readout** (Share Tech Mono 400, tabular numerals): countdown 56px on Broadcast (44px under 600px), deck timer 44px on Music, counters 34px on Judging, stage timer `min(36vw, 62vh)` on the timer display; also row numbers, time inputs, durations, and the scene inspector's number fields.
- **Headline** (800, 20–26px): section heads such as Run of show and the scene head (20px); the inspector's piece name (16px); the landing page's event title (26px) and lead (22px).
- **Title** (700, 18px): the event name in the sticky header; event names on admin cards (17px).
- **Body** (400, 14px, line-height 1.5): controls, inputs, banners, toast; buttons 600 at 14px (13px small and chips).
- **Label** (600, 12–13px): field labels 12px #aaa, pills 12px, nav links 13px, section titles 14px #ccc, the page identity line 13px #aaa; piece-box name tags 11px/700.
- **Tag** (700, 11px, uppercase, .5px tracking): run-of-show and running-order tags; the on-air badge is 12px/800 at .06em.

### Named Rules
**The Width Not Weight Rule.** On stream, fit long text by stepping size down to a floor and narrowing width, then a second line; never by switching family mid-piece, adding a second face, or letting text overflow its piece's box.

**The Mono Readout Rule.** Every clock, timer and score number on the operator pages is Share Tech Mono with tabular numerals. Nothing else uses it.

## Layout

**Broadcast: six pieces, two ways to use them.** Each piece has a fixed native box (which already includes its own slant and edges), a default place on the 1920×1080 scene, and an entrance delay:

| Piece | Native box | Default place (x, y) | Delay |
|---|---|---|---|
| logo | 700×520 | 110, 210 | .05s |
| headline | 920×300 | 1000, 100 | .14s |
| countdown | 894×270 | 960, 380 | .26s |
| run of show | 820×246 | 1020, 654 | .38s |
| event bar | 1144×104 | −72, 940 (bleeds off the left) | .18s |
| sponsors | 924×104 | 1068, 940 (bleeds off the right) | .30s |

As a **full scene** (`/gfx/<key>`), the producer places each piece on the 1920×1080 stage (position, scale 20–300%, show/hide, layer) and the stage is scaled by `min(width/1920, height/1080)` and centred, so the OBS Browser Source and the editor preview render the same frame. As a **DIY source** (`?piece=<name>`), one piece renders alone at its native size, top-left, scaled to the window; the crew sizes the OBS source to the native box. The background is never part of either: it lives in OBS.

**Layer order.** Each piece carries a layer value `z` (−20 to 20, default 0) rendered as z-index 100 + z; the editor's Bring to front / Send to back set it one past the current extreme.

Run of show shows the segment on now and the next three (up to four rows, 54px tall, 10px apart, columns 96px / flexible / tag). Sponsors show four at a time and rotate in groups every 10s with a .5s fade; each logo is 58px tall, width-capped so the group fits the strip. Missing parts close up: no title hides the event slab, no sponsors hides the strip, no countdown hides the plate, and with no logo the event name stands in.

**Operator.** Single-column pages up to 1400px wide (`index.html` 720px, `admin.html` 1000px) with 16px side padding. A sticky header carries the page identity, event name, page links and connection pills, with banners pinned beneath it. Spacing comes from a 4px scale (s1 4 to s7 48): tight within a group (s1–s3), generous between sections (s5–s6). The Broadcast page is a two-column grid (main + 360px side) that stacks under 900px; the scene canvas is the first thing in the main column with the chips and inspector under it; the countdown deck stacks under 1100px; rows reflow under 600px. Other breakpoints: 900/600 on Music, 520 on Judging and the landing page.

## Elevation & Depth

**Broadcast** draws no ground and no glow; depth comes from each piece's own panel lifting off whatever OBS shows beneath it. Shadows are soft and ambient only. When the producer switches a panel off, the words take a soft text shadow instead so they still read over video.

**Operator** pages are flat and tonal: ground #1a1a1a, panels #242424, wells back at #1a1a1a. The only shadow is on the floating toast.

### Shadow Vocabulary
- **Panel lift** (`box-shadow: 0 24px 50px rgba(0, 0, 0, .35)`): under the clock plate, the headline panel and the no-logo name panel.
- **Logo lift** (`filter: drop-shadow(0 18px 40px rgba(0, 0, 0, .45))`): under the client logo.
- **No-panel legibility** (`text-shadow: 0 6px 30px rgba(0, 0, 0, .45)`; .5 on the event name): headline and no-logo name when their panel is off.
- **Toast float** (`box-shadow: 0 6px 20px rgba(0, 0, 0, 0.45)`): the operator toast only.

### Named Rules
**The Transparent Ground Rule.** The graphics never paint a background: no field, plane, glow, chevrons, sweep or grain. Every piece carries its own panel, so it reads on any background the crew runs in OBS, and on its own as a DIY source.

**The Flat Console Rule.** Operator surfaces are flat; depth is tone (#1a1a1a, #242424, #2c2c2c), never shadow, except the toast.

## Shapes

**Broadcast: everything on the 12° angle.** `--skew: -12deg` sets every edge on stream. Panels (headline and name panels, clock plate, label tab, run-of-show rows, NOW/NEXT tags, event slab, place band, sponsor strip) are parallelograms built with `skewX(-12deg)` on the box and `skewX(12deg)` on its content so text stays upright. Each piece's entrance wipe is clipped along the same slope, with a slant of the piece's height × tan 12° (.2126). Corners are square; there are no rounded radii on stream. The countdown carries the **double edge**: a 6px accent stripe 30px left of the plate with a 2px stripe at 45% opacity 16px further out, both skewed. The no-logo name ends in a skewed 220×16 accent bar, 34px below the words.

**Panels are switchable where words stand alone.** The headline and the no-logo event name sit on a 12° parallelogram panel (panel-a, with the panel lift) that the producer can switch off (`plate`); the other pieces' panels are structural and always on.

**Operator: soft rectangles.** Tags 4px, controls, chips and banners 6px, rows and toast 8px, panels and cards 10px, pills 12px. Borders are 1px hairlines; status dots are circles.

## Components

### Broadcast motion (signature)
- **Per-piece wipe along the angle:** taking the scene to air wipes each piece in along the 12° slope (clip-path .85s on `cubic-bezier(.16, 1, .3, 1)`, opacity .3s ease-out), each after its own delay: logo .05s, headline .14s, event bar .18s, countdown .26s, sponsors .30s, run of show .38s. A DIY piece enters with no delay.
- **Off air:** each piece wipes back out faster with ease-in (clip-path and opacity .35s, `cubic-bezier(.7, 0, .84, 0)`).
- **Digit roll:** only the digits that change roll, the new one in from below (.42s), the old one out upward (.32s). The slots rebuild only when the shape changes (MM:SS and H:MM:SS).
- **Editor preview:** the preview renders the scene statically (no transitions) so dragging is immediate.
- **Reduced motion:** digit rolls collapse to .01s.

### Broadcast pieces
- **Logo:** the client logo, up to 700×520, with the logo lift. With no logo, the event name in Mark type on its switchable panel, with the accent underline bar.
- **Headline:** the producer's line (default "Starting soon") in Display type on its switchable panel (14px 44px 18px padding).
- **Countdown:** accent label tab (on-accent text) overlapping a 200px panel parallelogram (gradient panel-hi to panel) with the panel lift and the double edge at its left. The tab hides at zero.
- **Run of show:** rows on panel-a; the NOW row on panel-now with a solid accent NOW tag; the next row gets an accent-outlined NEXT tag (2px inset).
- **Event bar:** accent event slab (padding 0 46px 0 110px, so the slab reads from under the left edge) and a panel band for place and date (flexes, minimum 440px).
- **Sponsors:** a 104px strip on the sponsor panel (white by default), logos centred with 40px gaps.

### Buttons (operator)
- **Shape:** gently rounded (6px), no border, 600 weight, inline-flex with a 6px gap for a 16px stroke icon.
- **Primary:** Console Blue, white text, 8px 14px. The Take button is larger (12px 22px, 16px).
- **Variants:** grey (#444), green, red, small (5px 10px, 13px), and a 32×32 icon button on #333.
- **Hover / Active / Focus:** brightness 1.15 on hover, .9 on press; 2px Focus Sky outline offset 2px. Disabled: #444 fill, #888 text.
- **Two-click confirm:** destructive actions arm on the first click (the button turns red and its label says what will happen) and fire on the second. Used on Judging, Music and Broadcast (including Reset this piece).

### Pills, tags and badges
- **Pills** (12px radius, 12px/600): neutral #444, ok green, warn amber with black text; connection state in the header.
- **Tags** (4px radius, 11px uppercase): done grey, NOW green, NEXT blue on the producer's run of show; the on-air badge turns red with "LIVE".

### Banners and toast
- **Banners** sit under the sticky header, 6px radius, 14px/600: error (dark red fill, red edge), warning/offline (dark amber fill, amber edge, yellow text), info (dark blue, blue edge, 400 weight).
- **Toast:** one informational notice at a time, fixed bottom-right, max 420px, dark blue with blue edge, fades and drops 8px when gone. Info goes to the toast so the deck never moves; problems go to banners.

### Inputs / Fields
- **Style:** Booth Ground fill, 1px #3a3a3a border, 6px radius, 8px 10px, 14px; labels above at 12px #aaa; placeholders #8f8f8f. Selects match.
- **Colour inputs:** 40×32 swatch, 2px padding, same fill, border and radius, each followed by a small grey **Default** button that clears the override and is disabled while the default is in use.
- **Focus:** 2px Focus Sky outline, offset 2px. Time and number inputs use the mono face, centred (the inspector's number fields are 92px wide).

### Navigation
- **Header nav:** links to All pages, Judging, Music, Broadcast and Timer display, 13px/600 #bbb, 5px 10px, 6px radius. Hover and current fill #2c2c2c with white text; the current page is marked with `aria-current="page"` and a 2px Console Blue underline (inset shadow). Present on Judging, Music and Broadcast.

### Scene editor (Broadcast page)
The live preview is the layout editor.
- **Canvas:** a 16:9 frame (6px radius) on a transparency checkerboard (#2b2b2b / #212121, 18px), because the graphics never draw a background. The preview iframe (`?preview=1`) always shows the scene and takes no pointer events; an overlay of piece boxes sits on top.
- **Piece boxes:** each piece's native box at its place and scale, 1px dashed white at 40% (80% on hover); a hidden piece's box dims to 25% with a 35% black wash. The selected box takes a 2px Focus Sky border and a 14×14 Focus Sky corner grip (2px #12304d border, 2px radius) for resizing; keyboard focus adds a 3px Focus Sky ring at 50%.
- **Labels on demand:** a box's name tag (11px/700, #ddd on 82% black; Console Blue with white text when selected) appears only on hover or selection; under 700px of canvas only the selected piece is named.
- **Snapping:** a dragged box snaps its edges and centre to the scene edges, the centre lines and the other visible pieces within 13 stage px, showing a 1px Snap Magenta guide per axis; Shift places freely. Arrow keys nudge 1px (Shift 10px).
- **Piece chips:** a toolbar of one chip per piece (#333, #ddd, 6px 10px, 13px); the selected chip is `aria-pressed="true"` in Console Blue; a hidden piece says "· hidden" in muted text.
- **Inspector:** under the chips, behind a #333 top rule: the piece name and Show on the scene; Left, Top and Size (%) number fields and a Font select (Saira (default) first); a colour input with Default button for each colour that piece uses (sponsors: panel only; headline: panel and text); the panel checkbox where a panel is switchable; the DIY link with its native size and Copy link; Bring to front, Send to back, and Reset this piece.

## Do's and Don'ts

### Do:
- **Do** keep every broadcast edge on the one 12° angle (`--skew: -12deg`), skewing panels and counter-skewing their content.
- **Do** give every on-stream piece its own panel and keep the graphics transparent; the background belongs to OBS.
- **Do** keep each piece inside its fixed native box so it works both in the producer's scene and as a DIY source.
- **Do** take broadcast colour from each piece's panel, accent and text (navy, gold and white by default; sponsors on white) and the shades derived from them, and keep the accent for the live signal.
- **Do** wipe new pieces in along the 12° angle with their own stagger delay.
- **Do** let the client's logo, sponsor logos, event name, place and date carry all client identity.
- **Do** fit long broadcast text by stepping size down to a floor and narrowing width, then a second line.
- **Do** build operator pages from the shared base: #1a1a1a ground, #242424 panels, the `--s1`..`--s7` scale, 6px controls, 10px panels.
- **Do** put every operator clock and number readout in Share Tech Mono with tabular numerals.
- **Do** pair every state colour with a word, and use the two-click confirm for destructive actions.
- **Do** mark the current page in the header nav with `aria-current="page"` and the selected piece chip with `aria-pressed`.

### Don't:
- **Don't** paint a background, field, glow, chevrons, sweep or grain into the graphics.
- **Don't** recolour the broadcast kit automatically for a client, or add yo-yo imagery or operator branding to it.
- **Don't** add glowing type or rounded corners on stream.
- **Don't** load Saira from a CDN; it is served by this server so the stream never waits on it. Only a producer-picked alternative face loads from Google Fonts.
- **Don't** bring operator styles (system sans, Material role colours, rounded pills) onto stream, or broadcast styles (Saira, skew, gold) into operator pages.
- **Don't** fold the score overlay into the broadcast kit; it is user-styled from the music page and stays as it is.
- **Don't** use shadows for depth on operator pages; the toast is the only floating element.
- **Don't** signal state with colour alone.
