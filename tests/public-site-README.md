# Public website isolated review

Candidate: `website-lessons-preview-20261009`; base `36bc2fe35857c85f0c5fc5f483c919eabd305bf6`.
Local preview only. Do not run the ordinary production-connected dev entry for interactive review.

From this checkout, using existing installed dependencies:

```powershell
npx vite --config tests/public-site-vite.config.mjs
```

Open http://127.0.0.1:5189/. Strict loopback port 5189 must be free. The preview uses real public components, a mock no-user AuthContext, and fixture stops for actual tool routes. It loads no environment file or production auth/data modules. External links, mailto, and tel links are intercepted. Forms are blocked in capture and CSP, non-read requests are rejected, and the Facebook frame is replaced locally. No emails or credentials should be submitted.

After opening Home/Tools so the module graph is populated:

```powershell
node --test tests/public-site-contract.test.mjs tests/songbook.test.mjs
npm run build
node C:/Users/John/.codex/skills/rainbowheart-os/validation/validate-system.mjs .
git diff --check
```

Five public boundary checks and four existing regression checks passed. Build passed with the existing chunk-size warning; OS/metadata validation passed.

Use fixture buttons to stress 200% computed text, long card titles, and force the exact production reduced-motion CSS rules. These are test fixtures, not native browser zoom or OS preference emulation. The review banner is test-only. Public HTML files with isolated routes are not production entry points.

Rendered evidence covers Home/Tools at 390x844, 768x1024, 1024x768, 1440x900, normal and enlarged text plus long labels. No horizontal overflow, undersized displayed public targets, or badge/title overlap was found in the final measurements. Keyboard skip/focus/disclosure/Escape checks and 12 distinct catalog destination fixtures passed. Email links were captured without delivery; cross-page hash links and route scroll reset passed. Login copy rendered without account operations.

`public-site-evidence/review-results.json` contains sanitized measurements, focus/route evidence, and known development errors. Screenshots show desktop/phone and enlarged mobile menus. Development iframe-transform ordering and duplicate React root HMR issues were corrected; a fresh final browser tab reported no console errors. A forced reduced-motion check does not establish native preference support across browsers.

Not tested: actual tool runtimes, external service health, real login/signup, mailbox delivery, physical devices, native 200% browser zoom, native reduced-motion preference, other browsers, or assistive technology. No real private records were used.

Production integration: this base already imports Tools and has `/tools` in App.jsx. No route change is needed on this base. App.jsx was left unchanged for sequential coordinator integration. Never replace concurrent Performance routing with this checkout wholesale.

The exact candidate commit and changed paths are in the dispatch WEBSITE_HANDOFF.md outside this repository. No publication, design phase advancement, or owner acceptance is implied.
