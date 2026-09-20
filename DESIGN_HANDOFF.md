# Design Handoff - Rainbow Heart Studio Show Builder

**Project:** `proj-003`  
**Design-system version:** `0.8.0`
**Current phase:** Rainbow Heart identity implementation - Show Builder only  
**Last updated:** 2026-09-20

## Tablet songbook — 2026-09-20

### Two-page follow-up

- Added explicit One page / Two pages controls for generated charts and PDFs. The browser remembers only this reading preference in `band-pages-per-view`; no show data is stored there.
- Spreads stay within a song and align 1–2, 3–4, etc. An unpaired final page or single-page song is centered. Next/Previous and keyboard arrows move by spread; going backward across songs enters the final spread. Changing modes preserves the current reading range and resets zoom to fit.
- Both PDF sheets render through the existing local PDF.js worker, with at most two canvases at the existing capped resolution. Pinch/pan changes the complete spread transform and cannot navigate.
- Mock-isolated evidence: side-by-side chart and PDF rendering, odd third-page centering, forward/reverse song boundaries, keyboard spread turns, one/two-page switching, stored preference after reload, and synthetic pinch/pan/cancel/swipe regression passed. At 390x844, 768x1024, 1366x1024, and 1920x1080 there was no document overflow and all visible production targets were at least 48px. Fixed inherited `stagewrap` column direction exposed by the first rendered test.
- Four deterministic tests in `tests/songbook.test.mjs` cover alignment, odd/even backward entry, page coverage, and labels. The fixture now has three chart/PDF pages to exercise odd endings.
- Physical iPad Safari, TV mirroring/casting, actual private PDFs, assistive technology, and true 200% browser zoom remain untested. This is a display mode for existing screen mirroring, not a new casting or remote-control service.
- Files: `src/lib/songbook.mjs`, `src/pages/BandPacket.jsx`, `src/components/{BookViewport,BandChartPage,BandPdfPage}.jsx`, `src/components/songbook.css`, and `tests/songbook-*`.

Next device check: refresh Band View, choose Two pages, hide the setlist, and use Show tools → Full screen where supported; mirror that window to the practice TV using the existing laptop/display setup.

Jonathan requested page-by-page reading, a collapsible left setlist, and elimination of accidental song changes while zooming/panning, for rehearsal at 17:00 Central. This bounded Band View implementation uses an isolated release worktree from published `6083177`, separate from the import/Shared Memory branch and preserved older WIP.

- Band View renders one chart or PDF page at a time, fits the complete page to the remaining viewport, and advances through pages before the next show item. Backward reading enters the previous item's final page.
- Pinch and drag change only the page transform. All root-level swipe-to-song handlers are removed. Pointer cancellation, pointer capture, zoom limits, and pan bounds prevent a reading gesture from navigating.
- The left setlist can be opened/closed on every viewport. Tablet/desktop use an in-layout rail; phone uses a dismissible drawer with focus return, Escape, and contained Tab navigation.
- Tools are collapsed initially to give the chart more room. Previous/Next page controls remain visible; print uses the existing whole-show Print Center.
- Original PDF bytes and signed-link permissions are unchanged. PDF.js is bundled and lazy-loaded; an original-PDF link remains available. Title fitting for generated charts happens at natural paper size before zoom, preserving title geometry.
- Review is mock-isolated via `npx vite --config tests/songbook-vite.config.mjs`, then `/band/sample`. The fixture replaces both data adapters, uses invented songs and an in-memory two-page PDF, and never initializes Supabase. The review entry is excluded from the production build.
- Passed: production build; 390x844, 768x1024, 1024x768, and 1440x900 with zero horizontal/vertical document overflow, one visible chart page, and no sub-48px production controls; chart page boundaries and reverse navigation; keyboard right-arrow page turn; actual browser mouse-pan at 150% without navigation; synthetic two-touch pinch to 250%, subsequent drag/cancel/swipe with unchanged song/page; PDF pages 1/2 then break; phone focus containment and Escape return; title geometry after fit.
- Remaining evidence: physical tablet/two-finger use, actual private attached PDFs on that device, true 200% browser/text zoom, and assistive-technology review. The PDF test used a synthetic PDF; no claim is made about an untested private attachment.
- Shared Brain retrieval, indexing, database migrations, and private show records are outside this UI release.

Implementation: `src/pages/BandPacket.jsx`, `src/components/{BookViewport,BandChartPage,BandPdfPage}.jsx`, `src/components/songbook.css`, pinned `pdfjs-dist` dependency, and `tests/songbook-*` isolated review harness.

Next: verify the deployed release, then open the existing band link on the rehearsal tablet and use Fit page, Larger/pinch, Show setlist, and Previous/Next page.

## What changed

- Applied the accepted Rainbow Heart 2.0 Standard expression to `/studio/setlists` without changing its data or workflow behavior.
- Added a single six-stop Logo Spectrum edge as the only decorative spectrum moment.
- Rebuilt the visual hierarchy around a Show Builder masthead, quieter show archive, current-show header, numbered Event Details and Run of Show sections, and an explicit run-time block.
- Replaced decorative emoji in functional controls with direct labels and made the show-title rename shortcut keyboard-operable.
- Standardized ordinary surfaces at 18px, controls at 12px, true compact labels as pills, one-pixel rules, violet actions, and three-pixel focus outlines.
- Strengthened the mobile editor with a compact show header, full-width save priority, two-column output actions, stacked event fields, and 48px bottom editing actions.
- Moved show-card actions and song runtime controls onto secondary rows so long show and song titles retain the full primary reading lane.
- Replaced the persistent song-time input and duplicate formatted badge with a compact timestamp control and an overlay editor that does not increase card height.
- Replaced popup-based setlist and chart printing with same-tab Print Center navigation; setlists open in Floor Setlists mode and charts open in Charts Only mode.
- Bundled the accepted Inter, Fraunces, and Space Mono assets locally with their licenses.

## What was not changed

- Auth, Supabase, setlist persistence, uploads, chart syncing, sharing, routes, print rendering, and chart layout.
- Band Packet and print identities.
- Public pages or other authenticated Studio tools.

## Verification

The Vite production build passes with 154 transformed modules. Rainbow Heart OS 0.6.0 and connected-app metadata validation pass. Local non-mutating rendered review passed at 390x844, 768x1024, 1024x768, and 1440x900 with zero horizontal overflow, zero song-title/time collisions, no undersized visible Show Builder controls, and successful Inter, Fraunces, and Space Mono loading. Commit `2547f92` was pushed to `main`; the production bundle, font delivery, live `/studio/setlists` route, and absence of browser errors were verified. True 200% zoom, a complete keyboard sweep, reduced-motion emulation, cross-browser, assistive-technology, and physical-device checks remain open.

## Known open items

- Keyboard order, focus visibility, 200% zoom, reduced motion, cross-browser, assistive-technology, and physical-device evidence.
- Owner visual approval.

## Exact implementation files

- `src/pages/SetLists.jsx`
- `src/index.css`
- `index.html`
- `public/fonts/rainbow-heart/`
- `DESIGN_PROFILE.json`
- `DESIGN_HANDOFF.md`
- `SCAFFOLD_REVIEW.md`

## One next action

Complete the remaining keyboard, 200% zoom, reduced-motion, cross-browser, assistive-technology, and physical-device review gates.

- Separated show selection from show management: the full title area opens the show, while Duplicate and Delete live behind a distinct More menu and Delete retains confirmation.
- Added a dedicated mobile/tablet-first Band View at `/band/:token`: saved Studio charts render through the existing chart engine, attached outside-song PDFs load only when selected, and the existing public print composer remains available at `/band/:token/print`.
- Band View includes set navigation, breaks, notes, outside songs, event details, previous/next controls, keyboard and swipe progression, fit/zoom controls, fullscreen, and optional screen wake lock. No schema, auth, stored chart, or PDF mutation was introduced.
- 2026-09-07 live Band View evidence: production build and Rainbow Heart OS validation passed; a 41-song, three-set show rendered two-page saved charts; desktop, 390x844 phone, and 820x1180 tablet checks found no horizontal page overflow; visible primary controls met the 44-48px target baseline; break navigation, outside-song no-PDF recovery, and the dedicated public print URL worked. An attached-PDF device pass remains open because the reviewed show had no PDF attachment.
- Generated chart labels now treat the Chart Builder's saved `meta.title` as authoritative in Band View and public print output; the setlist's cached title is fallback only, while outside-song titles remain setlist-owned.
- Added canonical owner-mark favicon/home-screen assets, a web-app manifest, readable event-slug band URLs, native sharing with complete event-text copy fallback, event-specific browser titles, show freshness, and manual refresh. Token-only links remain backward compatible and the secure token remains the sole access key.
- Readable band URL slugs preserve `@` as the searchable word `at` (for example, `live-at-firestreet-pizza`).
