import { useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts'
import { useCycleData } from '../hooks/useCycleData'
import { api } from '../lib/api'

const DAY_SYMPTOMS = [
  'Cramps', 'Bloating', 'Headache', 'Fatigue', 'Mood swings',
  'Acne', 'Breast tenderness', 'Back pain', 'Nausea', 'Spotting',
]

const SUGGESTION_ICONS = {
  nutrition: 'N', movement: 'M', sleep: 'S',
  stress: 'S', supplements: 'Rx', tracking: 'T',
}

function formatDate(d) {
  return d.toISOString().split('T')[0]
}

export default function CycleTracker({ showToast }) {
  const { data, togglePeriod, toggleDaySymptom, getDayData, periodDays, avgCycleLength, allLoggedSymptoms } = useCycleData()

  const today = new Date()
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [selectedDay, setSelectedDay] = useState(null)
  const [suggestions, setSuggestions] = useState(null)
  const [loadingSugg, setLoadingSugg] = useState(false)

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()

  const firstDay = new Date(year, month, 1).getDay()  // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const monthName = viewDate.toLocaleString('default', { month: 'long', year: 'numeric' })

  function prevMonth() { setViewDate(new Date(year, month - 1, 1)); setSelectedDay(null) }
  function nextMonth() { setViewDate(new Date(year, month + 1, 1)); setSelectedDay(null) }

  function handleDayClick(day) {
    const dateStr = formatDate(new Date(year, month, day))
    setSelectedDay(dateStr)
  }

  function handleTogglePeriod() {
    if (!selectedDay) return
    togglePeriod(selectedDay)
  }

  function handleToggleSymptom(sym) {
    if (!selectedDay) return
    toggleDaySymptom(selectedDay, sym)
  }

  // Build chart data: recent 6 months of cycle lengths
  function buildChartData() {
    if (periodDays.length < 2) return []
    const starts = []
    for (let i = 0; i < periodDays.length; i++) {
      if (i === 0) { starts.push(periodDays[i]); continue }
      const prev = new Date(periodDays[i - 1])
      const curr = new Date(periodDays[i])
      if ((curr - prev) / 86400000 > 2) starts.push(periodDays[i])
    }
    return starts.slice(-6).slice(0, -1).map((start, i) => {
      const next = starts[i + 1]
      const len = Math.round((new Date(next) - new Date(start)) / 86400000)
      return { label: new Date(start).toLocaleString('default', { month: 'short' }), days: len }
    })
  }

  const chartData = buildChartData()

  async function getAISuggestions() {
    setLoadingSugg(true)
    try {
      const result = await api.cycleSuggestions(periodDays, avgCycleLength, allLoggedSymptoms)
      setSuggestions(Array.isArray(result) ? result : result.suggestions || [])
    } catch (e) {
      showToast(e.message || 'Could not load suggestions', 'error')
    } finally {
      setLoadingSugg(false)
    }
  }

  const selectedDayData = selectedDay ? getDayData(selectedDay) : {}

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Cycle Tracker</h1>
        <p className="page-subtitle">Tap days to log your period. Select a day to track daily symptoms.</p>
      </div>

      <div className="two-col" style={{ alignItems: 'start' }}>
        {/* ── Left: calendar ── */}
        <div className="card">
          <div className="cal-nav">
            <button className="btn btn-ghost btn-sm" onClick={prevMonth}>‹</button>
            <span className="cal-nav-title">{monthName}</span>
            <button className="btn btn-ghost btn-sm" onClick={nextMonth}>›</button>
          </div>

          <div className="cal-grid">
            {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
              <div key={d} className="cal-day-label">{d}</div>
            ))}
            {/* empty cells before month start */}
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`e${i}`} className="cal-day empty" />
            ))}
            {/* day cells */}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
              const dateStr = formatDate(new Date(year, month, day))
              const isPeriod = data[dateStr]?.isPeriod
              const isToday = dateStr === formatDate(today)
              const isSelected = dateStr === selectedDay
              return (
                <button
                  key={day}
                  className={`cal-day ${isPeriod ? 'period' : ''} ${isToday ? 'today' : ''}`}
                  style={isSelected ? { outline: '2px solid var(--lav-deep)', outlineOffset: 2 } : {}}
                  onClick={() => handleDayClick(day)}
                >
                  {day}
                </button>
              )
            })}
          </div>

          {/* Stats */}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 100 }}>
              <div className="section-label">Avg cycle</div>
              <div style={{ fontSize: 22, fontFamily: 'Instrument Serif, serif', color: 'var(--lav-deep)' }}>
                {avgCycleLength ? `${avgCycleLength}d` : '—'}
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 100 }}>
              <div className="section-label">This month</div>
              <div style={{ fontSize: 22, fontFamily: 'Instrument Serif, serif', color: 'var(--text)' }}>
                {Object.keys(data).filter(k => k.startsWith(`${year}-${String(month + 1).padStart(2,'0')}`) && data[k]?.isPeriod).length}d
              </div>
            </div>
          </div>
        </div>

        {/* ── Right: selected day + AI ── */}
        <div>
          {selectedDay ? (
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="section-label" style={{ marginBottom: 10 }}>
                {new Date(selectedDay + 'T12:00:00').toLocaleDateString('default', { weekday: 'long', month: 'long', day: 'numeric' })}
              </div>

              <button
                className={`btn btn-sm ${selectedDayData.isPeriod ? 'btn-primary' : 'btn-ghost'}`}
                style={{ marginBottom: 14 }}
                onClick={handleTogglePeriod}
              >
                {selectedDayData.isPeriod ? '🔴 Period day (tap to remove)' : '+ Mark as period day'}
              </button>

              <div className="section-label">Symptoms today</div>
              <div className="chip-row">
                {DAY_SYMPTOMS.map(sym => (
                  <button
                    key={sym}
                    className={`chip ${selectedDayData.symptoms?.includes(sym) ? 'active' : ''}`}
                    onClick={() => handleToggleSymptom(sym)}
                  >
                    {sym}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="empty-state">
                <div className="empty-state-icon">📅</div>
                <div className="empty-state-title">Select a day</div>
                <div className="empty-state-desc">Click any calendar day to log your period or symptoms.</div>
              </div>
            </div>
          )}

          {/* AI suggestions */}
          <div className="card">
            <div className="section-label" style={{ marginBottom: 4 }}>AI Wellness Suggestions</div>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14 }}>
              Personalised tips based on your cycle data and PCOS physiology.
            </p>
            <button
              className="btn btn-secondary btn-sm"
              onClick={getAISuggestions}
              disabled={loadingSugg}
            >
              {loadingSugg ? <><span className="spinner dark" /> Loading…</> : 'Get suggestions'}
            </button>

            {suggestions && (
              <div style={{ marginTop: 16 }}>
                {suggestions.map((s, i) => (
                  <div key={i} className="suggestion-card">
                    <div className={`suggestion-icon ${s.category}`}>
                      {SUGGESTION_ICONS[s.category] || '💡'}
                    </div>
                    <div>
                      <div className="suggestion-title">{s.title}</div>
                      <div className="suggestion-tip">{s.tip}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Cycle length chart ── */}
      {chartData.length >= 2 && (
        <div className="card" style={{ marginTop: 20 }}>
          <div className="section-label" style={{ marginBottom: 16 }}>Cycle Length History</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ border: '1.5px solid var(--border)', borderRadius: 10, fontSize: 13 }}
                formatter={(v) => [`${v} days`, 'Cycle length']}
              />
              <Bar dataKey="days" radius={[6, 6, 0, 0]}>
                {chartData.map((_, i) => (
                  <Cell key={i} fill={_.days > 35 ? 'var(--peach)' : 'var(--lav-mid)'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>
            Cycles longer than 35 days are highlighted — a key Rotterdam criterion.
          </p>
        </div>
      )}
    </div>
  )
}
