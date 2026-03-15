# Clover

**Clover** is a PCOS early detection and patient advocacy web app for Canadian women. It helps users build a structured symptom profile, generate clinical documentation for their GP, track their cycle, find nearby care providers, and advocate for themselves if dismissed by a doctor.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React (Vite), inline styles + CSS custom properties |
| Animations | GSAP (card particles/ripples), OGL WebGL (Aurora background) |
| Charts | Recharts |
| Backend | FastAPI (Python) |
| AI | Claude Sonnet (`claude-sonnet-4-6`) via Anthropic SDK |
| Location | Google Places API (New) |
| Calendar | Google Calendar API (OAuth 2.0) |

---

## Features

### Symptoms — Build Your Case
- 11 symptom categories (~120 symptoms) presented in a swipeable carousel
- Gradient progress bar + scrollable pill-dot navigation
- Summary tray shows all selected symptoms with one-click deselect
- On submit, calls `/api/analyse` to get:
  - **Case Strength** score (0–100) with visual progress bar
  - **Rotterdam Criteria** assessment (Menstrual Irregularity, Hyperandrogenism, Polycystic Ovaries) — each flagged as Detected / Possible / Not flagged
  - **Clinical Flags** — 1–3 observations worth raising with a doctor
  - **Urgency** badge (Low / Medium / High)
- Results saved to `localStorage` for use by other tabs

### Report — Clinical Documentation
- Visual dashboard: SVG arc gauge (case strength), glass Rotterdam criteria cards, per-category symptom bars
- AI-generated 5-section clinical report (Patient Overview, Symptom Timeline, Rotterdam Assessment, Passive Health Data Analysis, Clinical Recommendations)
- One-click copy of full report text
- Includes passive health data context (cycle length, sleep, HRV, weight trend)

### Find Care — AI-Ranked Nearby Providers
- Requests browser geolocation
- Searches Google Places for nearby GPs, gynecologists, and diagnostic labs
- Claude ranks results by specialty relevance to the patient's case profile
- Sidebar: AI-recommended test panel (e.g. Testosterone, LH/FSH, AMH, HbA1c)
- Google Calendar integration: connect Google Calendar, check slot availability, and book an appointment directly from the app

### Cycle Tracker
- Log period days by tapping a calendar grid
- Running stats: last period date, average cycle length, days until next period
- AI-generated personalised PCOS wellness suggestions based on logged data

### Health Data
- Displays passive health metrics (Apple Health integration placeholder)
- Metrics: cycle length, sleep hours, HRV, weight trend, step count, resting heart rate

### If Dismissed — Patient Advocacy Toolkit
- One-click AI-generated formal second opinion letter (references Rotterdam Criteria, requests referral)
- Copy-to-clipboard
- 5-step escalation guide
- Ontario PCOS specialist directory (illustrative)
- Patient rights reference card

---

## Backend API

| Method | Route | Description |
|---|---|---|
| GET | `/api/health` | Health check |
| POST | `/api/analyse` | Analyse symptoms → case strength + Rotterdam criteria |
| POST | `/api/report` | Generate 5-section clinical report |
| POST | `/api/letter` | Generate second opinion letter |
| POST | `/api/cycle/suggestions` | AI cycle wellness suggestions |
| POST | `/api/places/search` | Google Places text search with haversine distance |
| POST | `/api/agent/rank` | Claude ranks/classifies places for PCOS care |
| GET | `/api/calendar/auth` | Redirect to Google OAuth consent |
| GET | `/api/calendar/callback` | Exchange auth code for access token |
| POST | `/api/calendar/check` | Check if a time slot is free |
| POST | `/api/calendar/book` | Book a calendar event |
| POST | `/api/calendar/free-slots` | Find next 3 free weekday slots within 14 days |

---

## Environment Variables

Create `backend/.env`:

```env
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:8000/api/calendar/callback
GOOGLE_PLACES_API_KEY=...
FRONTEND_URL=http://localhost:5173
```

---

## Local Setup

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install fastapi uvicorn anthropic httpx python-dotenv
uvicorn main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

---

## Architecture Notes

- **Aurora background**: Fixed WebGL canvas rendered via OGL (outside the app shell in the React tree to avoid stacking context issues). Uses a GLSL simplex-noise fragment shader with blue/lavender colour stops.
- **Glass cards**: All `.card` elements use `rgba(255,255,255,0.42) + backdrop-filter: blur(18px)` so the aurora shows through globally.
- **Magic card effects**: A global `useMagicCards` hook attaches to every `.card` via MutationObserver — GSAP particle bursts on hover, click ripple, and a CSS `--mx`/`--my` directional border glow.
- **Shared symptom data**: `frontend/src/data/symptoms.js` is the single source of truth for the 11 symptom categories, imported by both the Symptoms carousel and the Report category bars.
- **localStorage bridge**: Symptoms, criteria state, and case strength are persisted to `localStorage` so Report, Find Care, and If Dismissed can read them without prop drilling.

---

## Disclaimer

Clover is a symptom tracking and documentation tool. It does not provide medical diagnoses. All AI-generated content is intended to support — not replace — clinical consultation with a qualified healthcare provider.
