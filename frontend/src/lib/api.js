const BASE = ''  // Vite proxy forwards /api to http://localhost:8000

async function request(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  }
  if (body !== undefined) opts.body = JSON.stringify(body)

  const res = await fetch(BASE + path, opts)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

export const api = {
  health: () => request('GET', '/api/health'),

  analyse: (symptoms, anything_else = '', notes = '') =>
    request('POST', '/api/analyse', { symptoms, anything_else, notes }),

  report: (symptoms, anything_else = '', notes = '', criteria_state = {}) =>
    request('POST', '/api/report', { symptoms, anything_else, notes, criteria_state }),

  letter: (symptoms, notes = '') =>
    request('POST', '/api/letter', { symptoms, notes }),

  cycleSuggestions: (period_days = [], average_cycle_length = null, common_symptoms = [], notes = '') =>
    request('POST', '/api/cycle/suggestions', {
      period_days,
      average_cycle_length,
      common_symptoms,
      notes,
    }),

  calendarCheck: (token, datetime_iso, duration_minutes = 60) =>
    request('POST', '/api/calendar/check', { token, datetime_iso, duration_minutes }),

  calendarBook: (token, datetime_iso, duration_minutes = 60, doctor_name, doctor_address = '', notes = '') =>
    request('POST', '/api/calendar/book', {
      token,
      datetime_iso,
      duration_minutes,
      doctor_name,
      doctor_address,
      notes,
    }),

  placesSearch: (lat, lng, query, radius = 15000) =>
    request('POST', '/api/places/search', { lat, lng, query, radius }),

  agentRank: (case_state, places) =>
    request('POST', '/api/agent/rank', { case_state, places }),

  calendarFreeSlots: (token, days_ahead = 14, slot_duration_minutes = 60) =>
    request('POST', '/api/calendar/free-slots', { token, days_ahead, slot_duration_minutes }),
}
