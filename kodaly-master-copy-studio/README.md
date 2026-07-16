# Kodály Master Copy Studio

Split-pane editor for creating print-ready Kodály-style folk song master copies.
Songs save automatically to the shared studio Supabase project (`kodaly_songs`
table — the same catalog rainbro's Study Room reads).

## Features

- **Stick notation** renderer: auto-measured bars from the time signature,
  eighth/sixteenth beaming, repeat barlines
- **Standard notation** via abcjs, with one-click stick → ABC conversion
- **Print-faithful preview**: 8.5×11 page, repeating header/footer, page numbers
- **Song library**: autosave as you type, search, master-copy completeness
  checkmark (all 8 required elements, derived automatically from content)
- **Offline safety net**: the working document mirrors to localStorage; if a
  cloud save fails you're offered a restore on next launch
- JSON export/import per song

## Development

```bash
npm install
cp .env.example .env   # fill in Supabase URL + anon key (same project as rainbro)
npm run dev
```

## Database

Uses the existing `kodaly_songs` table (schema in rainbro's
`supabase/kodaly_songs.sql`) plus one column added by
[supabase/add_master_copy_data.sql](supabase/add_master_copy_data.sql) —
run that once in the Supabase SQL Editor.

## Deploy (Netlify)

1. Push to GitHub, connect the repo in Netlify
2. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in
   Site → Environment Variables
3. Build settings come from `netlify.toml`
4. For Google login on the deployed site, add the Netlify URL to the
   Supabase Auth redirect allowlist (email/password works without this)
