import { useState } from 'react'
import { api } from '../lib/api'

const SLIDES = [
  {
    id: 'skin',
    title: 'Skin & Hair',
    subtitle: 'Hormonal shifts often show up here first.',
    symptoms: [
      'Persistent acne', 'Oily skin', 'Facial hair',
      'Hair thinning', 'Body hair changes', 'Scalp hair loss',
    ],
  },
  {
    id: 'cycle',
    title: 'Cycle & Fertility',
    subtitle: 'Your cycle is one of the clearest windows into hormonal health.',
    symptoms: [
      'Irregular periods', 'Missed periods', 'Heavy bleeding',
      'Spotting between periods', 'Long cycles (>35 days)',
    ],
  },
  {
    id: 'weight',
    title: 'Weight & Metabolism',
    subtitle: "PCOS can make your body feel like it's working against you — that's not your fault.",
    symptoms: [
      'Weight gain', 'Difficulty losing weight', 'Sugar cravings',
      'Bloating', 'Skin darkening', 'Skin tags',
    ],
  },
  {
    id: 'mood',
    title: 'Mood & Energy',
    subtitle: 'Hormonal imbalances affect far more than most people realise.',
    symptoms: [
      'Fatigue', 'Mood swings', 'Anxiety',
      'Brain fog', 'Sleep problems', 'Low libido', 'Pelvic pain',
    ],
  },
]

const CRITERIA_CONFIG = {
  cycle:    { label: 'Menstrual Irregularity', sub: 'Anovulation or oligo-ovulation' },
  androgen: { label: 'Hyperandrogenism',        sub: 'Clinical or biochemical signs' },
  ovary:    { label: 'Polycystic Ovaries',      sub: 'Ultrasound or AMH elevation' },
}

const URGENCY_LABEL = { low: 'Low urgency', medium: 'Medium urgency', high: 'High urgency' }

function strengthLabel(v) {
  if (v >= 86) return 'Very strong'
  if (v >= 61) return 'Strong'
  if (v >= 31) return 'Moderate'
  return 'Minimal signals'
}

function strengthClass(v) {
  if (v >= 61) return 'high'
  if (v >= 31) return 'medium'
  return 'low'
}

const PAGE_FONT  = "'DM Sans', 'Plus Jakarta Sans', sans-serif"
const HEAD_FONT  = "'Playfair Display', 'Instrument Serif', serif"

export default function Symptoms({ showToast, onNavigate }) {
  const [slide, setSlide]           = useState(0)
  const [selected, setSelected]     = useState(new Set())
  const [anythingElse, setAnythingElse] = useState('')
  const [loading, setLoading]       = useState(false)
  const [result, setResult]         = useState(null)

  const isLast = slide === SLIDES.length - 1
  const allSelected = [...selected]

  function toggle(sym) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(sym) ? next.delete(sym) : next.add(sym)
      return next
    })
  }

  function goNext() {
    if (!isLast) {
      setSlide(s => s + 1)
    } else {
      buildCase()
    }
  }

  function goBack() {
    if (slide > 0) setSlide(s => s - 1)
  }

  async function buildCase() {
    if (selected.size === 0) {
      showToast('Select at least one symptom to continue', 'error')
      return
    }
    setLoading(true)
    setResult(null)
    try {
      const data = await api.analyse([...selected], anythingElse)
      setResult(data)
      localStorage.setItem('clover_symptoms', JSON.stringify([...selected]))
      localStorage.setItem('clover_anything_else', anythingElse)
      localStorage.setItem('clover_criteria_state', JSON.stringify(data.criteriaState))
      localStorage.setItem('clover_case_strength', String(data.caseStrength || 0))
    } catch (e) {
      showToast(e.message || 'Analysis failed', 'error')
    } finally {
      setLoading(false)
    }
  }

  /* ── Results view ── */
  if (result) {
    return (
      <div style={{ fontFamily: PAGE_FONT }}>
        <h1 className="page-title" style={{ fontFamily: HEAD_FONT }}>Your Case Profile</h1>
        <p className="page-subtitle">Here's what your symptoms suggest across the Rotterdam criteria.</p>

        <div className="card strength-section" style={{ marginBottom: 16 }}>
          <div className="strength-header">
            <div>
              <div className="section-label">Case Strength</div>
              <div className="strength-value">
                {result.caseStrength}<span style={{ fontSize: 18 }}>%</span>
              </div>
              <div className="strength-label">{strengthLabel(result.caseStrength)}</div>
            </div>
            <span className={`badge badge-${result.urgency}`}>
              {URGENCY_LABEL[result.urgency] || result.urgency}
            </span>
          </div>
          <div style={{ marginTop: 14 }}>
            <div className="progress-wrap">
              <div
                className={`progress-fill ${strengthClass(result.caseStrength)}`}
                style={{ width: `${result.caseStrength}%` }}
              />
            </div>
          </div>
          {result.summary && (
            <p style={{ marginTop: 14, fontSize: 14, color: 'var(--muted)', lineHeight: 1.6 }}>
              {result.summary}
            </p>
          )}
        </div>

        <div className="section-label" style={{ marginBottom: 12 }}>Rotterdam Criteria</div>
        <div className="criteria-grid" style={{ marginBottom: 16 }}>
          {Object.entries(CRITERIA_CONFIG).map(([key, cfg]) => {
            const state = result.criteriaState?.[key] || ''
            return (
              <div key={key} className={`criteria-card ${state}`}>
                <div className="criteria-card-title">{cfg.label}</div>
                <div className="criteria-card-sub">{cfg.sub}</div>
                <span className={`badge badge-${state || 'empty'}`}>
                  {state === 'detected' ? '✓ Detected' : state === 'possible' ? '~ Possible' : '— Not flagged'}
                </span>
              </div>
            )
          })}
        </div>

        <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>
          2 of 3 Rotterdam criteria must be met for a clinical PCOS diagnosis.
        </p>

        {result.topFlags?.length > 0 && (
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="section-label">Clinical Flags</div>
            <div className="flag-list">
              {result.topFlags.map((f, i) => (
                <div key={i} className="flag-item">
                  <div className="flag-dot" />
                  {f}
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={() => onNavigate('report')}>
            Generate Clinical Report →
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => { setResult(null); setSelected(new Set()); setSlide(0) }}
          >
            Start over
          </button>
        </div>
      </div>
    )
  }

  /* ── Carousel view ── */
  return (
    <div style={{ fontFamily: PAGE_FONT }}>
      <h1 className="page-title" style={{ fontFamily: HEAD_FONT, marginBottom: 6 }}>
        Build Your Case
      </h1>
      <p className="page-subtitle">
        Work through each category and select every symptom that applies to you.
      </p>

      {/* ── Progress indicator ── */}
      <div style={{ position: 'relative', marginBottom: 36 }}>
        {/* Track */}
        <div style={{
          position: 'absolute',
          top: 13,
          left: 'calc(12.5%)',
          right: 'calc(12.5%)',
          height: 2,
          background: 'var(--border)',
          borderRadius: 2,
        }}>
          <div style={{
            position: 'absolute',
            left: 0,
            top: 0,
            height: '100%',
            width: `${(slide / (SLIDES.length - 1)) * 100}%`,
            background: 'var(--lav-deep)',
            borderRadius: 2,
            transition: 'width 0.35s ease',
          }} />
        </div>

        {/* Dots + labels */}
        <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative' }}>
          {SLIDES.map((s, i) => (
            <div
              key={s.id}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}
            >
              <div style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: i <= slide ? 'var(--lav-deep)' : 'var(--surface)',
                border: `2px solid ${i <= slide ? 'var(--lav-deep)' : 'var(--border)'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                fontWeight: 700,
                color: i <= slide ? '#fff' : 'var(--muted)',
                transition: 'all 0.25s ease',
                boxShadow: i === slide ? '0 0 0 4px var(--lav-light)' : 'none',
                zIndex: 1,
              }}>
                {i < slide ? '✓' : i + 1}
              </div>
              <div style={{
                fontSize: 11,
                fontWeight: i === slide ? 700 : 400,
                color: i === slide ? 'var(--lav-deep)' : i < slide ? 'var(--muted)' : 'var(--faint)',
                textAlign: 'center',
                lineHeight: 1.3,
                maxWidth: 56,
                transition: 'color 0.2s ease',
              }}>
                {s.title}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Carousel ── */}
      <div style={{ overflow: 'hidden', marginBottom: 20 }}>
        <div style={{
          display: 'flex',
          transform: `translateX(-${slide * 100}%)`,
          transition: 'transform 0.38s cubic-bezier(0.4, 0, 0.2, 1)',
          willChange: 'transform',
        }}>
          {SLIDES.map((s, i) => {
            const slideCount = [...selected].filter(sym => s.symptoms.includes(sym)).length
            return (
              <div key={s.id} style={{ minWidth: '100%' }}>
                <div className="card" style={{ minHeight: 300 }}>
                  {/* Slide header */}
                  <div style={{ marginBottom: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                      <h2 style={{
                        fontFamily: HEAD_FONT,
                        fontSize: 28,
                        fontWeight: 600,
                        color: 'var(--text)',
                        lineHeight: 1.2,
                        margin: 0,
                      }}>
                        {s.title}
                      </h2>
                      {slideCount > 0 && (
                        <span style={{
                          flexShrink: 0,
                          marginTop: 4,
                          background: 'var(--lav-deep)',
                          color: '#fff',
                          borderRadius: 99,
                          padding: '3px 10px',
                          fontSize: 12,
                          fontWeight: 700,
                        }}>
                          {slideCount} selected
                        </span>
                      )}
                    </div>
                    <p style={{
                      fontSize: 14,
                      color: 'var(--muted)',
                      fontStyle: 'italic',
                      lineHeight: 1.5,
                      marginTop: 8,
                      marginBottom: 0,
                    }}>
                      {s.subtitle}
                    </p>
                  </div>

                  {/* Chips */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                    {s.symptoms.map(sym => (
                      <button
                        key={sym}
                        onClick={() => toggle(sym)}
                        style={{
                          padding: '9px 18px',
                          borderRadius: 99,
                          border: selected.has(sym)
                            ? '1.5px solid var(--lav-deep)'
                            : '1.5px solid var(--border)',
                          background: selected.has(sym) ? 'var(--lav-deep)' : 'var(--surface)',
                          color: selected.has(sym) ? '#fff' : 'var(--muted)',
                          fontSize: 13,
                          fontWeight: selected.has(sym) ? 600 : 500,
                          fontFamily: PAGE_FONT,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          lineHeight: 1,
                        }}
                      >
                        {sym}
                      </button>
                    ))}
                  </div>

                  {/* Anything else — last slide only */}
                  {i === SLIDES.length - 1 && (
                    <div style={{ marginTop: 28 }}>
                      <div className="section-label">Anything else?</div>
                      <textarea
                        rows={3}
                        placeholder="Any other symptoms or concerns in your own words…"
                        value={anythingElse}
                        onChange={e => setAnythingElse(e.target.value)}
                        style={{ fontFamily: PAGE_FONT }}
                      />
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Navigation ── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 28,
      }}>
        <button
          className="btn btn-ghost"
          onClick={goBack}
          style={{ visibility: slide === 0 ? 'hidden' : 'visible' }}
        >
          ← Back
        </button>
        <button
          className="btn btn-primary"
          onClick={goNext}
          disabled={loading}
        >
          {loading
            ? <><span className="spinner" /> Analysing…</>
            : isLast
              ? 'Build my case →'
              : 'Next →'}
        </button>
      </div>

      {/* ── Summary row ── */}
      {allSelected.length > 0 && (
        <div style={{
          background: 'var(--surface)',
          border: '1.5px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          padding: '16px 20px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--muted)',
            }}>
              Selected
            </span>
            <span style={{
              background: 'var(--lav-deep)',
              color: '#fff',
              borderRadius: 99,
              padding: '1px 8px',
              fontSize: 11,
              fontWeight: 700,
            }}>
              {allSelected.length}
            </span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {allSelected.map(sym => (
              <button
                key={sym}
                onClick={() => toggle(sym)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '4px 10px 4px 12px',
                  borderRadius: 99,
                  background: 'var(--lav-light)',
                  border: '1.5px solid var(--lav)',
                  color: 'var(--lav-deep)',
                  fontSize: 12,
                  fontWeight: 500,
                  fontFamily: PAGE_FONT,
                  cursor: 'pointer',
                }}
              >
                {sym}
                <span style={{ opacity: 0.5, fontSize: 15, lineHeight: 1 }}>×</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
