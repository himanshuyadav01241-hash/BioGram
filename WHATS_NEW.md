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
