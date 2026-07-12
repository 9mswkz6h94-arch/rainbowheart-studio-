# Rainbow Hearts Studio — Sheet Product Style Guide

**Audience: any agent or human building the next spreadsheet product.** The Kodály
Stick Sheet Maker (`kodaly-stick-maker/`) is the reference implementation — when in
doubt, open its `build.mjs` and copy the pattern. The goal is that every product in
the line is recognizably the same brand and the same architecture, so a teacher who
buys a second one already knows how to use it, and a developer who opens a second
one already knows how it works.

## Non-negotiable architecture

1. **Products are generated, never hand-made.** Each product is a `build.mjs` script
   (ExcelJS) in its own folder under `products/`. The `.xlsx` in `dist/` is a build
   artifact — regenerable, git-ignored, and never edited by hand. This is what makes
   the product line maintainable by future agents.
2. **Google Sheets is the target, xlsx is the medium.** Build an `.xlsx`, import it
   into Google Sheets once, sell the force-copy link. Use only formulas that exist in
   BOTH Google Sheets and Excel 365: `IF, AND, INDEX, MATCH, VLOOKUP, MOD, IFERROR,
   CONCATENATE, COUNTIF, IMAGE`. No macros, no Apps Script, no dynamic arrays
   (`FILTER`/`SEQUENCE`), no volatile functions (see rule 4).
3. **Tab layout is always:** `Start Here` → `Setup` → output tabs → `About`, plus a
   hidden `ENGINE` tab. Sheet names contain no spaces-with-emoji weirdness; internal
   formula references only ever point at `Setup` and `ENGINE` (single-word names, no
   quoting hazards).
4. **Determinism over randomness.** Never use `RANDBETWEEN` — it rerolls on every
   edit and answer keys stop matching their worksheets. Use a **Set #** cell (1–999)
   feeding a pure-formula mixer:
   `MOD(Set*6007 + row*7919 + col*104729 + row*col*2310, poolSize) + 1`
   The constants are chosen so every stride is coprime to any pool size 2–10 (2310 =
   2·3·5·7·11 kills the correlation classes; verify with a simulation script if you
   change them). Different output tabs consume different row-ranges of the same
   matrix so one Set # yields distinct-but-reproducible content everywhere.
5. **Images by URL, not embedded.** Visual glyphs render via
   `IMAGE(baseUrl & id & ".png")` where `baseUrl` lives in `ENGINE!$H$4` and points at
   `https://rainbowheart.studio/glyphs/<product>/`. Glyph sources are SVG modules in
   `products/glyphs/<product>/`, rendered to PNG in `public/glyphs/<product>/` by a
   build script, deployed by the main site's Netlify build. Every product must also
   offer a **text fallback mode** (a Setup dropdown) for offline classrooms.
6. **Every product ships as two SKUs from one script:** the full build and a
   `--sampler` build (free TPT listing). The sampler limits *content* (fewer
   elements/options), not *features* — a generous demo sells better than a crippled one.

## Brand tokens

Mirror `src/index.css` — that file is the source of truth if these drift:

| Token | Hex (ARGB) | Use in sheets |
|---|---|---|
| purple `#6C5CE7` | `FF6C5CE7` | product titles, Start Here tab color |
| red / orange / yellow / teal / blue / pink | `FF6B6B / FF9F43 / FECA57 / 1DD1A1 / 54A0FF / FD79A8` | **tab colors, in rainbow order across the tab strip** |
| text `#2D3436` | `FF2D3436` | body text |
| muted `#636E72` | `FF636E72` | hints, footers, card numbers |
| border `#E9ECEF` | `FFE9ECEF` | light rules |
| bg-subtle `#F8F9FA` | `FFF8F9FA` | input cell fills |

- **Fonts:** headings `Fraunces`, body `Inter`, data/mono `Space Mono` (same stack as
  the web app; Sheets has all three, and missing fonts fall back harmlessly).
- **Printable content is pure black.** Masters get photocopied — brand color lives in
  the UI tabs (Setup, Start Here), never in the print areas.
- **Tab strip is the rainbow.** Assign `tabColor` per tab: purple, blue, then
  red/orange/yellow/teal/… for outputs, pink for About. It's the signature look.

## Fixed copy blocks

- **Footer on every printable tab:** `rainbowheart.studio · <Product Name>` — 8pt muted.
- **Start Here** always contains: quick start (numbered), how Set #s work, the offline
  /text-mode note, the single-teacher license paragraph, and the free-tools plug.
- **About** is the same brand page in every product (copy from the reference build,
  update the tool list as the suite grows).
- **License wording:** "Single-teacher license: print unlimited copies for your own
  classroom and students. Please don't share this file or your copy link."

## Setup-tab conventions

- Controls live in column C, labels in B, hint text in E, all inputs boxed with
  `bg-subtle` fill and `Space Mono`.
- Option lists are dropdown data validations (`type:'list'`) — never free text.
- Content toggles are `ON/OFF` dropdowns **in pedagogical order**, with an `IMAGE()`
  preview beside each so teachers see what they're toggling. Required items get a
  single-option `"ON"` validation and a note, not a missing control.
- Number inputs get whole-number validation with a friendly error message.

## Publish workflow (same every time)

1. `node build.mjs` and `node build.mjs --sampler`.
2. Import each xlsx to Google Sheets (File → Import → Upload) under the studio
   Google account, into a `TPT Products/<product>` Drive folder.
3. Verify visually: dropdowns work, glyphs load, each output tab prints to one page
   (File → Print, confirm margins), text mode renders.
4. Share → Anyone with link → Viewer. Turn the edit URL into a force-copy link by
   replacing the trailing `/edit...` with `/copy`.
5. TPT ZIP contains: one-page PDF quick-start with the `/copy` link, the xlsx as a
   bonus, and the license text. Sampler ships the same way, free.

## Naming

- Folders: `products/<kebab-name>/`, output `dist/<kebab-name>.xlsx` and
  `dist/<kebab-name>-FREE.xlsx`.
- Glyph hosting: `public/glyphs/<short-name>/<id>.png` — ids are short, lowercase,
  no punctuation (they get concatenated into formulas).
