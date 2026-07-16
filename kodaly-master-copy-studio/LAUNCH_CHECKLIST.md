# Launch Checklist — Kodály Master Copy Studio

**Current Status:** Deployed to production, classmates ready to sign up  
**Blocker:** Email signup returns a server error — run the diagnostic below to get the status code  
**Auth mode:** Email auto-confirm is **ON** (no confirmation emails; signup logs you straight in). Google OAuth redirect verified working. Supabase URL allowlist done.

---

## 🔴 CRITICAL — Must Do Before Classmates Sign Up

- [ ] **Supabase URL Allowlist**
  - Go: Supabase dashboard → your project → **Authentication → URL Configuration**
  - Add to **Redirect URLs:**
    ```
    https://kodaly-master-copy-studio.netlify.app/**
    http://localhost:5199/**
    ```
  - Click **Save**
  - Why: Without this, Google OAuth and email confirmation links bounce to rainbro

---

## ✅ VERIFY After Supabase Fix

- [ ] **Test Email Sign-Up (Production)** — *auto-confirm is ON, so there is no email step*
  - Go: https://kodaly-master-copy-studio.netlify.app
  - Switch to **"Sign up"** tab
  - Enter test email + password
  - Should be signed in immediately (no confirmation email is sent)
  - ⚠️ **Known bug (open):** signup currently returns a server error. Run the diagnostic:
    1. Open DevTools → Console before submitting
    2. Read the line `[auth] signup { status, code, … }`
    3. **500** = DB error saving user (check Supabase → Logs → Postgres) · **429** = rate limit · **422** = validation

- [x] **Test Google Sign-Up (Production)** — redirect to Google verified working
  - Click **"Continue with Google"** → redirects to Google sign-in (not rainbro) ✅

- [ ] **Mobile Responsiveness (Production)**
  - Open: https://kodaly-master-copy-studio.netlify.app on phone or mobile browser
  - Should see:
    - Simplified notation guide ("Format: Line 1...")
    - Big textarea for stick notation
    - Library + Absorb buttons visible
    - No toggle buttons or full guide
  - Tap on notation textarea → should be able to type

- [ ] **Desktop Notation Section (Production)**
  - Open: https://kodaly-master-copy-studio.netlify.app on desktop (1200px+)
  - Scroll to "Notation & Content" section
  - Should see:
    - **Toggle buttons:** "Sticks on Page" + "Staff on Page"
    - **Full guide:** "Stick Notation Guide:" with bullet points
    - **NOT** the simplified mobile guide

- [ ] **Print Pagination (Production)**
  - Create/open a long song (3+ lines of stick notation)
  - Press **Print** button or Ctrl+P
  - In print preview, scroll through pages
  - Should see **Page 1 of 2** (or more) at bottom
  - NOT crammed into one page with scrollbar

---

## 🎯 READY TO SHARE (After Above Pass)

- [ ] Share link with classmates: https://kodaly-master-copy-studio.netlify.app
- [ ] Let them know:
  - **Free for trial period** (how long?)
  - **Auto-saves to the cloud** as they type
  - **On mobile:** Type stick notation, tap Library to browse
  - **On desktop:** Absorb feature (scan songbook pages)
  - **Print function** to export master copies
  - **Export to JSON** for backup

- [ ] Set expectations:
  - This is a **community trial**, not production SaaS
  - Data will persist (backed up to cloud)
  - No analytics/logging of who's using it
  - Will be shut down after trial unless funded

---

## 📋 OPTIONAL Nice-to-Haves (Post-Launch)

- [ ] Add "Trial expires on [DATE]" banner to app
- [ ] Document export workflow (how to print/download)
- [ ] Add FAQ or help button (point to Guide text)
- [ ] Monitor usage: who's signed up, what songs created, Absorb success rate
- [ ] Collect feedback from teachers (what worked, what's confusing)

---

## 🚀 If Anything Breaks

### Email/Google Login Still Bounces to Rainbro
- [ ] Verify Supabase redirect URLs are saved
- [ ] Try incognito/private window (clear cache)
- [ ] Check Supabase project → Settings → General → confirm Site URL is still rainbro
- [ ] Hard-refresh production: Ctrl+Shift+R

### Print Still Shows Scrollbar (One Page)
- [ ] Hard-refresh production
- [ ] Check browser: DevTools → Print Preview (Ctrl+P), scroll check page count
- [ ] If still broken: `src/index.css` line ~78 has print CSS reset; verify `transform: none !important;` is there

### Responsive Classes Not Working (Seeing Mobile Guide on Desktop)
- [ ] Hard-refresh production
- [ ] Open DevTools → Resize to 1200px
- [ ] Should see toggle buttons + full guide (not simplified)
- [ ] If still broken: rebuild locally `npm run build`, redeploy `npx netlify deploy --prod --dir dist`

---

**Once all checkboxes pass, you're ready to invite your friend and her classmates.** 🎵
