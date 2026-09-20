# Scaffold Review - Rainbow Heart Studio Show Builder

**Project:** `proj-003`  
**Design-system version:** `0.8.0`
**Review data mode:** production-connected-static-only  
**Last updated:** 2026-09-20

## Band View songbook review — 2026-09-20

Two-page follow-up (mock-isolated): generated charts and PDFs passed paired-sheet geometry, odd final page, reverse-entry, keyboard progression, one/two-page switching, and gesture non-navigation checks. Four deterministic spread tests pass. 390x844, 768x1024, 1366x1024 landscape-tablet, and 1920x1080 display checks found no document overflow or sub-48px visible controls. Physical iPad/TV mirroring remains not tested. Evidence and exact files: `DESIGN_HANDOFF.md` → Two-page follow-up.

This scoped review uses **mock-isolated** synthetic songs/PDF via `tests/songbook-vite.config.mjs`; the older Show Builder review below retains its original scope and history. Existing typography/palette is preserved; this is behavior/structure work, not identity acceptance.

| Check | Result | Evidence |
| --- | --- | --- |
| Phone / tablet portrait / landscape / desktop | Passed | 390x844, 768x1024, 1024x768, 1440x900; document overflow 0px in both directions |
| Single-page reading | Passed | One visible chart sheet, correct page label, correct forward/backward boundaries |
| Touch target size | Passed | All visible production buttons/links at least 48x48 CSS px at all four widths |
| Collapsible setlist | Passed | Rail collapses at desktop/tablet; phone drawer closes and returns focus |
| Reading gestures | Passed in synthetic regression + mouse UI | Pinch zoom to 250%, drag, cancel, and swipe never changed song/page; browser mouse pan also passed |
| Keyboard | Scoped pass | ArrowRight turns a chart page; phone Tab wraps inside drawer; Escape closes and restores focus |
| PDF paging | Synthetic pass | Bundled worker rendered both fixture PDF pages and advanced to the next break |
| Chart title | Passed | Natural-size title fitting before transform; visible title has nonzero proper height |
| Live/private PDF, physical touch, 200% browser zoom, AT | Not tested | Requires device/attachment review; do not infer from synthetic checks |

Detailed release evidence and remaining work: `DESIGN_HANDOFF.md` → Tablet songbook.

| Gate | Status | Evidence | Follow-up |
|---|---|---|---|
| Hierarchy and action priority | Static review only | Show archive, current show, save, output actions, event details, and run order have explicit structural levels | Confirm in rendered review |
| State differentiation | Static review only | Active show, set, break, note, outside song, timing, and unsaved states retain text or structural cues | Confirm with real long show |
| Minimum 48×48 touch targets | Passed | Rendered sweep found no undersized visible Show Builder controls at all four reference viewports | Physical touch-device review remains open |
| Keyboard-only workflow | Static review only | Rename shortcut is now a button and focus-visible styles are scoped to the app | Exercise complete keyboard flow |
| Phone 390x844 | Passed | Show archive, editor header, set columns, song cards, runtime controls, and bottom actions rendered with zero horizontal overflow | Physical phone remains open |
| Tablet portrait 768x1024 | Passed | Responsive editing structure rendered with zero horizontal overflow and no title/time collisions | Physical tablet remains open |
| Tablet landscape 1024x768 | Passed | Desktop grid rendered with zero horizontal overflow and no title/time collisions | Physical tablet remains open |
| Desktop 1440x900 | Passed | Archive/editor/library layout rendered with zero horizontal overflow and no title/time collisions | Cross-browser review remains open |
| 200% text zoom | Not tested | No evidence recorded | Exercise in controllable browser |
| Reduced motion | Static review only | New identity rules add no animation; legacy transitions remain outside this scoped override | Exercise media preference |
| No horizontal page scrolling | Passed | Overflow delta measured 0px at 390, 768, 1024, and 1440 widths | Repeat at true 200% zoom |
| Long-content stress | Passed | Existing long three-set show rendered without title/time overlap; mobile set headers reflow internally | Extreme translated content remains open |
| Error and recovery state | Static review only | Existing save and upload messages remain unchanged; no production-connected errors were triggered | Exercise in a mock-isolated environment |
| Privacy boundary | Passed | No auth, data, API, upload, or persistence code changed | Keep review non-mutating |
| Safe review mode verified | Passed | Review is limited to rendering and read-only inspection of the local production-connected preview | Do not save, upload, sync, duplicate, remove, or share records |

## Review decision

The Show Builder has an implementation candidate, not a rendered approval. Identity and deployment remain pending owner review and the open gates above.

## One next action

Run the local non-mutating four-viewport rendered review.
