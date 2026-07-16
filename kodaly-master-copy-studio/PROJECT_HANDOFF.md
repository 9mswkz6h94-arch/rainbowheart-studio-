# Kodály Master Copy Studio — Project Handoff

**Last Updated:** 2026-07-13  
**Status:** Production (https://kodaly-master-copy-studio.netlify.app)

---

## Mission

Build a **free community tool** for the Kodály teaching community to capture and preserve old, disappearing copyrighted folk song libraries before they vanish. Teachers can transcribe scanned songbook pages into structured "master copies" and share with classmates during a free trial period.

**Brand:** Rainbow Heart Studio  
**Target Users:** Kodály music teachers + their students  
**Funding Model:** Free for trial period; potential future funding/replication as separate project

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18 + Vite 5, Tailwind CSS, TypeScript |
| **Auth** | Supabase (email/password + Google OAuth) |
| **Database** | PostgreSQL via Supabase (shared `kodaly_songs` table) |
| **Notation** | Stick notation parser (custom TS), ABC notation, abcjs for staff render |
| **AI/Extraction** | Claude API via Netlify Functions (Absorb feature) |
| **Hosting** | Netlify (deploy + serverless functions) |
| **Draft Safety** | localStorage mirror + crash recovery |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    MASTER COPY STUDIO                   │
│                  (kodaly-master-copy-studio)            │
└─────────────────────────────────────────────────────────┘

Frontend (React)
├── App.tsx (main editor, autosave loop, responsive layout)
├── Login.tsx (email/password + Google OAuth, Rainbow stripe)
├── LibraryPanel.tsx (song list, open/new/delete)
├── DocumentPreview.tsx (live stick notation render + staff via ABC)
├── FormInput, FormSelect, MelodicContentSelector (reusable form components)
└── Context: AuthContext (session management)

Libraries & Utilities
├── stickParser.ts (parse stick notation → AST, generate ABC)
├── songLibrary.ts (Supabase CRUD + localStorage draft mirror)
├── absorbSong.ts (call netlify function, extract from image/PDF)
└── supabaseClient.ts (auth + DB connection)

Backend (Netlify Functions)
└── extract-song.mjs (POST /api/extract-song)
    ├── Validates Supabase Bearer token (auth-required)
    ├── Calls Claude Opus with system prompt
    ├── Returns structured SongData (JSON schema)
    └── Prevents anonymous API key exposure

Database (Supabase PostgreSQL)
└── kodaly_songs table
    ├── id, user_id, title, meter, rsp/ssp, tone_set
    ├── mc_* checklist flags (auto-derived on save)
    ├── master_copy_data (JSONB: full SongData document)
    └── Row-level security: users see only their own songs
```

---

## Key Features Implemented

### 1. **Stick Notation Editor**
- Type rhythms (`4`, `8`, `16`, `2`, `1` + `.` for dotted; `z` for rests)
- Type solfa (`d r m f s l t` with octave marks `'` and `,`)
- Type lyrics with underscore alignment (`_Ap_ple _tree`)
- Auto-barlines by time signature (or manual via `|` / `||` / `|:` / `:|`)
- Live preview renders both stick + auto-generated staff notation
- Proper beaming logic for compound meters (e.g., 6/8 groups by dotted quarter)

### 2. **Absorb (AI Extraction)**
- Upload songbook page (image or PDF) or paste text
- Claude Opus extracts into structured master copy format
- Requires Supabase auth token (prevents API key abuse)
- Returns title, solfa, lyrics, time signature, genre, source citation, etc.

### 3. **Song Library**
- Browse all user's songs (title, meter, completion status, last edited)
- Open song → loads into editor
- New song → blank slate with defaults
- Delete song (soft delete in UI, actual delete in DB)
- Auto-derived checklist (`mc_*` flags): title, solfa, lyrics, game directions, source, etc.

### 4. **Autosave + Crash Recovery**
- Every 1.2 seconds (debounced) while editing
- Saves to Supabase + localStorage draft mirror
- If browser crashes/goes offline, prompts on reload to restore draft
- Status indicator: "Saving…" → "Saved to library" or error

### 5. **Print & Export**
- Print-friendly CSS: removes UI, stacks full-page, repeats header/footer
- Fixed zoom scale (print resets transform so long songs paginate across pages)
- Export to JSON (portable backup)
- Import from JSON

### 6. **Authentication**
- Email/password signup + login
- Google OAuth (via Supabase)
- Session persistence via Supabase auth tokens
- Row-level security: each user only sees their own songs

### 7. **Responsive Mobile**
- **Mobile** (< 768px):
  - Full-width editor, stacked vertically
  - Simplified notation guide (format cheat sheet)
  - Preview pane hidden (focus on notation textarea)
  - Essential controls: Library, Absorb, Sign Out
- **Desktop** (≥ 768px):
  - Sidebar form + resizable preview pane
  - Full notation guide with examples
  - Zoom controls, page display toggle (stick vs staff)
  - Title/text size sliders

### 8. **Rainbow Heart Studio Branding**
- Rainbow stripe header on login + editor
- "Rainbow Heart Studio app · made with ♥ by Brother Jon" footer
- Links to rainbowheart.studio
- Consistent color scheme and typography

---

## Data Model (SongData)

```typescript
interface SongData {
  // Header
  title: string;
  crossRefTitle: string;  // alternate name
  
  // Musical Metadata
  ssp: string;  // suggested starting pitch (key, e.g., "G")
  rsp: string;  // recommended singing pitch
  timeSignature: string;  // e.g., "2/4"
  beatNote: string;  // ♩ (quarter), etc.
  bpm: string;  // tempo
  genre: string;  // e.g., "Circle Game"
  subject: string;
  
  // Melodic Content (Kodály tone set)
  melodicNotes: Record<string, 'selected' | 'final'>;
  melodicContent: string;  // spaced string showing range
  
  // Notation (stick notation + auto-generated ABC)
  notationMode: 'stick' | 'standard';
  notation: string;  // stick notation blocks
  abcNotation: string;  // auto-derived ABC (regenerated on save)
  
  // Extra Content
  additionalVerses: string;
  pertinentInfo: string;  // game/dance directions, notes
  source: string;  // citation: author, book, page
  nameDate: string;  // collection name & date
  
  // Formatting
  titleSize: number;  // 24-72px
  textSize: number;  // 10-32px
}
```

**Supabase Table:** `kodaly_songs`
- `user_id` (FK to auth.users)
- `master_copy_data` (JSONB, full SongData)
- `mc_*` flags (auto-derived checklist)
- Timestamps: `created_at`, `updated_at`

---

## Current State & Working Features

✅ **Production Deployed**
- Frontend: https://kodaly-master-copy-studio.netlify.app
- Database: Supabase PostgreSQL (shared with rainbro Study Room)
- Serverless: Netlify Functions + Claude API

✅ **User Workflows**
1. Sign up (email or Google)
2. Create/edit master copy songs in stick notation
3. Autosave to cloud + local draft backup
4. Browse library, open/delete songs
5. Scan songbook pages via Absorb (AI extraction)
6. Print master copies (stick notation or staff)
7. Export to JSON for backup

✅ **Code Quality**
- TypeScript throughout
- Proper row-level security (Supabase RLS)
- Bearer token auth on Absorb endpoint
- Responsive Tailwind CSS layout
- Print CSS with pagination support
- localStorage draft recovery

---

## Known Blockers / Next Steps

### 🔴 **Supabase OAuth Redirect Config (USER ACTION)**
**Status:** Blocking email confirmation links + Google login for classmates

**Fix:** User must add to Supabase dashboard:
- Go: Project → Authentication → URL Configuration
- Add to **Redirect URLs:**
  ```
  https://kodaly-master-copy-studio.netlify.app/**
  http://localhost:5199/**
  ```
- Save

**Why:** Shared Supabase project has Site URL = rainbro. Kodály domain not whitelisted, so OAuth callbacks redirect to rainbro instead.

### ⚠️ **Print Transform Reset (LIKELY FIXED)**
**Status:** Fixed in latest build
- Issue: Zoom wrapper (`transform: scale()`) prevented page breaks
- Fix: Print CSS now resets transform with `!important`
- Test: Long songs should now paginate across pages

**To verify:** User should hard-refresh production, load a 3+ line song, Ctrl+P, check page counter shows "Page 1 of 2"

### ⚠️ **Responsive Tailwind Classes**
**Status:** Deployed, needs verification on desktop
- Mobile view (375px): simplified guide, no toggle buttons ✅
- Desktop view (≥ 768px): should show full guide + toggle buttons
- Potential issue: Tailwind `md:hidden` / `md:block` classes may not compile correctly

**To verify:** Load production on desktop, scroll to "Notation & Content", should see toggle buttons + full guide

---

## File Structure

```
kodaly-master-copy-studio/
├── src/
│   ├── App.tsx                          # Main editor component
│   ├── index.css                        # Print CSS + global styles
│   ├── components/
│   │   ├── Login.tsx                    # Auth UI
│   │   ├── LibraryPanel.tsx             # Song library drawer
│   │   ├── DocumentPreview.tsx          # Stick notation renderer
│   │   ├── MelodicContentSelector.tsx   # Tone set picker
│   │   └── FormInput/FormSelect.tsx     # Reusable form components
│   ├── lib/
│   │   ├── stickParser.ts               # Notation parsing + ABC generation
│   │   ├── songLibrary.ts               # Supabase CRUD
│   │   ├── absorbSong.ts                # Absorb client
│   │   └── supabaseClient.ts            # Supabase config
│   ├── context/
│   │   └── AuthContext.tsx              # Session management
│   └── types.ts                         # TypeScript interfaces
├── netlify/
│   └── functions/
│       └── extract-song.mjs             # Claude extraction endpoint
├── supabase/
│   └── add_master_copy_data.sql         # Migration: add JSONB column
├── index.html
├── netlify.toml                         # Build config
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## Environment Variables (Netlify)

Required `.env` for dev, auto-set in Netlify:
```
VITE_SUPABASE_URL=https://[project].supabase.co
VITE_SUPABASE_ANON_KEY=[anon public key]
ANTHROPIC_API_KEY=[Claude API key]
SUPABASE_URL=[same as VITE_SUPABASE_URL]
SUPABASE_ANON_KEY=[same as VITE_SUPABASE_ANON_KEY]
```

---

## How to Resume in Next Session

1. **Check Supabase redirect config** (user must have done this)
2. **Test on production:**
   - Mobile: https://kodaly-master-copy-studio.netlify.app on phone/mobile viewport
   - Desktop: Load on desktop, check notation section has full guide + toggle buttons
   - Print: Long song (3+ lines), Ctrl+P, verify pagination

3. **If issues remain:**
   - Print pagination: Check `src/index.css` for `@media print` transform reset
   - Responsive classes: Rebuild with `npm run build`, check Tailwind config
   - Auth redirect: Confirm Supabase URL allowlist is set

4. **When ready to expand:**
   - Document expected user behavior for trial period (end date, export mechanism)
   - Consider adding analytics (who's using it, which features)
   - Plan replication/funding strategy (out of scope for now)

---

## Git Log (Recent)

```
61a4b2a fix: reset zoom transform for print so long songs paginate
[mobile responsive] feat: mobile-responsive layout for transcription
[redirect fix] fix: sign-up confirmation emails redirect back to this app
[branding] feat: Rainbow Heart Studio branding + Absorb auth lock
[absorb] feat: Absorb — scan/paste songs, extract with Claude
[library] feat: Song library with autosave
[notation] feat: Stick notation overhaul (barlines, rests, pickup, beaming)
```

---

## Quick Reference: Key Decision Points

| Decision | Rationale |
|----------|-----------|
| Shared Supabase project | Cost savings; reuses rainbro's auth system |
| Stick notation (not visual UI) | Kinesthetic for music teachers; portable text |
| Autosave + localStorage | AuDHD requirement: 100% reliable, never lose work |
| Free trial only | Maintenance burden; intent is to replicate later with funding |
| Mobile-first on small screens | Friend using mobile exclusively; transcription ≠ complex editing |
| Claude Opus for Absorb | Highest accuracy for structured extraction (older typeset books) |

---

**Ready to hand off.** Pick this up in next session by verifying the Supabase redirect and testing on mobile/desktop production. 🎵
