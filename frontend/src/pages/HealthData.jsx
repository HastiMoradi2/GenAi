import { useState } from 'react'

const APPLE_METRICS = [
  { label: 'Avg Cycle Length', value: '38', unit: 'days', note: 'Above normal (21–35d)', noteType: 'warning' },
  { label: 'Avg Sleep', value: '5.8', unit: 'hrs/night', note: 'Below recommended 7–9h', noteType: 'warning' },
  { label: 'Heart Rate Variability', value: '22', unit: 'ms', note: 'Low — possible autonomic stress', noteType: 'warning' },
  { label: 'Weight Trend', value: '+2.4', unit: 'kg / 30d', note: 'Notable gain — monitor', noteType: 'warning' },
  { label: 'Daily Steps', value: '5,842', unit: 'avg', note: 'Below 7,500 target', noteType: 'info' },
  { label: 'Resting Heart Rate', value: '78', unit: 'bpm', note: 'Normal range', noteType: 'ok' },
]

const CLINICAL_NOTES = [
  { title: 'Cycle Length', body: 'An average cycle of 38 days exceeds the clinical threshold for oligomenorrhoea (>35 days), which is a key diagnostic signal for PCOS under the Rotterdam Criteria. This pattern should be formally documented.' },
  { title: 'Sleep Quality', body: 'Chronic sleep deprivation (<6 hrs) is associated with elevated cortisol, impaired insulin sensitivity, and worsening androgen profiles in PCOS. Improving sleep hygiene may directly benefit hormonal regulation.' },
  { title: 'HRV & Autonomic Health', body: 'Low HRV (22ms) may reflect heightened sympathetic tone, which has been linked to elevated androgens and insulin resistance in PCOS populations. Consider stress reduction strategies.' },
  { title: 'Weight Trend', body: 'A 2.4kg gain over 30 days warrants monitoring. Even modest weight gain can worsen insulin resistance and androgen levels in PCOS. Referral to a registered dietitian familiar with PCOS is recommended.' },
]

export default function HealthData({ showToast }) {
  const [fitConnected, setFitConnected] = useState(false)
  const [fitLoading, setFitLoading] = useState(false)

  function connectFit() {
    setFitLoading(true)
    setTimeout(() => {
      setFitLoading(false)
      setFitConnected(true)
      showToast('Google Fit connected successfully', 'success')
    }, 1800)
  }

  return (
    <div>
      <h1 className="page-title">Health Data</h1>
      <p className="page-subtitle">Passive health metrics interpreted through a PCOS clinical lens.</p>

      {/* ── Apple Health ── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontWeight: 700, fontSize: 16 }}>Apple Health</span>
              <span className="connected-badge">Connected</span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
              Synced today at 9:14 AM · Last 30 days
            </p>
          </div>
        </div>

        <div className="metric-grid">
          {APPLE_METRICS.map(m => (
            <div key={m.label} className="metric-card">
              <div className="metric-value">{m.value}</div>
              <div className="metric-unit">{m.unit}</div>
              <div className="metric-label">{m.label}</div>
              {m.note && (
                <div
                  className="metric-note"
                  style={{
                    color: m.noteType === 'warning' ? 'var(--peach-deep)' :
                           m.noteType === 'ok' ? 'var(--mint-deep)' : 'var(--sky-deep)'
                  }}
                >
                  {m.note}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Google Fit ── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
              Google Fit
              {fitConnected && <span className="connected-badge">Connected</span>}
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Activity, workouts, and fitness data</div>
          </div>
          {!fitConnected ? (
            <button className="btn btn-secondary btn-sm" onClick={connectFit} disabled={fitLoading}>
              {fitLoading ? <><span className="spinner dark" /> Connecting…</> : 'Connect Google Fit'}
            </button>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
              Synced today · 142 active minutes this week
            </div>
          )}
        </div>

        {fitConnected && (
          <div className="metric-grid" style={{ marginTop: 20 }}>
            <div className="metric-card">
              <div className="metric-value">142</div>
              <div className="metric-unit">min/week</div>
              <div className="metric-label">Active Minutes</div>
              <div className="metric-note" style={{ color: 'var(--mint-deep)' }}>Meets WHO guidelines</div>
            </div>
            <div className="metric-card">
              <div className="metric-value">1,840</div>
              <div className="metric-unit">kcal/day</div>
              <div className="metric-label">Avg Active Calories</div>
            </div>
            <div className="metric-card">
              <div className="metric-value">3</div>
              <div className="metric-unit">sessions/week</div>
              <div className="metric-label">Workouts logged</div>
            </div>
          </div>
        )}
      </div>

      {/* ── Clinical Notes ── */}
      <div className="card">
        <div className="section-label" style={{ marginBottom: 16 }}>Clinical Interpretation</div>
        {CLINICAL_NOTES.map((n, i) => (
          <div key={i} style={{ marginBottom: i < CLINICAL_NOTES.length - 1 ? 16 : 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{n.title}</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>{n.body}</div>
            {i < CLINICAL_NOTES.length - 1 && <div className="divider" style={{ marginTop: 16 }} />}
          </div>
        ))}

        <div style={{ marginTop: 20, padding: 14, background: 'var(--lav-light)', borderRadius: 'var(--radius-sm)', fontSize: 12, color: 'var(--muted)' }}>
          These metrics are from passive health tracking and are intended to support clinical discussion — not replace professional medical assessment.
        </div>
      </div>
    </div>
  )
}
