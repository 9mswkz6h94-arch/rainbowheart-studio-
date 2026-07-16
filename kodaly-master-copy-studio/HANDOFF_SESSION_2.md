# Kodály Master Copy Studio — Project Handoff

## Mission & Purpose
A free, community-focused tool for transcribing and documenting old/disappearing Kodály folk song collections before they go out of print. Allows teachers to capture songs from physical books via OCR (Absorb feature) or manual stick notation entry, store them in a shared cloud library, and print/export as formatted master copies.

**Status:** Beta-ready. Mobile-responsive, fully functional, deployed to production at https://kodaly-master-copy-studio.netlify.app

---

## Quick Context

### What We Just Did
1. **Mobile-responsive layout:** Sidebar stacks vertically on phones, preview hidden, notation textarea is the focus
2. **Print pagination fix:** Removed zoom transform so long songs flow to multiple pages correctly
3. **Barline fix (latest):** Removed opening barlines on each staff line; now only barlines between measures show
4. **Branding:** Rainbow Heart Studio stripe, credit footer

### User (Teacher) Feedback Implemented
- ✅ "Can we remove the option to see behind the curtain in the staff notation view?" → Removed ABC editing UI, kept staff auto-render
- ✅ "No barlines at the start of each line, but I like the ones in between" → Fixed today
- ✅ "Can my classmates sign up to use this?" → Supabase auth with row-level security
- ✅ "I need a mobile version for transcription" → Mobile-responsive layout shipped

### Still To Do
- Verify Supabase redirects work (teacher said they did it, but test the full sign-up flow)
- Beta test with classmates (sign-up, Absorb scanning, printing)

---

## Tech Stack (One-line summary)
React 18 + Vite + Tailwind (frontend) → Supabase auth/PostgreSQL (backend) → Netlify Functions (Claude API Absorb) → Netlify hosting

---

## File Locations & Key Code

### Main Editor
- `src/App.tsx` — autosave loop (1.2s debounce), state management, all forms
- `src/components/DocumentPreview.tsx` — staff + stick renderer, print CSS
- `src/components/Login.tsx` — email/Google auth

### Stick Notation Parser (The Brain)
- `src/lib/stickParser.ts` — Parses plaintext `rhythm/solfa/lyrics` blocks into measures, beats, beams. Exports `stickToABC()` for staff rendering.

### Cloud & Auth
- `src/lib/songLibrary.ts` — Supabase CRUD, autosave, draft recovery
- `netlify/functions/extract-song.mjs` — Claude Vision songbook extraction

### Styling & Print
- `src/index.css` — Print CSS (resets transforms, hides UI, repeats headers/footers), rainbow stripe branding

---

## Database
**Single table:** `kodaly_songs` (shared with rainbro Study Room)
- `master_copy_data` (jsonb) — full SongData document
- `mc_*` boolean columns — auto-derived checklist flags (title_caps, rsp_ssp, tone_set, stick, solfa, words, game_directions, source, complete)
- Row-level security — users see only their own songs

---

## How to Use It (As Your Friend Would)

1. **Sign in:** Email/password or Google
2. **New song:** Tap Library → New
3. **Type stick notation** (or Absorb from book):
   ```
   8 8 4
   s s m
   _Ap_ple _tree,
   ```
   (Line 1: rhythm, Line 2: solfa, Line 3: lyrics with _ prefix)
4. **Autosaves** every 1.2s to the cloud
5. **Print (desktop):** Ctrl+P, staff auto-renders
6. **Export:** JSON for backup

---

## Latest Deployed Commit
- **Barline fix:** Removed line-opening barlines, kept only measure-closing barlines (between measures)
- Deployed to production: https://kodaly-master-copy-studio.netlify.app

---

## What Needs Checking in Next Session

1. **Supabase redirects** — Test full email sign-up flow (confirmation email should redirect to app)
2. **Classmate beta** — Have teacher invite one classmate, watch for sign-up/sync issues
3. **Absorb accuracy** — Upload 3-5 real songbook pages, check Claude's extraction
4. **Print output** — Print a long song (3+ pages), verify no layout surprises
5. **Mobile UX** — Test on actual phone (iPhone/Android), check touch responsiveness

---

## Env Vars & Secrets
Set in Netlify dashboard:
- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — Supabase anon key
- `ANTHROPIC_API_KEY` — Claude API key for Absorb

---

## Deploy Command
```bash
npm run build && npx netlify deploy --prod --dir dist
```

---

## One Known Issue
- **PitchHelper.tsx** — TypeScript error (SharedArrayBuffer type mismatch). Doesn't block build; esbuild succeeds. Low priority.

---

## Contact & Rollout
- Teacher: Jonathan Owens (user of this chat)
- Classmates: Will sign up via https://kodaly-master-copy-studio.netlify.app (trial period, free)
- Goal: Community tool, no long-term maintenance, potential future funding/replication
