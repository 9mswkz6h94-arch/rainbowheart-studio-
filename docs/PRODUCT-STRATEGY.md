# Rainbow Hearts Studio — Product Strategy & Agent Brief

**Read this first if you are an AI agent (or human) picking up this project.**
It captures the business strategy, the decisions already made and *why*, and the
build order. `HANDOFF.md` covers the web app's technical state; this file covers
where the project is going. Written July 2026 after a strategy session with
Jonathan (owner). Treat decisions here as settled unless Jonathan reopens them —
don't re-litigate, build.

## The one-paragraph mission

Jonathan is building Rainbow Hearts Studio (music + art studio, Copperas Cove TX)
into an income stream large enough to transition out of his day job. The product is
a suite of **working tools for music teachers and performing musicians** — living
software, not static printables — sold pay-what-you-can. Solo founder, bootstrapped,
AI-assisted development. Optimize every decision for: recurring revenue, near-zero
marginal cost, no inventory, no employees.

## Market position (settled)

- **Teachers Pay Teachers is a channel, not a competitor.** TPT only distributes
  static files; it cannot host software. We sell *spreadsheet tools* there (see
  `products/`) that work standalone forever and funnel buyers to the site. TPT
  Premium Seller ($59.95/yr, 80% royalty) is worth it once listings exist.
- **Existing tool apps serve other buyers** (WorshipTools/Set List Maker → worship
  bands & gigging pros; Hooktheory → songwriters; Chordify → hobbyists). Nobody
  combines print-ready teaching materials + multi-instrument support (uke,
  guitarlele, tenor guitar, guitar, bass, drums) + live performance mode + student
  practice tracking for the modern-band / private-lesson / elementary music teacher.
  That combination is the moat. The real competitor is a teacher hand-making charts
  in Google Docs.

## The revenue ladder (settled)

1. **Free web tools** (tuner, metronome, chord & scale explorer) — discovery. Never
   paywall these; they are the marketing.
2. **TPT sheet products** ($3–8 one-time) — see `products/README.md` and
   `STYLEGUIDE.md`. Each works standalone (TPT policy requires real standalone
   value) and advertises the site. Free samplers drive store traffic.
3. **Studio subscription** (pay-what-you-can via Stripe on the web — floor ~$2,
   suggested ~$8; fixed ~$4.99/mo via app-store IAP where PWYC isn't possible).
   The subscription sells **convenience, not hostage content**: sync, library,
   remote control, imports. A lapsed teacher can always view/print their own songs.

## Roadmap, in priority order

### Now / next (highest value per effort)
1. **Kodály Stick Sheet Maker → TPT** — BUILT (this branch). Remaining: deploy so
   glyph PNGs go live, import to Google Sheets, run the QA list in
   `products/README.md`, create TPT seller account, list sampler + full.
2. **Self-serve signup + Stripe PWYC subscription** — users are currently created
   manually in Supabase. This blocks all recurring revenue and is the single most
   important web-app milestone. Gate per `free` flags in `src/lib/tools.js`.
3. **Transposition in Chord Chart Builder** — table stakes for teachers; also the
   headline feature TPT chord-chart PDFs can never match.
4. **Photo songs, phase 1** — camera/file capture → Supabase Storage (private
   bucket, signed URLs) → renders in My Songs / set lists / Shows presenter. Kills
   the empty-library onboarding problem ("photograph your binder"). Works from the
   mobile browser today; no app required.

### Then
5. **More sheet products** (reuse the Kodály architecture): interactive fretboard
   (reuse ChordScaleExplorer data), transposition/capo calculator (make it FREE —
   traffic magnet), Boomwhacker arranger (conditional-formatting colors), recorder
   karate tracker, drum groove grid, worksheet generators, practice log, show
   program builder, instrument inventory. Elementary bundle (Kodály + Boomwhacker +
   recorder) targets TPT's biggest-spending segment.
6. **Remote layer** — generalize `src/lib/presentChannel.js` (controller/display
   over Supabase Realtime Presence, already proven in Shows) into a reusable hook;
   add Metronome remote (phone = start/stop/tap/tempo; laptop = sound) and chart
   pager. This is the subscription's flagship convenience.
7. **Bluetooth pedal compatibility** — BLE page-turner pedals (AirTurn, PageFlip)
   pair as HID keyboards; `PresentControl.jsx` already listens for keydown + Web
   MIDI. Add a key-mapping setting, test with real pedals, then claim "works with
   your pedal" in marketing. **Do NOT design custom retail hardware** — decided
   against (certification cost, inventory, margins). An ESP32 DIY kit is a possible
   future merch item only.
8. **Capacitor app-store wrap** — after the subscription works on the web. Apple
   $99/yr, Google $25. Fixed-price IAP there.
9. **Photo songs, phase 2** — "make it editable": vision-LLM conversion of chart
   photos to ChordMark via a Netlify function (keeps the API key server-side).
   Meter it (~N conversions/month on the paid tier); cost is roughly a cent per scan.
10. **Heart Beats practice app** — validate first with the practice-log sheet
    product. If students (minors) ever get logins, COPPA applies — start with
    teacher-accounts-only.

## Funding posture (settled — don't reopen without Jonathan)

Deploying everything above costs ~$3k lean / ~$15k comfortable, year one. The
product does not need investors; runway might. Preferred instrument if friends
invest: **founding-member lifetime deals** (~$75–100 × 50 people) — customers, not
shareholders. If actual investment: small ($5–15k), promissory note or SAFE, never
a handshake, never meaningful equity for Tier-1 money.

## Security / housekeeping debts

- Supabase anon key leaked into `.env.example` historically — **rotate it** before
  real users arrive (HANDOFF.md notes this too).
- Private storage + signed URLs for any user-uploaded chart photos (copyright:
  personal copies are fine, public redistribution is not).
- Terms/privacy templates before subscription launch; real lawyer pass when revenue
  justifies it.

## Working agreements for agents

- **Consistency beats novelty.** New sheet products follow `products/STYLEGUIDE.md`;
  new web tools follow the patterns in `src/lib/tools.js` (single source of truth
  for the tool list), the CSS variable tokens in `src/index.css`, and the existing
  page/component layout. Match what exists.
- Deterministic generation (Set #s), Sheets+Excel-common formulas only, generated-
  never-hand-made workbooks, black-ink print areas, rainbow tab strip, single-
  teacher license wording — all specified in the style guide.
- The tone of all customer-facing copy is warm, plain, teacher-to-teacher. No
  corporate voice. "We actually answer" is the support promise.
- When Jonathan asks a strategy question, give a recommendation, not a menu.
