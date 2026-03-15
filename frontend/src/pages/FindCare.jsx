import { useState, useEffect } from 'react'
import { api } from '../lib/api'

const AGENT_STEPS = [
  { id: 'location', label: 'Getting your location' },
  { id: 'case',     label: 'Reading your case' },
  { id: 'search',   label: 'Searching nearby providers' },
  { id: 'rank',     label: 'Analysing with AI' },
  { id: 'calendar', label: 'Checking your calendar' },
]

const FILTERS = ['All', 'GP', 'Endocrinologist', 'Gynecologist', 'Lab']

const SEARCH_QUERIES = [
  'PCOS endocrinologist women health clinic',
  'women health gynecologist reproductive',
  'family doctor GP walk-in clinic',
  'diagnostic laboratory blood test imaging',
]

function readCaseState() {
  try {
    return {
      caseStrength:  parseInt(localStorage.getItem('clover_case_strength') || '0'),
      criteriaState: JSON.parse(localStorage.getItem('clover_criteria_state') || '{}'),
      symptoms:      JSON.parse(localStorage.getItem('clover_symptoms') || '[]'),
    }
  } catch {
    return { caseStrength: 0, criteriaState: {}, symptoms: [] }
  }
}

function distLabel(km) {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`
}

function formatSlot(iso) {
  const d = new Date(iso)
  return d.toLocaleString('en-CA', {
    weekday: 'long', month: 'long', day: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  })
}

const STEP_PENDING = (
  <div style={{
    width: 20, height: 20, borderRadius: '50%',
    border: '2px solid var(--border)',
  }} />
)
const STEP_DONE = (
  <div style={{
    width: 20, height: 20, borderRadius: '50%',
    background: 'var(--lav-deep)', color: '#fff',
    fontSize: 10, fontWeight: 700,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }}>✓</div>
)
const STEP_ERROR = (
  <div style={{
    width: 20, height: 20, borderRadius: '50%',
    background: 'var(--peach-deep)', color: '#fff',
    fontSize: 10, fontWeight: 700,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }}>✗</div>
)

export default function FindCare({ showToast }) {
  // ── Calendar token (read from URL hash or localStorage) ──
  const [calToken, setCalToken] = useState('')
  useEffect(() => {
    const hash = window.location.hash
    if (hash.startsWith('#gcal=')) {
      const t = decodeURIComponent(hash.slice(6))
      setCalToken(t)
      localStorage.setItem('gcal_token', t)
      window.history.replaceState({}, '', window.location.pathname + window.location.search)
    } else {
      const stored = localStorage.getItem('gcal_token')
      if (stored) setCalToken(stored)
    }
  }, [])

  // ── Agent state ──
  const [phase, setPhase]           = useState('idle') // idle | running | results | error
  const [stepStatus, setStepStatus] = useState(
    Object.fromEntries(AGENT_STEPS.map(s => [s.id, 'pending']))
  )
  const [agentError, setAgentError] = useState('')

  // ── Results ──
  const [doctors, setDoctors] = useState([])
  const [labs, setLabs]       = useState([])
  const [tests, setTests]     = useState([])
  const [filter, setFilter]   = useState('All')

  // ── Booking flow ──
  const [selected, setSelected]     = useState(null)
  const [slots, setSlots]           = useState([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [chosenSlot, setChosenSlot] = useState(null)
  const [booking, setBooking]       = useState(null)
  const [loadingBook, setLoadingBook] = useState(false)

  function step(id, status) {
    setStepStatus(prev => ({ ...prev, [id]: status }))
  }

  // ── Run the agent ──
  async function runAgent() {
    setPhase('running')
    setAgentError('')
    setStepStatus(Object.fromEntries(AGENT_STEPS.map(s => [s.id, 'pending'])))
    setDoctors([]); setLabs([]); setTests([])
    setSelected(null); setSlots([]); setBooking(null); setChosenSlot(null)

    // Step 1 — Location
    step('location', 'active')
    let coords
    try {
      coords = await new Promise(resolve =>
        navigator.geolocation.getCurrentPosition(
          p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
          () => resolve({ lat: 43.6510, lng: -79.3470 }), // fallback: Toronto
          { timeout: 8000 }
        )
      )
    } catch {
      coords = { lat: 43.6510, lng: -79.3470 }
    }
    step('location', 'done')

    // Step 2 — Case state
    step('case', 'active')
    const caseState = readCaseState()
    step('case', 'done')

    // Step 3 — Search
    step('search', 'active')
    let allPlaces = []
    try {
      const results = await Promise.all(
        SEARCH_QUERIES.map(q =>
          api.placesSearch(coords.lat, coords.lng, q).catch(() => ({ results: [] }))
        )
      )
      const seen = new Set()
      results.forEach(r =>
        r.results?.forEach(p => {
          if (p.place_id && !seen.has(p.place_id)) {
            seen.add(p.place_id)
            allPlaces.push(p)
          }
        })
      )
      step('search', 'done')
    } catch (e) {
      step('search', 'error')
      setAgentError('Places search failed: ' + e.message)
      setPhase('error')
      return
    }

    // Step 4 — AI Rank
    step('rank', 'active')
    try {
      const ranked = await api.agentRank(caseState, allPlaces)
      
      const placeMap = Object.fromEntries(allPlaces.map(p => [p.place_id, p]))
      setDoctors(
        (ranked.doctors || []).map(r => ({ ...placeMap[r.place_id], ...r })).filter(d => d.name)
      )
      setLabs(
        (ranked.labs || []).map(r => ({ ...placeMap[r.place_id], ...r })).filter(l => l.name)
      )
      setTests(ranked.prioritized_tests || [])
      step('rank', 'done')
    } catch (e) {
      step('rank', 'error')
      setAgentError('AI ranking failed: ' + e.message)
      setPhase('error')
      return
    }

    // Step 5 — Calendar check (token only; slots load on doctor select)
    step('calendar', 'active')
    const tok = localStorage.getItem('gcal_token')
    if (tok) setCalToken(tok)
    step('calendar', 'done')

    setPhase('results')
  }

  // ── Select a doctor → fetch calendar slots ──
  async function selectDoctor(doc) {
    if (selected?.place_id === doc.place_id) {
      setSelected(null)
      setSlots([])
      setChosenSlot(null)
      return
    }
    setSelected(doc)
    setSlots([])
    setChosenSlot(null)
    setBooking(null)

    const tok = calToken || localStorage.getItem('gcal_token')
    if (!tok) return

    setLoadingSlots(true)
    try {
      const res = await api.calendarFreeSlots(tok)
      setSlots(res.slots || [])
    } catch (e) {
      if (e.message.includes('401')) {
        setCalToken('')
        localStorage.removeItem('gcal_token')
        showToast('Calendar session expired — please reconnect', 'error')
      }
    } finally {
      setLoadingSlots(false)
    }
  }

  // ── Confirm booking ──
  async function confirmBooking() {
    if (!chosenSlot || !selected) return
    const tok = calToken || localStorage.getItem('gcal_token')
    if (!tok) return

    setLoadingBook(true)
    const cs = readCaseState()
    const description = [
      `PCOS consultation booked via Clover.`,
      `\nCase strength: ${cs.caseStrength}/100`,
      cs.symptoms.length ? `Key symptoms: ${cs.symptoms.slice(0, 5).join(', ')}` : '',
      tests.length ? `\nRecommended tests:\n${tests.map(t => '• ' + t).join('\n')}` : '',
    ].filter(Boolean).join('\n')

    try {
      const result = await api.calendarBook(
        tok, chosenSlot.start, 60,
        selected.name, selected.address || '', description
      )
      setBooking(result)
    } catch (e) {
      showToast(e.message || 'Booking failed', 'error')
    } finally {
      setLoadingBook(false)
    }
  }

  const caseState   = readCaseState()
  const hasCaseData = caseState.symptoms.length > 0
  const displayList = filter === 'Lab' ? labs
    : filter === 'All' ? doctors
    : doctors.filter(d => d.specialty_match === filter)

  // ─────────────────────────────────────────────────────────────────────────────
  // CONFIRMED
  // ─────────────────────────────────────────────────────────────────────────────
  if (booking) {
    return (
      <div>
        <div className="page-header" style={{ marginBottom: 20 }}>
          <h1 className="page-title" style={{ marginBottom: 0 }}>Find Care</h1>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: 48 }}>
          <div style={{
            fontSize: 28, fontWeight: 700, color: 'var(--lav-deep)',
            fontFamily: 'Instrument Serif, serif', marginBottom: 16,
          }}>
            Appointment confirmed
          </div>
          <div style={{ fontSize: 18, fontFamily: 'Instrument Serif, serif', marginBottom: 8 }}>
            {booking.summary}
          </div>
          <div style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 4 }}>
            {formatSlot(chosenSlot.start)}
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 28 }}>
            {selected?.address}
          </div>
          {booking.event_link && (
            <a
              href={booking.event_link}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary"
            >
              Open in Google Calendar →
            </a>
          )}
          <div style={{ marginTop: 14 }}>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => { setBooking(null); setSelected(null); setChosenSlot(null) }}
            >
              Book another
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // IDLE
  // ─────────────────────────────────────────────────────────────────────────────
  if (phase === 'idle') {
    return (
      <div>
        <div className="page-header">
          <h1 className="page-title">Find Care</h1>
          <p className="page-subtitle">
            Clover will search for nearby specialists and labs, rank them for your case, and book a slot in your calendar.
          </p>
        </div>

        <div className="two-col" style={{ alignItems: 'start' }}>
          {/* Agent description + trigger */}
          <div className="card">
            <div className="section-label" style={{ marginBottom: 14 }}>What happens</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
              {[
                'Gets your GPS location',
                'Reads your case — criteria, strength, symptoms',
                'Searches nearby doctors and diagnostic labs via Google Places',
                'Asks Claude to rank and explain each result for your profile',
                'Checks your Google Calendar for open slots',
                'Books the appointment with reminders',
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%',
                    background: 'var(--lav-light)', color: 'var(--lav-deep)',
                    fontSize: 11, fontWeight: 700, flexShrink: 0, marginTop: 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>{i + 1}</div>
                  <span style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>{item}</span>
                </div>
              ))}
            </div>
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={runAgent}>
              Find Care →
            </button>
          </div>

          {/* Case snapshot */}
          {hasCaseData ? (
            <div className="card">
              <div className="section-label" style={{ marginBottom: 14 }}>Your case snapshot</div>

              {caseState.caseStrength > 0 && (
                <div style={{ marginBottom: 18 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>Case Strength</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--lav-deep)' }}>
                      {caseState.caseStrength}%
                    </span>
                  </div>
                  <div className="progress-wrap">
                    <div className="progress-fill" style={{ width: `${caseState.caseStrength}%` }} />
                  </div>
                </div>
              )}

              {Object.keys(caseState.criteriaState).length > 0 && (
                <div style={{ marginBottom: 18 }}>
                  <div className="section-label" style={{ marginBottom: 8 }}>Rotterdam Criteria</div>
                  {Object.entries(caseState.criteriaState).map(([key, val]) => (
                    <div key={key} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      fontSize: 13, marginBottom: 6,
                    }}>
                      <span style={{ color: 'var(--muted)', textTransform: 'capitalize' }}>{key}</span>
                      <span className={`badge badge-${val || 'empty'}`} style={{ fontSize: 11 }}>
                        {val || '—'}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {caseState.symptoms.length > 0 && (
                <div>
                  <div className="section-label" style={{ marginBottom: 8 }}>
                    Symptoms ({caseState.symptoms.length})
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {caseState.symptoms.slice(0, 8).map(s => (
                      <span key={s} style={{
                        padding: '3px 10px', borderRadius: 99,
                        background: 'var(--lav-light)', color: 'var(--lav-deep)',
                        fontSize: 11, fontWeight: 600,
                      }}>{s}</span>
                    ))}
                    {caseState.symptoms.length > 8 && (
                      <span style={{ fontSize: 11, color: 'var(--muted)', padding: '3px 0' }}>
                        +{caseState.symptoms.length - 8} more
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="card">
              <div className="empty-state" style={{ padding: '32px 0' }}>
                <div className="empty-state-title">No case data yet</div>
                <div className="empty-state-desc">
                  Complete the Symptoms tab first so the agent can personalise your results.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RUNNING
  // ─────────────────────────────────────────────────────────────────────────────
  if (phase === 'running') {
    return (
      <div>
        <div className="page-header" style={{ marginBottom: 20 }}>
          <h1 className="page-title" style={{ marginBottom: 0 }}>Find Care</h1>
        </div>
        <div className="card" style={{ maxWidth: 440 }}>
          <div className="section-label" style={{ marginBottom: 20 }}>Working on it…</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {AGENT_STEPS.map(s => {
              const st = stepStatus[s.id]
              return (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 20, height: 20, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {st === 'done'    && STEP_DONE}
                    {st === 'active'  && <span className="spinner dark" style={{ width: 18, height: 18 }} />}
                    {st === 'pending' && STEP_PENDING}
                    {st === 'error'   && STEP_ERROR}
                  </div>
                  <span style={{
                    fontSize: 14,
                    fontWeight: st === 'active' ? 600 : 400,
                    color: st === 'done'    ? 'var(--text)'
                         : st === 'active'  ? 'var(--lav-deep)'
                         : st === 'error'   ? 'var(--peach-deep)'
                         : 'var(--faint)',
                    transition: 'color 0.2s',
                  }}>
                    {s.label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // ERROR
  // ─────────────────────────────────────────────────────────────────────────────
  if (phase === 'error') {
    return (
      <div>
        <div className="page-header" style={{ marginBottom: 20 }}>
          <h1 className="page-title" style={{ marginBottom: 0 }}>Find Care</h1>
        </div>
        <div className="card" style={{ maxWidth: 440 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--peach-deep)', marginBottom: 8 }}>
            Something went wrong
          </div>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20, lineHeight: 1.6 }}>
            {agentError}
          </p>
          <button className="btn btn-primary" onClick={runAgent}>Try again</button>
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RESULTS
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 className="page-title" style={{ marginBottom: 4 }}>Find Care</h1>
          <p className="page-subtitle">Ranked for your case profile. Select a provider to see available calendar slots.</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={runAgent}>Re-run</button>
      </div>

      <div className="two-col" style={{ alignItems: 'start' }}>

        {/* ── Left: ranked providers ── */}
        <div>
          {/* Filter strip */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
            {FILTERS.map(f => (
              <button
                key={f}
                onClick={() => { setFilter(f); setSelected(null); setSlots([]) }}
                style={{
                  padding: '6px 14px',
                  borderRadius: 99,
                  border: '1.5px solid',
                  borderColor: filter === f ? 'var(--lav-deep)' : 'var(--border)',
                  background:  filter === f ? 'var(--lav-deep)' : 'var(--surface)',
                  color:        filter === f ? '#fff'            : 'var(--muted)',
                  fontSize: 12, fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.12s',
                }}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Provider cards */}
          {displayList.length === 0 ? (
            <div className="card">
              <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--muted)', fontSize: 13 }}>
                No results for this filter.
              </div>
            </div>
          ) : displayList.map(doc => {
            const isSelected = selected?.place_id === doc.place_id
            return (
              <div
                key={doc.place_id}
                onClick={() => selectDoctor(doc)}
                style={{
                  background: 'var(--surface)',
                  border: '1.5px solid',
                  borderColor: isSelected ? 'var(--lav-deep)' : 'var(--border)',
                  borderRadius: 'var(--radius)',
                  padding: 20,
                  marginBottom: 12,
                  cursor: 'pointer',
                  boxShadow: isSelected ? '0 0 0 3px var(--lav-light)' : 'var(--shadow)',
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Name row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 5 }}>
                      <div style={{
                        width: 22, height: 22, borderRadius: '50%',
                        background: doc.priority === 'high' ? 'var(--lav-deep)' : 'var(--lav-light)',
                        color:      doc.priority === 'high' ? '#fff'            : 'var(--lav-deep)',
                        fontSize: 11, fontWeight: 700, flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {doc.rank}
                      </div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>
                        {doc.name}
                      </div>
                      {doc.specialty_match && (
                        <span style={{
                          padding: '2px 8px', borderRadius: 99,
                          background: 'var(--lav-light)', color: 'var(--lav-deep)',
                          fontSize: 11, fontWeight: 600,
                        }}>
                          {doc.specialty_match}
                        </span>
                      )}
                    </div>

                    {/* Address + distance */}
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>
                      {doc.address}
                      {doc.distance_km != null && (
                        <span style={{ marginLeft: 6, color: 'var(--faint)' }}>
                          · {distLabel(doc.distance_km)}
                        </span>
                      )}
                    </div>

                    {/* AI reason */}
                    {doc.relevance_reason && (
                      <div style={{
                        fontSize: 13, fontStyle: 'italic',
                        color: 'var(--text)', lineHeight: 1.45,
                      }}>
                        "{doc.relevance_reason}"
                      </div>
                    )}
                  </div>

                  {/* Right column: rating / open / OHIP */}
                  <div style={{
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'flex-end', gap: 5, flexShrink: 0,
                  }}>
                    {doc.rating && (
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--butter-deep)' }}>
                        {doc.rating} ★
                      </div>
                    )}
                    {doc.open_now != null && (
                      <div style={{
                        fontSize: 11, fontWeight: 600,
                        color: doc.open_now ? 'var(--mint-deep)' : 'var(--muted)',
                      }}>
                        {doc.open_now ? 'Open now' : 'Closed'}
                      </div>
                    )}
                    <div style={{
                      fontSize: 10, fontWeight: 600,
                      color: 'var(--faint)',
                      textTransform: 'uppercase', letterSpacing: '0.05em',
                    }}>
                      Verify OHIP
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* ── Right: booking panel + tests ── */}
        <div>
          {/* Booking panel */}
          {selected ? (
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="section-label" style={{ marginBottom: 8 }}>Selected provider</div>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 2 }}>{selected.name}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 20 }}>
                {selected.address}
              </div>

              {!calToken ? (
                /* Calendar not connected */
                <div className="calendar-status">
                  <div className="calendar-dot" />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>Calendar not connected</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                      Connect to auto-find free slots and book
                    </div>
                  </div>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => window.location.href = '/api/calendar/auth'}
                  >
                    Connect →
                  </button>
                </div>

              ) : loadingSlots ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0', color: 'var(--muted)', fontSize: 13 }}>
                  <span className="spinner dark" />
                  Checking your calendar…
                </div>

              ) : slots.length > 0 ? (
                <>
                  <div className="section-label" style={{ marginBottom: 10 }}>Next free slots</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                    {slots.map((slot, i) => {
                      const chosen = chosenSlot?.start === slot.start
                      return (
                        <button
                          key={i}
                          onClick={() => setChosenSlot(slot)}
                          style={{
                            padding: '12px 16px',
                            borderRadius: 'var(--radius-sm)',
                            border: '1.5px solid',
                            borderColor: chosen ? 'var(--lav-deep)' : 'var(--border)',
                            background:  chosen ? 'var(--lav-light)' : 'var(--surface)',
                            color:        chosen ? 'var(--lav-deep)'  : 'var(--text)',
                            fontSize: 13, fontWeight: chosen ? 700 : 400,
                            fontFamily: 'inherit',
                            cursor: 'pointer', textAlign: 'left',
                            transition: 'all 0.12s',
                          }}
                        >
                          {formatSlot(slot.start)}
                        </button>
                      )
                    })}
                  </div>
                  <button
                    className="btn btn-primary"
                    onClick={confirmBooking}
                    disabled={!chosenSlot || loadingBook}
                    style={{ width: '100%' }}
                  >
                    {loadingBook ? <><span className="spinner" /> Booking…</> : 'Confirm Booking'}
                  </button>
                </>

              ) : (
                <div style={{ fontSize: 13, color: 'var(--muted)', padding: '8px 0' }}>
                  No free 1-hour slots found in the next 14 days.
                </div>
              )}
            </div>
          ) : (
            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{
                textAlign: 'center', padding: '32px 16px',
                color: 'var(--muted)', fontSize: 13,
              }}>
                Select a provider on the left to see available slots.
              </div>
            </div>
          )}

          {/* Recommended tests */}
          {tests.length > 0 && (
            <div className="card">
              <div className="section-label" style={{ marginBottom: 8 }}>Tests to request</div>
              <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16, lineHeight: 1.5 }}>
                Prioritised for your profile. Bring this list to your appointment.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {tests.map((t, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 22, height: 22, borderRadius: '50%',
                      background: 'var(--lav-light)', color: 'var(--lav-deep)',
                      fontSize: 10, fontWeight: 700, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>{i + 1}</div>
                    <span style={{ fontSize: 13, color: 'var(--text)' }}>{t}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
