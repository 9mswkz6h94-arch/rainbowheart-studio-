# Stick Notation Engine — How It Works

_Last updated: 2026-07-16. This document is the source of truth for the stick-notation
rendering pipeline in Master Copy Studio. Share it with any chat/session working on
notation rendering, printing, or the `notation` field._

## TL;DR

Stick notation is drawn as **one `<svg>` per visual line ("system")**, using an explicit
coordinate system computed from note durations. This replaced an older approach that laid
each note out as its own flex-scaled SVG, which caused two bugs: **beams didn't connect**
across notes, and **long songs clipped / wouldn't print**. Both are fixed.

The pipeline has three stages, each in its own file:

```
raw text ──▶ parseStickNotation() ──▶ layoutSystem() ──▶ <svg> per system
             src/lib/stickParser.ts    src/lib/stickLayout.ts   DocumentPreview.tsx
             (text → measures/beats)    (measures → x/y coords)  (coords → SVG)
```

- **`src/lib/stickParser.ts`** — pure. Text → `measures[]` of `beats[]`. Handles rhythm,
  solfège, lyrics, barlines, repeats, pickups, auto/explicit barring, beaming groups,
  and (new) syllable **hyphen** flags. Also contains `stickToABC()` for staff mode.
- **`src/lib/stickLayout.ts`** — pure, no DOM/React. Groups measures into systems and
  assigns every note an absolute `x`. Owns all geometry constants. Unit-testable.
- **`src/components/DocumentPreview.tsx`** — React. Turns a laid-out system into SVG
  elements (stems, beams, noteheads, flags, rests, barlines, solfège, lyrics, hyphens).

**Do not reintroduce per-note SVGs or flex-based musical spacing.** The whole point of the
redesign is that one system = one coordinate space.

## The input format (unchanged — teachers already use this)

Notation is entered as blocks separated by blank lines. Each block is up to 3 lines:

```
8 8 4            ← line 1: rhythm tokens
s s m            ← line 2: solfège tokens
_Ap_ple _tree,   ← line 3: lyrics, one syllable per note
```

- **Rhythm:** `1` whole, `2` half, `4` quarter, `8` eighth, `16` sixteenth. Add `.` for
  dotted (`4.`). Prefix `z` for a rest (`z`, `z8`, `z2`).
- **Barlines** (in the rhythm line): `|` bar, `||` double, `|]` final, `|:` / `:|` repeats.
  Typing **any** barline switches the whole song to _explicit_ barring (you bar it
  yourself — this is how pickups work: a short first measure). With no barlines, measures
  are auto-calculated from the time signature.
- **Line break:** `//` in the rhythm line forces a new system at that point.
- **Lyrics:** each syllable is prefixed with `_` and aligns to the note at the same index.

### Syllable hyphens (added 2026-07-16, professor request)

When a word is split into syllables across notes, the syllables are joined by a hyphen;
separate words are not. The signal is **already in the input** — it's the spacing:

| Input          | Meaning                        | Renders |
|----------------|--------------------------------|---------|
| `_Ap_ple`      | no space between → same word   | `Ap-ple` |
| `_ple _tree`   | space before the `_` → new word| `ple  tree` (no hyphen) |

**Implementation:** the parser must NOT `.trim()` away the trailing-space signal before
reading it. `parseStickNotation` computes a `hyphenAfter: boolean` on each beat:

> a syllable joins the next with a hyphen when its raw token is non-empty, does **not**
> end in whitespace, and a non-empty next syllable exists.

The renderer draws a `-` centered at the x-midpoint between the two notes, on the lyric
baseline, **only when both notes are in the same system** (never dangling at a line break).
Because blocks are separated by blank lines, hyphens never cross between blocks.

### Melisma extension lines (added 2026-07-16)

When one syllable is held across several notes, the following notes are left **without a
syllable of their own** and an extension line is drawn from the syllable across them:

```
8 8 8 8 | 4 4 |
s l s m d d
_Glo_ _ _ri_a _men     → Glo——ri-a  men   (Glo held over the 2 blank notes)
```

A blank slot is just an empty syllable between underscores (note the spaces: `_Glo_ _ _ri`).

**Implementation:** the parser sets `isMelismaTail: boolean` on each beat — true when the
note has no lyric, is **not a rest**, and the previous note carried a syllable or was
itself a tail. It's **block-scoped** (reset at each blank-line phrase) and **rests break
the chain**, so a hold never bleeds across phrases or over a rest. The renderer, for each
note that has a lyric, looks ahead over contiguous `isMelismaTail` notes **within the same
system** and draws a thin line at `LYRIC_Y - 4` from `syllable.x + 12` to the last held
note's `x`. Fully-lyriced songs (every note has a syllable) get zero extension lines.

> Note the two features are mutually exclusive per note: `hyphenAfter` needs a **non-empty**
> next syllable; `isMelismaTail` marks an **empty** one.

## Coordinate system (all values in `stickLayout.ts`, SVG user units == px)

A system is one SVG. Vertical zones (exported constants):

```
TOP      = 10   stem top / primary beam
BEAM1_Y  = 12   primary beam line
BEAM2_Y  = 20   second beam line (sixteenths)
STEM_H   = 40   stem length  (stem bottom = TOP+STEM_H = 50)
SOLFA_Y  = 76   solfège baseline
LYRIC_Y  = 98   lyric + hyphen baseline
SYS_H    = 112  total system height  ← Apple Tree renders as "0 0 622 112"
```

Horizontal (module-private constants):

```
UNIT     = 46   px per quarter note → spacing is PROPORTIONAL to duration
MIN_STEP = 34   minimum advance between adjacent notes
LEFT_PAD = 40   room for the time signature (drawn once, on the first system)
BAR_GAP  = 22   width a barline occupies
```

`layoutSystem(measures)` walks each measure, placing a note at the cursor and advancing by
`max(duration * UNIT, MIN_STEP)`, then a barline + `BAR_GAP`. Returns `{ notes, barlines,
width, height }` where each note carries its absolute `x`.

## How beams connect

The parser sets `beamLeft` / `beamRight` (primary) and `secondLeft` / `secondRight`
(`'full' | 'stub' | null`, for 16th second beams) per beat, grouped by beat unit
(dotted-quarter groups in compound meters like 6/8). The renderer draws each beam as a
**`<line>` between two real note x-positions** — `beamRight` → line from this note's `x` to
the next note's `x` at `BEAM1_Y`; `secondRight: 'full'` → same at `BEAM2_Y`; `'stub'` → a
short 10px stub (partial beams, e.g. `ti-tika`). Unbeamed 8ths/16ths get a drawn flag
instead.

## Printing

- Each system is wrapped in `.avoid-break` (`break-inside: avoid` + `page-break-inside:
  avoid` in `index.css`). A system is one atomic SVG, so it can never be clipped across a
  page boundary — pages break cleanly between lines.
- The document still uses the `<table>` `thead`/`tfoot` trick in `DocumentPreview` for the
  repeating header/footer on every printed page. **Keep it.**
- SVG strokes print regardless of the browser's "background graphics" setting, so the old
  `print-color-adjust` battles for the notation are no longer load-bearing.
- Notation renders at natural px size with `max-width: 100%` (scales down only if a system
  is wider than the page). It does **not** scale with the `textSize` slider — that slider
  governs the prose/lyrics-below sections, not the staff.

## Verifying changes (no login needed)

There's a dev-only harness that renders the real `DocumentPreview` with seven test cases
(auto-bars, pickup, repeats, rests, sixteenths, staff mode, 6/8 compound):

```
npm run dev
# then open:  http://localhost:5173/?stick-test
```

Wired in `src/main.tsx` (guarded by `import.meta.env.DEV`); cases live in
`src/dev/StickTest.tsx`. Add a case there when you touch the renderer. Quick DOM checks
that caught regressions during the port: Apple Tree = viewBox `0 0 622 112`, 5 connected
beams, 3 hyphens; the sixteenths case has beam lines at both `y≈12` and `y≈20`.

## What is intentionally NOT touched

- **Staff mode** (`notationMode: 'standard'`) still renders via `stickToABC()` → `abcjs`
  in `StandardNotation.tsx`. The stick/staff toggle is unchanged.
- The parser's public shape is backward compatible: `hyphenAfter` was **added** to
  `StickBeat`; nothing was removed, so existing saved songs render identically (now with
  correct hyphens).
