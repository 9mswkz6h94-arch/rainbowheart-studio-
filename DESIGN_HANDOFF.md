# Design Handoff - Rainbow Heart Studio Show Builder

**Project:** `proj-003`  
**Design-system version:** `0.6.0`  
**Current phase:** Rainbow Heart identity implementation - Show Builder only  
**Last updated:** 2026-09-07

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
