# Stick Notation Engine Redesign — Handoff Document

**Status:** ✅ SHIPPED & LIVE (2026-07-16)  
**Repo:** github.com/9mswkz6h94-arch/rainbowheart-studio- (monorepo)  
**Location:** `kodaly-master-copy-studio/` subdirectory  
**Deployment:** Netlify (auto-deploy on git push)  
**Live:** https://kodaly-master-copy-studio.netlify.app/

---

## What Was Built

A complete redesign of stick notation rendering in the Master Copy Studio. The old system had two critical bugs:

1. **Beams didn't connect** — each note rendered as its own flex-scaled SVG, so beam polygons were isolated inside 24-unit viewBoxes and couldn't reach adjacent notes.
2. **Long songs clipped on print** — the document was a fixed 816×1056 box with zoom `transform: scale()`, which rendered the entire thing as one unbreakable unit.

**Solution:** One `<svg>` per visual line (system), with a pure coordinate geometry engine that assigns every note an absolute x-position. Beams are now `<line>` elements spanning real note positions — they connect. Print uses native `break-inside: avoid` per system, so pages break cleanly between lines.

---

## Architecture (3-Stage Pipeline)

```
text input → parseStickNotation() → layoutSystem() → <svg> per system
             src/lib/stickParser.ts    src/lib/stickLayout.ts   DocumentPreview.tsx
```

### 1. **Parser** (`src/lib/stickParser.ts`)
- Input format (unchanged): blocks of rhythm/solfège/lyrics separated by blank lines
  ```
  8 8 4
  s s m
  _Ap_ple _tree,
  ```
- Output: `measures[]` of `beats[]` with rhythm/pitch/lyrics + metadata flags
- **New flags (added 2026-07-16):**
  - `hyphenAfter: boolean` — syllable joins next with hyphen (same word, no space)
  - `isMelismaTail: boolean` — note has no syllable (holds previous one)

### 2. **Layout Engine** (`src/lib/stickLayout.ts`, new)
- Pure function (no DOM). Measures → absolute x-coords.
- `layoutSystem(measures): { notes, barlines, width, height }`
- Proportional spacing: `UNIT = 46px per quarter note`
- Vertical geometry constants: `TOP`, `STEM_H`, `SOLFA_Y`, `LYRIC_Y`, `SYS_H`, `BEAM1_Y`, `BEAM2_Y`
- **Key insight:** This is where musical spacing lives. Renderer just places glyphs at these coordinates.

### 3. **Renderer** (rewritten `System` component in `DocumentPreview.tsx`)
- One `<svg viewBox="0 0 width height">` per system (visual line)
- All stems, beams, barlines, text on the same baseline
- Beams are `<line>` elements between real note x-positions
- Solfège and lyrics are `<text>` elements at computed x/y

---

## Features Shipped

### Syllable Hyphens (Professor Request)
When a word is split across notes with no space between syllables (`_Ap_ple`), a hyphen renders centered between them. Input signal is already present (space = new word, no space = same word); the parser just reads it.

```
Input:  _Ap_ple _tree  →  Renders: Ap-ple  tree (no hyphen before tree)
```

### Melisma Extension Lines (Professor Request)
When a syllable is held across notes with blank lyric slots, an extension line (`——`) is drawn from the syllable across the held notes. Block-scoped: never bleeds across phrases, rests break the chain.

```
Input:  _Glo_ _ _ri_a _men  →  Renders: Glo——ri-a  men
        (two blank slots between Glo and ri)
```

### Print Fix
- Each system wrapped in `.avoid-break` (CSS: `break-inside: avoid` + `page-break-inside: avoid`)
- Systems are atomic SVGs, so pages break cleanly between lines
- No more transform-scale wrangling; no more `!important` color battles

---

## Verification Checklist

All verified via `?stick-test` dev harness (no login needed):
- ✅ Apple Tree renders: viewBox `0 0 622 112`, 5 connected beams, 3 hyphens
- ✅ Sixteenth notes: primary beams at y≈12, second beams at y≈20 (connecting)
- ✅ Rests, pickups, repeats, 6/8 compound meter all render
- ✅ Staff mode untouched (still uses abcjs)
- ✅ Production build clean, `tsc` clean (only pre-existing PitchHelper Float32Array error)
- ✅ 8 test cases in harness (added MELISMA case at index 5)

**Run locally:**
```bash
cd kodaly-master-copy-studio
npm run dev
# Then open: http://localhost:5173/?stick-test
```

---

## Files Modified

| File | Change |
|------|--------|
| `src/lib/stickParser.ts` | Added `hyphenAfter`, `isMelismaTail` flags + block-scoped melisma logic |
| **`src/lib/stickLayout.ts`** | **NEW** — pure geometry engine |
| `src/components/DocumentPreview.tsx` | Rewrote `System` renderer; removed old per-note flex glyphs |
| `src/dev/StickTest.tsx` | Added MELISMA test case (index 5) |
| `src/App.tsx` | Updated in-app guide to document hyphens + melisma |
| `src/index.css` | Added `break-inside: avoid` to `.avoid-break` |
| **`NOTATION_ENGINE.md`** | **NEW** — technical reference for any future work |

---

## What's NOT Changed

- **Staff mode** — still renders via `stickToABC()` → abcjs. Untouched.
- **Input format** — same blocks/rhythm/solfège/lyrics. Just now correctly handled.
- **Supabase** — shared with rainbowheart-studio. All song data flows through same DB.
- **Git/Netlify** — now in monorepo. Single `git push` deploys both apps.

---

## Next Steps (If Any)

### To Test in Production
1. Sign in to https://kodaly-master-copy-studio.netlify.app/
2. Create or edit a song with:
   - Split syllables: `_Ap_ple` → should show `Ap-ple`
   - Held syllables: `_Glo_ _ _ri_a` → should show `Glo——ri-a`
3. Print the page (Cmd+P or Ctrl+P) — should break cleanly between systems

### If Professors Request More
- **Melisma slurs** (curved lines instead of straight): add to renderer
- **Slurs between notes** (connecting non-held notes): add to layout engine
- **Dynamic beaming rules** (e.g., beam by beat, not by beat unit): edit `stickParser.ts` beaming logic

### Technical Debt (Optional)
- PitchHelper.tsx has a pre-existing Float32Array typing error (Web Audio API) — fix if you touch Web Audio
- `StandardNotation.tsx` could benefit from refactoring (abcjs wrapper) but staff mode works
- Test coverage: no unit tests for `stickLayout.ts` or `stickParser.ts` changes — add if you plan frequent iteration

---

## Key Decision: Why One SVG Per System?

**The old way (per-note SVG):**
- ✗ Beams couldn't connect (isolated 24-unit viewBoxes)
- ✗ Print clipped at fixed page boundary (zoom transform blocks pagination)
- ✗ Spacing was flex-driven, not duration-driven

**The new way (one per system):**
- ✓ Beams are lines between real note x-positions → they connect
- ✓ Each system is atomic, break-inside:avoid works → clean print
- ✓ Spacing is `duration * 46px` → proportional and predictable
- ✓ Coordinate system is explicit and testable (pure function)

This is load-bearing architecture. Don't reintroduce per-note SVGs or flex-based spacing.

---

## How to Hand Off Again

If this needs work in a future chat:
1. Share this document
2. Point them to `NOTATION_ENGINE.md` (in the repo) for detailed technical reference
3. Run `?stick-test` to see it working
4. Changes should land in `src/lib/stickLayout.ts` (geometry), `src/lib/stickParser.ts` (parsing), or the `System` component (rendering)

Good luck! 🎵
