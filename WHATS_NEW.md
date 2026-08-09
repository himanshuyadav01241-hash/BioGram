# BioGram — What's New

## Bugs fixed
- **Admin table avatars were broken.** The admin panel read `user.avatar`, but avatars are actually stored as `photoURL`. Fixed, with a Dicebear fallback instead of the now-defunct `via.placeholder.com`.
- **"Custom Photo Widgets" field did nothing.** It existed in the editor but was never read, saved, or rendered. Replaced with a fully working **Custom Link Widgets** feature (title + image + link, multiple allowed).
- Removed an orphaned, unused `js/studio.js` that wasn't linked from any page.

## Mobile layout: drag → reorder
On desktop, unlocking still lets you freely drag widgets anywhere (unchanged). On **mobile**, dragging doesn't make sense for a stacked column, so there's now a dedicated **Reorder** button in the bottom bar: tap it, then use the ▲▼ buttons that appear on each widget to move it up/down in the stack. Order is saved per-user (`widgetOrder` field) and synced back to the same layout on desktop's initial flex order.

## Collapsible "Customize Space" editor
The editor is now an **accordion** — Profile Info, Design & Theme, Time Widget, Integrations, Widget Content, Visibility, and Layout & Order each expand only when you tap them, instead of one long scrolling form. Much faster to use on mobile.

## New widgets
- **QR Code** — auto-generated code linking straight to the profile.
- **Countdown Timer** — live-updating countdown to any date/time, with a custom title.
- **Custom Link Widgets** — add unlimited (Pro) or limited (Free) image+link cards.

## BioGram Pro — lifetime membership (₹ INR)
A one-time-payment membership unlocks:
- Exclusive **Gradient** and **Neon** glass themes
- Custom **accent color** picker
- Unlimited gallery images & custom widgets (free tier is capped, admin-configurable)
- Animated background particles
- No "Made with BioGram" badge on the public space
- A gold crown badge next to the name on profiles & the leaderboard

**Setup:** Admin Panel → *Membership & Monetization* → set the lifetime price, your Razorpay Key ID, and toggle payments on. Until you configure Razorpay, upgrade buttons fall back to a mailto link so users can request manual activation — and admins can always grant/revoke Pro per-user from the user table regardless.

⚠️ **Important:** This project has no backend/serverless function. The Razorpay success handler optimistically grants Pro access client-side. Before accepting real payments in production, verify the payment server-side (e.g. a Cloud Function webhook) before trusting `isPremium` — see the comment in `js/membership.js`.

## Expanded admin controls
- Grant/Revoke Pro membership per user
- Pro member count & estimated lifetime revenue stat cards
- Configurable free-tier limits (gallery images, custom widgets)
- CSV export of all users

## New Firestore fields
- `users/{uid}`: `isPremium`, `membershipType`, `premiumSince`, `lastPaymentId`, `grantedByAdmin`
- `users_spaces/{uid}`: `accentColor`, `bgParticles`, `widgetOrder`, `customWidgets[]`, `showQr`, `showCountdown`, `showCustomWidgets`, `countdownTitle`, `countdownTarget`
- `system/config`: `membershipPriceINR`, `razorpayKeyId`, `paymentsEnabled`, `freeMediaLimit`, `freeCustomWidgetLimit`, `totalRevenuePaise`, `totalPremiumPurchases`

All fields default gracefully if missing, so this is safe to deploy over existing data.

## Cache-busting fix (Safari + Instagram in-app browser showing stale/broken layout)

If a deploy ever shows unstyled/overlapping content — usually old HTML paired with an
old cached CSS/JS file — that's a cache mismatch. Instagram's in-app browser is the
worst offender: its cache isn't user-clearable at all, so "clear your cache" only ever
worked for Safari.

**The fix:** every CSS/JS reference now carries a version query string,
e.g. `css/styles.css?v=20260809a` and `js/profile.js?v=20260809a`, including the
internal `import ... from "./firebase.js?v=20260809a"` statements between JS modules.
A version query string makes it a *new URL* to the browser, so it must fetch fresh
files — no cache to clear, on any browser, including Instagram's.

**On every future deploy: bump the version string everywhere it appears.** It must be
identical across all files in one deploy. Quick way to do it from the project root:

```bash
OLD="20260809a"
NEW="20260815a"   # pick something new each deploy — a date works well
grep -rl "v=${OLD}" --include="*.html" --include="*.js" . | \
  xargs sed -i "s/v=${OLD}/v=${NEW}/g"
```

The HTML documents themselves also got
`Cache-Control: no-cache, no-store, must-revalidate` meta tags as a second layer —
this helps normal browsers re-check the HTML on every load, but note in-app browsers
don't always honor `<meta>` cache directives, which is exactly why the query-string
approach on the assets is the part that actually guarantees a fix everywhere.

If you have any control over your host's HTTP response headers (check wasmer.app's
dashboard/docs), the most robust setup is: `Cache-Control: no-cache` on the `.html`
files, and `Cache-Control: public, max-age=31536000, immutable` on the versioned
`.css`/`.js` files — but the query-string versioning above works even without that.

## QR widget fix + made Pro-only

**Bug:** the QR widget built its link from `window.location.href`, so if the page was
ever served through a local/dev/preview layer, the QR baked in an address like
`127.0.0.1` — unreachable from any other device, and easy to mistake for "it's showing
the same/wrong profile."

**Fix:** QR codes now resolve through a new admin-configurable **Public Site URL**
(Admin Panel → Membership & Monetization → *Public Site URL*). Set it once to your real
domain (e.g. `https://biogram.wasmer.app`) and every QR code will point there
regardless of what environment the page happens to be loaded from. If that field is
left blank and the page detects it's being viewed from a loopback address
(`127.0.0.1`/`localhost`), the widget now shows a clear "set your Public Site URL"
message instead of silently generating a broken code.

**Also made QR a BioGram Pro perk** — gated the same way as accent colors and
background particles: hidden and locked for free users (with an upgrade prompt on
click), and enforced again at save time so it can't be toggled on by tampering with
the checkbox.

New `system/config` field: `siteBaseUrl`.

## Profile rank badge showing the wrong number

**Bug:** the "PROFILE RANK" widget read a `rank` field from the user's document —
but nothing in the app ever computed or wrote that field. Every profile silently
fell back to showing `#1` unless a `rank` value happened to exist in Firestore from
earlier manual testing, in which case it showed that stale, never-updated number
forever (regardless of actual standing). This is what caused a profile with the
#1 view count to show `#2`.

**Fix:** rank is now computed live on each page load — same eligibility rules as
the leaderboard (excludes banned / leaderboard-hidden profiles), sorted by views
descending, then finds the profile's position in that list. No stored field to go
stale.

## Modal close buttons not clickable on mobile

**Bug:** on mobile, `.floating-actions-bar` (the bottom "Locked / Reorder /
Customize Space" bar) had `z-index: 10000 !important` — higher than *every* modal
in the app, including the Customize Space editor (was `9999`) and the Membership
modal (was `5000`). Wherever the floating bar visually overlapped an open modal,
it silently ate the clicks meant for the modal underneath — including close buttons.

**Fix:** modals are now unambiguously on top: the editor modal is `50000` and the
membership modal is `60000`, both well above the floating action bar. Modals will
never again be visually or interactively "under" the bottom toolbar.

## Membership upgrade button ignoring newly-saved Razorpay settings

**Bug:** `system/config` (price, Razorpay key, payments-enabled toggle) was cached
in memory the first time it was read on a page. If an admin saved new settings in
the Admin Panel while a user already had the site open, that user's Upgrade button
kept using the stale cached config — meaning it looked like the Razorpay key
"wasn't taking," when really it just hadn't been re-fetched yet.

**Fix:** the membership modal now force-refreshes config every time it opens, so a
freshly-saved Razorpay key/price/toggle takes effect on the very next click —
no page reload required.

## Support email had no admin control

There was no way to actually set the support/contact email shown on the manual
upgrade fallback — it was hardcoded. Added **Support Contact Email** to Admin Panel
→ Membership & Monetization. New `system/config` field: `contactEmail`.

## QR: "Show QR" quick view

Tapping the QR widget (BioGram Pro) now opens a large, high-contrast fullscreen
view — meant for holding your phone up to someone to scan in person — with a clear
close button. Desktop behavior is unchanged otherwise; it's the same widget, just
bigger on tap there too.

## Mobile: QR widget replaced with a share icon

On mobile, the QR card no longer takes up space in the widget stack. Instead, a
small round QR icon now sits fixed at the top-right of the screen (mirroring the
audio control on the top-left) — tap it any time to bring up the same large,
easy-to-scan fullscreen view for showing your profile to someone in person.
Desktop is unchanged: QR still shows as a normal widget there, and tapping it opens
the same fullscreen view.

The icon respects the exact same rules as before — only appears when the space
owner is Pro, has QR enabled, and a reliable Public Site URL is configured.

## Landscape mobile: broken layout + drag not working

**Bug:** "mobile mode" was detected with `window.innerWidth <= 600` only. A phone
in landscape is usually 700-900px wide, so it failed that check and got treated as
desktop — which rendered widgets at their absolute desktop drag coordinates
(overlapping/cut off on a small landscape screen) while simultaneously disabling
drag, since drag only ever listened for mouse events, never touch. Landscape phones
were stuck in the worst combination of both modes.

**Fix:**
- `isMobile()` now also treats a touch device with a short viewport height
  (≤600px) as mobile, regardless of width — correctly catching landscape phones
  without affecting a short desktop browser window (which lacks touch).
- The matching CSS media query was updated the same way, using
  `(pointer: coarse)` to distinguish a touch device from a resized desktop window.
- Added an `orientationchange` listener alongside the existing `resize` listener,
  since iOS Safari can fire `resize` late or inconsistently right after a rotation.

Net effect: landscape phones now get the same stacked layout + Reorder button
flow as portrait, instead of a broken absolute layout with no working drag.
