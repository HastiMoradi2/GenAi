import { useState } from 'react'
import { api } from '../lib/api'

const SLIDES = [
  {
    id: 'cycle',
    title: 'Period & Cycle',
    subtitle: 'Your cycle is one of the clearest windows into hormonal health.',
    symptoms: [
      'Periods more than 35 days apart',
      'Fewer than 8 periods a year',
      'No period for 3+ months',
      'Unpredictable cycle length',
      'Very heavy bleeding',
      'Bleeding for more than 7 days',
      'Spotting between periods',
      'Severe cramping',
      'Large clots during period',
      'Very light or short periods',
      'First period after age 15',
      'Cycle getting more irregular over time',
    ],
  },
  {
    id: 'hair',
    title: 'Hair Loss & Facial Hair',
    subtitle: 'Androgen-driven hair changes are a key diagnostic signal.',
    symptoms: [
      'Thinning hair at the crown',
      'Widening part line',
      'Receding hairline',
      'Excessive daily hair shedding',
      'Hair thinning at the temples',
      'Coarser hair texture',
      'Facial hair on chin or upper lip',
      'Hair on chest or stomach',
      'Hair on inner thighs or lower back',
      'Hair on toes or fingers',
      'Sideburn hair growth',
      'Eyebrow thinning (outer thirds)',
    ],
  },
  {
    id: 'skin',
    title: 'Skin & Acne',
    subtitle: 'Hormonal imbalances often surface on the skin first.',
    symptoms: [
      'Jawline or chin acne',
      'Acne that does not respond to treatment',
      'Back or chest acne',
      'Acne that worsens around your period',
      'Persistently oily skin',
      'Oily scalp',
      'Dark velvety patches on neck or armpits',
      'Dark skin in groin or inner thighs',
      'Small skin tags on neck or underarms',
      'Rough bumps on upper arms or thighs',
      'Skin that scars or marks easily',
      'Redness or flushing',
    ],
  },
  {
    id: 'weight',
    title: 'Weight & Metabolism',
    subtitle: "PCOS can make your body feel like it's working against you — that's not your fault.",
    symptoms: [
      'Weight gain mostly around the abdomen',
      'Difficulty losing weight despite effort',
      'Strong cravings for sugar or carbs',
      'Bloating after eating',
      'Feeling very full quickly',
      'Feeling shaky or faint between meals',
      'Excessive thirst',
      'Frequent urination',
      'Slow metabolism',
      'Weight that fluctuates a lot',
      'Difficulty gaining muscle',
      'Feeling cold often',
    ],
  },
  {
    id: 'fatigue',
    title: 'Fatigue & Energy',
    subtitle: 'Insulin resistance and hormonal shifts drain energy in very specific ways.',
    symptoms: [
      'Persistent tiredness not explained by sleep',
      'Energy crash after eating',
      'Brain fog or mental cloudiness',
      'Difficulty concentrating',
      'Memory lapses',
      'Low motivation most days',
      'Hard to wake up in the morning',
      'Afternoon energy slump',
      'Feeling exhausted after light activity',
      'Relying on caffeine to function',
      'Feeling wired but tired',
      'Low stamina during exercise',
    ],
  },
  {
    id: 'mood',
    title: 'Mood & Mental Health',
    subtitle: 'Hormonal imbalances affect far more than most people realise.',
    symptoms: [
      'Persistent low mood',
      'Anxiety or constant worry',
      'Mood swings tied to your cycle',
      'Irritability',
      'Feeling overwhelmed easily',
      'Low self-esteem related to symptoms',
      'Loss of interest in things you enjoy',
      'Emotional sensitivity',
      'Difficulty managing stress',
      'Feeling detached or numb',
      'Panic attacks',
      'Negative body image',
    ],
  },
  {
    id: 'sleep',
    title: 'Sleep',
    subtitle: 'Poor sleep and PCOS reinforce each other — both deserve attention.',
    symptoms: [
      'Trouble falling asleep',
      'Waking up during the night',
      'Waking up tired even after a full night',
      'Snoring or gasping during sleep',
      'Excessive daytime sleepiness',
      'Restless legs at night',
      'Night sweats',
      'Vivid or disturbing dreams',
      'Needing more than 9 hours to feel rested',
      'Sleep that varies a lot by cycle phase',
    ],
  },
  {
    id: 'pelvic',
    title: 'Pelvic Pain & Reproductive',
    subtitle: 'Structural and reproductive symptoms that matter for diagnosis.',
    symptoms: [
      'Pelvic pressure or aching',
      'Pain during sex',
      'Pain during ovulation',
      'Bloating or pressure mid-cycle',
      'Difficulty getting pregnant',
      'Recurrent miscarriage',
      'Ovarian cysts (previously diagnosed)',
      'One-sided pelvic pain',
      'Pain that radiates to lower back',
      'Pelvic pain unrelated to your period',
    ],
  },
  {
    id: 'hormonal',
    title: 'Hormonal Signs',
    subtitle: 'Subtler signs of hormonal dysregulation worth documenting.',
    symptoms: [
      'Increased body odour',
      'Breast tenderness',
      'Hot flashes or sudden heat',
      'Low sex drive',
      'Vaginal dryness',
      'Deepening voice',
      'Feeling more oily or sweaty than usual',
      'Symptoms that clearly shift with your cycle',
      'Cold intolerance — always feeling cold',
      'Sensitivity to temperature changes',
    ],
  },
  {
    id: 'gut',
    title: 'Gut & Inflammation',
    subtitle: 'The gut-hormone connection is well-established in PCOS research.',
    symptoms: [
      'Chronic bloating',
      'Constipation or very irregular bowel',
      'Nausea around your period',
      'Food sensitivities or intolerances',
      'Joint pain or stiffness',
      'Frequent headaches',
      'Headaches tied to your cycle',
      'Puffy face or swollen hands',
      'Slow digestion',
      "Feeling inflamed or 'off' without a clear cause",
    ],
  },
  {
    id: 'labs',
    title: 'Lab Results & Prior Testing',
    subtitle: 'If you have had any blood work or imaging, select anything that applies.',
    symptoms: [
      'Told your testosterone is high',
      'Told your AMH is elevated',
      'Irregular thyroid results (TSH)',
      'Insulin resistance flagged by a doctor',
      'Abnormal cholesterol or triglycerides',
      'Low vitamin D',
      'High LH relative to FSH',
      'Told your estrogen is imbalanced',
      'Borderline or pre-diabetic reading',
      'Ultrasound showed many small follicles',
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
      <div style={{ marginBottom: 28 }}>
        {/* Label row */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: 10,
        }}>
          <span style={{
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--text)',
            fontFamily: HEAD_FONT,
          }}>
            {SLIDES[slide].title}
          </span>
          <span style={{
            fontSize: 12,
            color: 'var(--muted)',
            fontWeight: 500,
          }}>
            {slide + 1} of {SLIDES.length}
          </span>
        </div>

        {/* Gradient fill bar */}
        <div style={{
          height: 4,
          background: 'var(--border)',
          borderRadius: 4,
          marginBottom: 14,
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${((slide + 1) / SLIDES.length) * 100}%`,
            background: 'linear-gradient(90deg, var(--lav-deep), var(--peach))',
            borderRadius: 4,
            transition: 'width 0.35s ease',
          }} />
        </div>

        {/* Scrollable pill dots */}
        <div style={{
          display: 'flex',
          gap: 5,
          overflowX: 'auto',
          paddingBottom: 2,
          scrollbarWidth: 'none',
        }}>
          {SLIDES.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setSlide(i)}
              style={{
                flexShrink: 0,
                height: 6,
                width: i === slide ? 28 : 10,
                borderRadius: 99,
                border: 'none',
                background: i < slide
                  ? 'var(--lav-mid)'
                  : i === slide
                    ? 'var(--lav-deep)'
                    : 'var(--border)',
                cursor: 'pointer',
                padding: 0,
                transition: 'width 0.25s ease, background 0.2s ease',
              }}
              aria-label={s.title}
            />
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
                          padding: '10px 16px',
                          borderRadius: 99,
                          border: selected.has(sym)
                            ? '1.5px solid var(--lav-deep)'
                            : '1.5px solid var(--border)',
                          background: selected.has(sym) ? 'var(--lav-deep)' : 'var(--surface)',
                          color: selected.has(sym) ? '#fff' : 'var(--muted)',
                          fontSize: 15,
                          fontWeight: selected.has(sym) ? 600 : 500,
                          fontFamily: PAGE_FONT,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          lineHeight: 1.2,
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
