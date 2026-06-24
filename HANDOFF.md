# Rainbow Hearts Studio — Project Handoff

This document is a full context brief for any agent or chat continuing work on this project.

---

## What This Is

A React web app for **rainbowheart.studio** — a two-layer site:

- **Public layer** — marketing homepage for Rainbow Hearts Studio (Copperas Cove, TX). Services: private lessons with multiple instructors, art parties, murals, art shows, kids performance band.
- **Private layer** — login-gated tool portal for Jonathan (studio owner). Currently hosts the Chord Chart Builder. Tab Builder and Student Practice App are planned but not built yet.

Future plan: wrap the app with **Capacitor** and ship to App Store / Google Play.

---

## Tech Stack

| Layer | Tool |
|-------|------|
| Framework | React 18 + Vite 5 |
| Routing | React Router v6 |
| Auth + DB | Supabase |
| Hosting | Netlify (auto-deploys from GitHub on push to `main`) |
| Fonts | Rye (chart title), Space Mono (chords), Atkinson Hyperlegible (chart body), Fraunces (headings), Inter (UI) |
| Mobile (future) | Capacitor |

---

## Repos & Services

| Service | URL / ID |
|---------|----------|
| GitHub repo | `github.com/9mswkz6h94-arch/rainbowheart-studio-` |
| Netlify URL | `comforting-blini-3cfbe5.netlify.app` |
| Custom domain | `rainbowheart.studio` (DNS propagating via WordPress registrar) |
| Supabase project | `fcamjkfgxywsyjcdmrrd.supabase.co` |
| Supabase anon key | starts with `sb_publishable_...` (in `.env`) |

**Deploy process:** `git add . && git commit -m "message" && git push` → Netlify detects push and auto-deploys in ~30 seconds.

**Netlify SPA routing fix** is in place: `public/_redirects` contains `/* /index.html 200` so React Router handles all routes correctly.

---

## File Structure

```
rainbowheart-studio/
├── public/
│   └── _redirects              ← Netlify SPA fix (do not remove)
├── index.html                  ← Loads Google Fonts (Rye, Space Mono, Atkinson Hyperlegible, Fraunces, Inter)
├── vite.config.js
├── package.json
├── .env                        ← VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY (not committed)
├── .env.example                ← Template (committed — has real values in it, worth cleaning up)
└── src/
    ├── main.jsx                ← Entry point, wraps app in BrowserRouter + AuthProvider
    ├── App.jsx                 ← Routes: / | /login | /studio | /studio/chord-charts
    ├── index.css               ← All styles (global + component + chart + print)
    ├── lib/
    │   ├── supabase.js         ← Supabase client (reads from import.meta.env)
    │   ├── parseChordMark.js   ← ChordMark parser + roadmap builder
    │   └── songs.js            ← CRUD for songs table (fetchSongs, fetchSong, saveSong, deleteSong, timeAgo)
    ├── context/
    │   └── AuthContext.jsx     ← Auth state (user, loading, signIn, signOut) via Supabase
    ├── components/
    │   ├── Navbar.jsx          ← Sticky nav, shows "Studio ↗" + Sign Out when logged in
    │   ├── Footer.jsx          ← Social links (Instagram, Facebook, YouTube)
    │   ├── ProtectedRoute.jsx  ← Redirects to /login if no user
    │   └── charts/
    │       └── ChartPreview.jsx ← Renders the chord chart (masthead + sections + print area)
    └── pages/
        ├── Home.jsx            ← Public homepage (hero, 5 service cards, about, contact CTA)
        ├── Login.jsx           ← Supabase email/password login
        ├── Dashboard.jsx       ← Private tool hub (Chord Chart Builder card links to /studio/chord-charts)
        └── ChordCharts.jsx     ← Main chord chart builder page
```

---

## Supabase Setup

### Auth
- Email/password auth enabled
- Jonathan's login: `jonathan@rainbowheart.studio`
- Users are created manually in Supabase Dashboard → Authentication → Users

### Database: `songs` table

```sql
create table songs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade not null,
  title      text not null default 'Untitled',
  song_text  text not null default '',
  meta       jsonb not null default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

Row Level Security is enabled — users can only read/write their own songs (`auth.uid() = user_id`). An `update_updated_at` trigger keeps `updated_at` current on save.

### `meta` JSONB shape
```json
{
  "band":   "Brother Jon & The Rainbow Hearts",
  "writer": "Jonathan Owens",
  "key":    "Am",
  "meter":  "4/4",
  "tempo":  "108 BPM",
  "capo":   "Capo 2 · plays Gm"
}
```

---

## Chord Chart Builder — Current State

**Route:** `/studio/chord-charts` (protected)

**What works:**
- ChordMark parser (`parseChordMark.js`) handles `#v`, `#c`, `#b`, `#intro`, `#outro`, `#inst`, `#pre`, `#tag`, `#solo` section labels
- Parses chord lines (standalone chord symbols) and pairs them with the lyric line below
- Three chart variants: Full Chart, Bass/Chords, Lyrics
- Live preview renders in a letter-size white card (8.5in × 11in) with Rainbow Hearts styling:
  - Rye font for title
  - Grey spec strip (Key, Meter, Tempo, Writer)
  - Structure roadmap (e.g. `Intro → V ×2 → C → B → C`)
  - Section labels in grey badges
  - Space Mono for chord lines
  - Two-column body layout
- Print / Save PDF via `window.print()` — print CSS hides everything except `#chart-print-area`
- Song persistence: save/load/delete via Supabase `songs` table; "My Songs" panel in the input sidebar with unsaved indicator

**Features Jonathan wants added (not yet built):**
- Transposing (shift all chords up/down by semitone)
- Better editing layout / repositioned sidebar
- Beat units display
- Accidentals toggle (flat vs sharp)
- 1-column vs 2-column layout toggle
- Text auto-fit (font size scales to fill the page)

---

## ChordMark Format (quick reference)

```
#intro
Am G F C

#v
Am          G
I see the writing on the wall
F              C
Nothing's gonna stop us after all

#c
F    G    Am
This is the chorus
```

- Section labels: `#v` `#c` `#b` `#intro` `#outro` `#inst` `#pre` `#tag` `#solo`
- Chord line: chord symbols alone on a line
- Lyric line: the line immediately after a chord line
- `%` repeats the previous bar (parser supports it)
- Reusing a section label (second `#v`) auto-increments count (Verse 2, etc.)

---

## Design System (index.css)

All styles are in a single `src/index.css`. Key CSS variables:

```css
--primary:      #6C5CE7   /* purple */
--red:    #FF6B6B  --orange: #FF9F43  --yellow: #FECA57
--teal:   #1DD1A1  --blue:   #54A0FF  --purple: #A29BFE  --pink: #FD79A8
--text:         #2D3436
--text-muted:   #636E72
--border:       #E9ECEF
--bg-subtle:    #F8F9FA
--radius:       12px
--shadow:       0 4px 24px rgba(0,0,0,0.08)
```

Chart styles are in a clearly marked section (`/* CHORD CHART BUILDER */`) in index.css. Print styles are at the bottom under `@media print`.

---

## Local Dev

```bash
cd C:\Users\John\Documents\Projects\rainbowheart-studio
npm run dev
# → localhost:5173
```

Requires `.env` with:
```
VITE_SUPABASE_URL=https://fcamjkfgxywsyjcdmrrd.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...
```

---

## Known Issues / Notes

- `.env.example` was accidentally used to store real credentials at one point — worth regenerating the anon key in Supabase if security is a concern
- The `rainbowheart.studio` DNS is pointed at Netlify but may still be propagating
- `public/_redirects` must stay in place — removing it breaks all direct URL navigation
- ChordMark chord detection regex is intentionally broad; complex extended chords (e.g. `Cmaj7#11`) may not parse correctly — can be improved
- The chord chart builder does not yet auto-save; user must click "Save Song" / "Save Changes"
