# PRD — Εφαρμογή Αυτόνομης Ρουτίνας για Παιδιά στο Φάσμα

## Vision
A calm, supportive tablet app that shifts parents from "taskmaster" to "observer" and gives autistic children a predictable, visual-first daily routine.

## MVP Scope (Completed)
- **Dual Mode**: Child Mode (linear task flow, minimalist) + Admin Mode (routine builder, PIN-protected)
- **Parental Gate**: Gear icon → long-press 3s → 4-digit PIN pad (default **1234**)
- **Preloaded Templates** (seeded on first boot):
  - Πρωινό / Morning (6 steps)
  - Δραστηριότητες στο Σπίτι μετά το σχολείο / After-school (6 steps incl. Choice Board)
  - Ύπνος / Bedtime (5 steps incl. Choice Board)
- **Choice Boards**: up to 3 calming options, no timer; confirmation screen on select
- **SOS Help Button**: always visible in Child Mode → locks tablet on "notified" screen, creates SOS event, surfaced via Admin banner with Resolve action (**MOCKED — no real push/email/SMS**)
- **Admin Routine Builder**: edit bilingual names, add/reorder/delete steps, switch task↔choice, upload/pick images
- **Asset Library**: base64 images (offline-first), upload once, reuse across routines
- **i18n**: Greek ↔ English toggle (cached via AsyncStorage + backend settings)
- **Low-Arousal Design**: muted earthy palette (#FDFBF7 / #8BA888 / #D98A6C), no shadows in Child Mode, 88pt touch targets, no countdown timers, Ionicons only (no emojis)

## Architecture
- **Backend**: FastAPI + MongoDB (collections: `routines`, `assets`, `sos_events`, `settings`); auto-seed on startup
- **Frontend**: Expo SDK 54 + expo-router (file-based routing); React Native StyleSheet
- **Storage**: offline-first; images as base64 data URIs

## API (all `/api/...`)
- Routines: GET/POST `/routines`, GET/PUT/DELETE `/routines/{id}`
- Assets: GET/POST `/assets`, DELETE `/assets/{id}`
- SOS: POST `/sos`, GET `/sos/active`, POST `/sos/{id}/resolve`, GET `/sos`
- Settings: GET/PUT `/settings`, POST `/settings/verify-pin`
- Seed: POST `/seed` (idempotent)

## Known Mocks
- **SOS delivery**: events stored in MongoDB only; no email/SMS/push. Parent sees it via Admin "Ενεργό αίτημα βοήθειας" banner.

## Next Iteration Candidates
- Real push notifications (Expo Push / SendGrid / Twilio) for SOS
- Drag handle gesture reorder (currently up/down arrows)
- Audio assets (favourite songs) for Choice Board
- Confirmation screen with parent voice note (positive reinforcement)
- Daily streak / completion history (business insight)
