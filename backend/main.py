from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from typing import Optional
import anthropic
import httpx
import os
import json
import math
from urllib.parse import urlencode
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))
MODEL = "claude-sonnet-4-6"


# ── REQUEST MODELS ─────────────────────────────────────────────────────────────

class CaseRequest(BaseModel):
    symptoms: list[str]
    anything_else: Optional[str] = ""
    notes: Optional[str] = ""


class ReportRequest(BaseModel):
    symptoms: list[str]
    anything_else: Optional[str] = ""
    notes: Optional[str] = ""
    criteria_state: Optional[dict] = {}


class LetterRequest(BaseModel):
    symptoms: list[str]
    notes: Optional[str] = ""


class CycleSuggestionRequest(BaseModel):
    period_days: Optional[list[str]] = []
    average_cycle_length: Optional[int] = None
    common_symptoms: Optional[list[str]] = []
    notes: Optional[str] = ""


class CalendarCheckRequest(BaseModel):
    token: str
    datetime_iso: str
    duration_minutes: Optional[int] = 60


class CalendarBookRequest(BaseModel):
    token: str
    datetime_iso: str
    duration_minutes: Optional[int] = 60
    doctor_name: str
    doctor_address: Optional[str] = ""
    notes: Optional[str] = ""


class PlacesSearchRequest(BaseModel):
    lat: float
    lng: float
    query: str
    radius: Optional[int] = 15000


class AgentRankRequest(BaseModel):
    case_state: dict
    places: list


class FreeSlotsRequest(BaseModel):
    token: str
    days_ahead: Optional[int] = 14
    slot_duration_minutes: Optional[int] = 60


def _strip_json_fences(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    return text.strip().rstrip("```").strip()


# ── HEALTH CHECK ───────────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    return {"status": "ok", "model": MODEL}


# ── ANALYSE CASE ───────────────────────────────────────────────────────────────

@app.post("/api/analyse")
def analyse_case(req: CaseRequest):
    symptom_list = ", ".join(req.symptoms) if req.symptoms else "none selected yet"
    anything = req.anything_else or ""
    notes = req.notes or ""

    prompt = f"""You are a PCOS clinical detection agent. Analyse this patient's symptom profile and return a JSON object only — no other text.

Patient-reported symptoms: {symptom_list}
{f"Additional concerns: {anything}" if anything else ""}
{f"Patient notes: {notes}" if notes else ""}

Return exactly this JSON structure:
{{
  "caseStrength": <integer 0-100>,
  "criteriaState": {{
    "cycle": "<detected|possible|>",
    "androgen": "<detected|possible|>",
    "ovary": "<detected|possible|>"
  }},
  "summary": "<2-sentence plain-English summary of what the symptom profile suggests>",
  "urgency": "<low|medium|high>",
  "topFlags": ["<flag1>", "<flag2>"]
}}

Rules:
- caseStrength: 0-30 minimal signals, 31-60 moderate, 61-85 strong, 86-100 very strong
- criterion is "detected" if clearly met, "possible" if partially met, "" if no signals
- Irregular/missed/long cycles alone = cycle detected. Any 2 of acne/facial hair/hair thinning = androgen detected.
- topFlags: 1-3 short clinical observations worth flagging to a doctor"""

    message = client.messages.create(
        model=MODEL,
        max_tokens=500,
        messages=[{"role": "user", "content": prompt}]
    )

    text = _strip_json_fences(message.content[0].text)
    try:
        return json.loads(text)
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to parse AI response")


# ── GENERATE REPORT ────────────────────────────────────────────────────────────

@app.post("/api/report")
def generate_report(req: ReportRequest):
    symptom_list = ", ".join(req.symptoms) if req.symptoms else "Various hormonal symptoms"
    anything = req.anything_else or ""
    notes = req.notes or ""
    criteria = req.criteria_state or {}

    criteria_summary = ""
    if criteria:
        criteria_summary = f"""
Known Rotterdam criteria assessment so far:
- Menstrual irregularity: {criteria.get('cycle', 'not assessed')}
- Clinical/biochemical hyperandrogenism: {criteria.get('androgen', 'not assessed')}
- Polycystic ovaries: {criteria.get('ovary', 'not assessed')}"""

    prompt = f"""You are a clinical documentation specialist generating a PCOS symptom report for a Canadian patient's GP.

Patient-reported symptoms: {symptom_list}
{f"Additional concerns (patient's own words): {anything}" if anything else ""}
{f"Patient notes: {notes}" if notes else ""}
{criteria_summary}
Passive health data (Apple Health): Average cycle 38 days, sleep 5.8 hrs/night, HRV 22ms (below average), weight +2.4kg over 30 days.

Write exactly these 5 sections with these exact labels:

SECTION 1 — PATIENT OVERVIEW
A 3-sentence clinical summary of this patient's presentation.

SECTION 2 — SYMPTOM TIMELINE AND PATTERNS
Detailed symptom analysis using clinical language. Group by system: menstrual, androgenic, metabolic.

SECTION 3 — ROTTERDAM CRITERIA ASSESSMENT
Map each reported symptom to the 3 Rotterdam criteria explicitly. State which are met, possibly met, or require further investigation. Note that 2 of 3 criteria are required for a PCOS diagnosis.

SECTION 4 — PASSIVE HEALTH DATA ANALYSIS
Clinical interpretation of the Apple Health metrics in the context of PCOS.

SECTION 5 — CLINICAL RECOMMENDATIONS
List specific tests with brief rationale: total and free testosterone, LH/FSH ratio (day 3 of cycle), fasting insulin, HbA1c, thyroid panel (TSH, free T3, free T4), AMH, vitamin D (25-OH), pelvic ultrasound. End with: This report does not constitute a medical diagnosis and is intended to support clinical discussion only.

Be specific, evidence-based, and formatted so a GP takes it seriously."""

    message = client.messages.create(
        model=MODEL,
        max_tokens=2000,
        messages=[{"role": "user", "content": prompt}]
    )

    return {"report": message.content[0].text}


# ── GENERATE LETTER ────────────────────────────────────────────────────────────

@app.post("/api/letter")
def generate_letter(req: LetterRequest):
    symptom_list = ", ".join(req.symptoms) if req.symptoms else "hormonal symptoms"
    notes = req.notes or ""

    prompt = f"""Write a formal, professional second opinion request letter from a Canadian patient to their family physician.

The patient has been tracking these PCOS symptoms: {symptom_list}.
{f"Additional context: {notes}" if notes else ""}
Their doctor did not order any testing at a recent appointment.

Requirements:
- Respectful but firm and assertive
- Reference the Rotterdam Criteria (2003) for PCOS diagnosis by name
- Request that all concerns are formally documented in the patient file
- Request a referral to an endocrinologist or gynecologist
- Mention the structured symptom documentation the patient has prepared
- Under 250 words
- Standard formal letter format: date placeholder, Dear Dr. [Name], paragraphs, Sincerely, [Patient Name]
- Do not include a diagnosis — this is a documentation and referral request only"""

    message = client.messages.create(
        model=MODEL,
        max_tokens=700,
        messages=[{"role": "user", "content": prompt}]
    )

    return {"letter": message.content[0].text}


# ── CYCLE SUGGESTIONS ──────────────────────────────────────────────────────────

@app.post("/api/cycle/suggestions")
def cycle_suggestions(req: CycleSuggestionRequest):
    avg = req.average_cycle_length
    symptoms = ", ".join(req.common_symptoms) if req.common_symptoms else "not specified"
    period_count = len(req.period_days) if req.period_days else 0
    notes = req.notes or ""

    prompt = f"""You are a PCOS wellness advisor. Based on this patient's cycle tracking data, provide personalised, evidence-based suggestions.

Cycle data:
- Period days logged this month: {period_count} days
- Average cycle length: {f"{avg} days" if avg else "not enough data yet"}
- Commonly logged symptoms: {symptoms}
{f"Patient notes: {notes}" if notes else ""}

Return a JSON array of exactly 5 personalised suggestions. Each must follow this structure:
[
  {{
    "category": "<nutrition|movement|sleep|stress|supplements|tracking>",
    "title": "<short title, 4-6 words>",
    "tip": "<2-3 sentence actionable advice specific to PCOS and this patient's data>",
    "urgency": "<low|medium>"
  }}
]

Return JSON only, no other text. Make suggestions specific to PCOS physiology, not generic wellness advice."""

    message = client.messages.create(
        model=MODEL,
        max_tokens=800,
        messages=[{"role": "user", "content": prompt}]
    )

    text = _strip_json_fences(message.content[0].text)
    try:
        return json.loads(text)
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to parse AI response")


# ── GOOGLE CALENDAR — AUTH ─────────────────────────────────────────────────────

@app.get("/api/calendar/auth")
def calendar_auth():
    params = {
        "client_id": os.environ.get("GOOGLE_CLIENT_ID", ""),
        "redirect_uri": os.environ.get("GOOGLE_REDIRECT_URI", ""),
        "response_type": "code",
        "scope": "https://www.googleapis.com/auth/calendar.events",
        "access_type": "offline",
        "prompt": "consent",
    }
    auth_url = "https://accounts.google.com/o/oauth2/auth?" + urlencode(params)
    return RedirectResponse(auth_url)


# ── GOOGLE CALENDAR — CALLBACK ─────────────────────────────────────────────────

@app.get("/api/calendar/callback")
async def calendar_callback(code: str = Query(...)):
    async with httpx.AsyncClient() as http:
        resp = await http.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": os.environ.get("GOOGLE_CLIENT_ID", ""),
                "client_secret": os.environ.get("GOOGLE_CLIENT_SECRET", ""),
                "redirect_uri": os.environ.get("GOOGLE_REDIRECT_URI", ""),
                "grant_type": "authorization_code",
            }
        )

    token_data = resp.json()
    access_token = token_data.get("access_token", "")
    if not access_token:
        raise HTTPException(status_code=400, detail="Failed to obtain access token from Google")

    frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:5173")
    return RedirectResponse(f"{frontend_url}/?calendar=connected#gcal={access_token}")


# ── GOOGLE CALENDAR — CHECK SLOT ───────────────────────────────────────────────

@app.post("/api/calendar/check")
async def calendar_check(req: CalendarCheckRequest):
    from datetime import datetime, timedelta, timezone

    # Parse the ISO datetime and compute end time
    try:
        start_dt = datetime.fromisoformat(req.datetime_iso)
        if start_dt.tzinfo is None:
            start_dt = start_dt.replace(tzinfo=timezone.utc)
        end_dt = start_dt + timedelta(minutes=req.duration_minutes)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid datetime format. Use ISO 8601.")

    headers = {"Authorization": f"Bearer {req.token}"}
    params = {
        "timeMin": start_dt.isoformat(),
        "timeMax": end_dt.isoformat(),
        "singleEvents": "true",
        "orderBy": "startTime",
    }

    async with httpx.AsyncClient() as http:
        resp = await http.get(
            "https://www.googleapis.com/calendar/v3/calendars/primary/events",
            headers=headers,
            params=params
        )

    if resp.status_code == 401:
        raise HTTPException(status_code=401, detail="Calendar token expired. Please reconnect.")
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail="Google Calendar API error")

    events = resp.json().get("items", [])
    is_free = len(events) == 0

    return {
        "free": is_free,
        "conflicts": [
            {
                "summary": e.get("summary", "Busy"),
                "start": e.get("start", {}).get("dateTime", ""),
                "end": e.get("end", {}).get("dateTime", ""),
            }
            for e in events
        ]
    }


# ── GOOGLE CALENDAR — BOOK ─────────────────────────────────────────────────────

@app.post("/api/calendar/book")
async def calendar_book(req: CalendarBookRequest):
    from datetime import datetime, timedelta, timezone

    try:
        start_dt = datetime.fromisoformat(req.datetime_iso)
        if start_dt.tzinfo is None:
            start_dt = start_dt.replace(tzinfo=timezone.utc)
        end_dt = start_dt + timedelta(minutes=req.duration_minutes)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid datetime format. Use ISO 8601.")

    event_body = {
        "summary": f"GP Appointment — {req.doctor_name}",
        "location": req.doctor_address,
        "description": (
            f"PCOS consultation booked via Clover.\n\n"
            f"Doctor: {req.doctor_name}\n"
            f"Address: {req.doctor_address}\n"
            + (f"\nNotes: {req.notes}" if req.notes else "")
        ),
        "start": {"dateTime": start_dt.isoformat(), "timeZone": "UTC"},
        "end": {"dateTime": end_dt.isoformat(), "timeZone": "UTC"},
        "reminders": {
            "useDefault": False,
            "overrides": [
                {"method": "email", "minutes": 1440},
                {"method": "popup", "minutes": 60},
            ],
        },
    }

    headers = {
        "Authorization": f"Bearer {req.token}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient() as http:
        resp = await http.post(
            "https://www.googleapis.com/calendar/v3/calendars/primary/events",
            headers=headers,
            json=event_body
        )

    if resp.status_code == 401:
        raise HTTPException(status_code=401, detail="Calendar token expired. Please reconnect.")
    if resp.status_code not in (200, 201):
        raise HTTPException(status_code=502, detail="Failed to create calendar event")

    event = resp.json()
    return {
        "success": True,
        "event_id": event.get("id"),
        "event_link": event.get("htmlLink"),
        "summary": event.get("summary"),
    }


# ── PLACES SEARCH ──────────────────────────────────────────────────────────────

def _haversine(lat1, lon1, lat2, lon2):
    R = 6371
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return round(2 * R * math.asin(math.sqrt(a)), 2)


@app.post("/api/places/search")
async def places_search(req: PlacesSearchRequest):
    api_key = os.environ.get("GOOGLE_PLACES_API_KEY", os.environ.get("GOOGLE_MAPS_API_KEY", ""))
    if not api_key:
        raise HTTPException(status_code=500, detail="Google Places API key not configured")

    async with httpx.AsyncClient() as http:
        resp = await http.get(
            "https://maps.googleapis.com/maps/api/place/textsearch/json",
            params={
                "query": req.query,
                "location": f"{req.lat},{req.lng}",
                "radius": req.radius,
                "key": api_key,
            },
        )

    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail="Google Places API error")

    results = []
    for place in resp.json().get("results", [])[:8]:
        loc = place.get("geometry", {}).get("location", {})
        plat, plng = loc.get("lat", req.lat), loc.get("lng", req.lng)
        results.append({
            "place_id": place.get("place_id"),
            "name": place.get("name"),
            "address": place.get("formatted_address", place.get("vicinity", "")),
            "lat": plat,
            "lng": plng,
            "rating": place.get("rating"),
            "user_ratings_total": place.get("user_ratings_total"),
            "open_now": place.get("opening_hours", {}).get("open_now"),
            "types": place.get("types", []),
            "distance_km": _haversine(req.lat, req.lng, plat, plng),
        })

    return {"results": results}


# ── AGENT RANK ─────────────────────────────────────────────────────────────────

@app.post("/api/agent/rank")
def agent_rank(req: AgentRankRequest):
    case = req.case_state
    criteria = case.get("criteriaState", {})
    symptoms = case.get("symptoms", [])
    strength = case.get("caseStrength", 0)

    prompt = f"""You are a PCOS care coordinator matching a patient to appropriate nearby providers.

Patient profile:
- Case strength: {strength}/100
- Rotterdam criteria — cycle: {criteria.get('cycle', 'unknown')}, androgen: {criteria.get('androgen', 'unknown')}, ovary: {criteria.get('ovary', 'unknown')}
- Symptoms: {', '.join(symptoms) if symptoms else 'not specified'}

Nearby providers found via Google Places:
{json.dumps(req.places[:24], indent=2)}

Return JSON only — no other text. Use exactly this structure:
{{
  "doctors": [
    {{
      "place_id": "<from input>",
      "rank": 1,
      "specialty_match": "<GP|Endocrinologist|Gynecologist>",
      "relevance_reason": "<one sentence: why this provider suits this patient>",
      "priority": "<high|medium|low>"
    }}
  ],
  "labs": [
    {{
      "place_id": "<from input>",
      "rank": 1,
      "relevance_reason": "<one sentence: why this lab is appropriate>",
      "priority": "<high|medium|low>"
    }}
  ],
  "prioritized_tests": ["<test1>", "<test2>", "<test3>", "<test4>", "<test5>"]
}}

Rules:
- Classify each place as a doctor/clinic (doctors array) or diagnostic lab (labs array). Omit places that fit neither.
- Rank each group separately by relevance to this patient's specific symptom profile.
- prioritized_tests: exactly 5 tests. Always include testosterone (total + free) and fasting insulin. Add LH/FSH if cycle is detected or possible. Add AMH if ovary is detected or possible. Fill remaining slots with HbA1c, thyroid panel (TSH), or vitamin D 25-OH as appropriate.
- Keep relevance_reason to one clear, specific sentence."""

    message = client.messages.create(
        model=MODEL,
        max_tokens=1500,
        messages=[{"role": "user", "content": prompt}],
    )

    text = _strip_json_fences(message.content[0].text)
    try:
        return json.loads(text)
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to parse AI ranking response")


# ── CALENDAR FREE SLOTS ────────────────────────────────────────────────────────

@app.post("/api/calendar/free-slots")
async def calendar_free_slots(req: FreeSlotsRequest):
    from datetime import datetime, timedelta
    from zoneinfo import ZoneInfo

    tz = ZoneInfo("America/Toronto")
    now = datetime.now(tz)
    end_range = now + timedelta(days=req.days_ahead)

    headers = {"Authorization": f"Bearer {req.token}", "Content-Type": "application/json"}
    async with httpx.AsyncClient() as http:
        resp = await http.post(
            "https://www.googleapis.com/calendar/v3/freeBusy",
            headers=headers,
            json={
                "timeMin": now.isoformat(),
                "timeMax": end_range.isoformat(),
                "items": [{"id": "primary"}],
            },
        )

    if resp.status_code == 401:
        raise HTTPException(status_code=401, detail="Calendar token expired. Please reconnect.")
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail="Google Calendar API error")

    busy_periods = resp.json().get("calendars", {}).get("primary", {}).get("busy", [])
    slot_duration = timedelta(minutes=req.slot_duration_minutes)

    # Start scanning from tomorrow 9 AM
    current = (now + timedelta(days=1)).replace(hour=9, minute=0, second=0, microsecond=0)
    slots = []

    while len(slots) < 3 and current < end_range:
        # Skip weekends
        if current.weekday() in (5, 6):
            current = (current + timedelta(days=1)).replace(hour=9, minute=0, second=0, microsecond=0)
            continue

        slot_end = current + slot_duration

        # Skip outside business hours (9 AM – 5 PM)
        if current.hour >= 17:
            current = (current + timedelta(days=1)).replace(hour=9, minute=0, second=0, microsecond=0)
            continue
        if slot_end.hour > 17 or (slot_end.hour == 17 and slot_end.minute > 0):
            current = (current + timedelta(days=1)).replace(hour=9, minute=0, second=0, microsecond=0)
            continue

        # Check against busy periods
        is_free = True
        for busy in busy_periods:
            bs = datetime.fromisoformat(busy["start"].replace("Z", "+00:00")).astimezone(tz)
            be = datetime.fromisoformat(busy["end"].replace("Z", "+00:00")).astimezone(tz)
            if not (slot_end <= bs or current >= be):
                is_free = False
                break

        if is_free:
            slots.append({
                "start": current.isoformat(),
                "end": slot_end.isoformat(),
            })

        current += timedelta(minutes=30)

    return {"slots": slots}
