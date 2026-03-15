import { useState, useRef } from 'react'
import { api } from '../lib/api'
import { SLIDES } from '../data/symptoms'

const HEAD_FONT = "'Playfair Display', 'Instrument Serif', serif"
const PAGE_FONT = "'DM Sans', 'Plus Jakarta Sans', sans-serif"

const SECTION_TITLES = [
  'SECTION 1 — PATIENT OVERVIEW',
  'SECTION 2 — SYMPTOM TIMELINE AND PATTERNS',
  'SECTION 3 — ROTTERDAM CRITERIA ASSESSMENT',
  'SECTION 4 — PASSIVE HEALTH DATA ANALYSIS',
  'SECTION 5 — CLINICAL RECOMMENDATIONS',
]

const CRITERIA_CONFIG = {
  cycle:    { label: 'Menstrual Irregularity', sub: 'Anovulation or oligo-ovulation' },
  androgen: { label: 'Hyperandrogenism',       sub: 'Clinical or biochemical signs' },
  ovary:    { label: 'Polycystic Ovaries',     sub: 'Ultrasound or AMH elevation' },
}

const CATEGORY_COLORS = [
  '#3B9EFF', '#22C7A9', '#FF6B9D', '#FFB830',
  '#A78BFA', '#34D399', '#FB923C', '#60A5FA',
  '#F472B6', '#4ADE80', '#FACC15',
]

function parseSections(text) {
  if (!text) return []
  const sections = []
  let remaining = text
  for (let i = 0; i < SECTION_TITLES.length; i++) {
    const thisTitle = SECTION_TITLES[i]
    const nextTitle = SECTION_TITLES[i + 1]
    const startIdx = remaining.indexOf(thisTitle)
    if (startIdx === -1) continue
    const bodyStart = startIdx + thisTitle.length
    const endIdx = nextTitle ? remaining.indexOf(nextTitle, bodyStart) : remaining.length
    const body = remaining.slice(bodyStart, endIdx !== -1 ? endIdx : undefined).trim()
    sections.push({ title: thisTitle, body })
  }
  return sections
}

function strengthLabel(v) {
  if (v >= 86) return 'Very strong'
  if (v >= 61) return 'Strong'
  if (v >= 31) return 'Moderate'
  return 'Minimal signals'
}

/* ── Circular gauge using SVG ── */
function CaseGauge({ value }) {
  const r = 52
  const circ = 2 * Math.PI * r
  const fill = (value / 100) * circ
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <svg width="130" height="130" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="65" cy="65" r={r} fill="none" stroke="rgba(0,50,150,0.12)" strokeWidth="10" />
        <circle
          cx="65" cy="65" r={r} fill="none"
          stroke="url(#gaugeGrad)"
          strokeWidth="10"
          strokeDasharray={`${fill} ${circ}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 1s ease' }}
        />
        <defs>
          <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#0033cc" />
            <stop offset="100%" stopColor="#006633" />
          </linearGradient>
        </defs>
        <foreignObject x="15" y="15" width="100" height="100">
          <div style={{
            width: '100%', height: '100%',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            transform: 'rotate(90deg)',
          }}>
            <span style={{ fontSize: 26, fontWeight: 700, color: 'var(--text)', fontFamily: HEAD_FONT, lineHeight: 1 }}>
              {value}<span style={{ fontSize: 14 }}>%</span>
            </span>
            <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: PAGE_FONT, marginTop: 2 }}>
              {strengthLabel(value)}
            </span>
          </div>
        </foreignObject>
      </svg>
      <span style={{ color: 'var(--muted)', fontSize: 12, fontFamily: PAGE_FONT, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        Case Strength
      </span>
    </div>
  )
}

/* ── Transparent glass card with cursor-light ── */
function GlassCard({ children, style }) {
  const ref = useRef(null)
  function onMouseMove(e) {
    const card = ref.current
    if (!card) return
    const rect = card.getBoundingClientRect()
    card.style.setProperty('--gx', `${e.clientX - rect.left}px`)
    card.style.setProperty('--gy', `${e.clientY - rect.top}px`)
  }
  return (
    <div
      ref={ref}
      onMouseMove={onMouseMove}
      style={{
        background: 'rgba(255,255,255,0.38)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1.5px solid rgba(255,255,255,0.6)',
        borderRadius: 16,
        padding: '18px 20px',
        position: 'relative',
        overflow: 'hidden',
        '--gx': '50%',
        '--gy': '50%',
        ...style,
      }}
    >
      {/* cursor-following light */}
      <div style={{
        position: 'absolute', inset: 0, borderRadius: 'inherit', pointerEvents: 'none',
        background: 'radial-gradient(180px at var(--gx) var(--gy), rgba(255,255,255,0.55), transparent 70%)',
      }} />
      <div style={{ position: 'relative', zIndex: 1 }}>{children}</div>
    </div>
  )
}

/* ── Category breakdown bar ── */
function CategoryBar({ label, count, total, color, index }) {
  const pct = total === 0 ? 0 : Math.round((count / total) * 100)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
      <div style={{ width: 130, fontSize: 13, color: 'var(--muted)', fontFamily: PAGE_FONT, flexShrink: 0, textAlign: 'right' }}>
        {label}
      </div>
      <div style={{ flex: 1, height: 8, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: color,
          borderRadius: 99,
          transition: `width 0.8s ${index * 0.05}s ease`,
          minWidth: count > 0 ? 6 : 0,
        }} />
      </div>
      <div style={{ width: 28, fontSize: 13, fontWeight: 700, color: count > 0 ? color : 'var(--faint)', fontFamily: PAGE_FONT }}>
        {count}
      </div>
    </div>
  )
}

export default function Report({ showToast }) {
  const [loading, setLoading] = useState(false)
  const [report, setReport]   = useState('')
  const [copied, setCopied]   = useState(false)

  const savedSymptoms = (() => {
    try { return JSON.parse(localStorage.getItem('clover_symptoms') || '[]') } catch { return [] }
  })()
  const savedAnything = localStorage.getItem('clover_anything_else') || ''
  const savedCriteria = (() => {
    try { return JSON.parse(localStorage.getItem('clover_criteria_state') || '{}') } catch { return {} }
  })()
  const caseStrength = parseInt(localStorage.getItem('clover_case_strength') || '0')

  /* compute per-category counts */
  const categoryBreakdown = SLIDES.map((slide, i) => ({
    id: slide.id,
    label: slide.title,
    count: slide.symptoms.filter(s => savedSymptoms.includes(s)).length,
    total: slide.symptoms.length,
    color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
  })).filter(c => c.count > 0)

  async function generateReport() {
    if (savedSymptoms.length === 0) {
      showToast('Please build your symptom case first on the Symptoms tab', 'error')
      return
    }
    setLoading(true)
    setReport('')
    try {
      const data = await api.report(savedSymptoms, savedAnything, '', savedCriteria)
      setReport(data.report)
    } catch (e) {
      showToast(e.message || 'Report generation failed', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function copyReport() {
    try {
      await navigator.clipboard.writeText(report)
      setCopied(true)
      showToast('Report copied to clipboard', 'success')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      showToast('Could not copy — please select and copy manually', 'error')
    }
  }

  function printReport() {
    const win = window.open('', '_blank')
    win.document.write(`
      <html><head><title>Clover PCOS Report</title>
      <style>
        body { font-family: Georgia, serif; max-width: 700px; margin: 40px auto; color: #1A1F2E; line-height: 1.8; font-size: 15px; }
        h1 { font-size: 24px; margin-bottom: 8px; }
        .subtitle { color: #56677A; margin-bottom: 32px; font-size: 13px; }
        .section-title { font-weight: bold; font-size: 12px; letter-spacing: 0.06em; text-transform: uppercase; border-left: 3px solid #2070B4; padding-left: 10px; margin: 28px 0 12px; color: #2070B4; }
        .section-body { white-space: pre-wrap; }
        .footer { margin-top: 40px; font-size: 12px; color: #999; border-top: 1px solid #eee; padding-top: 16px; }
      </style></head><body>
      <h1>Clover PCOS Clinical Report</h1>
      <div class="subtitle">Generated ${new Date().toLocaleDateString()} · For clinical discussion with your GP</div>
      ${parseSections(report).map(s => `
        <div class="section-title">${s.title}</div>
        <div class="section-body">${s.body}</div>
      `).join('')}
      <div class="footer">This report was generated by Clover and does not constitute a medical diagnosis. It is intended solely to support clinical discussion with a qualified healthcare provider.</div>
      </body></html>
    `)
    win.document.close()
    win.print()
  }

  const sections = parseSections(report)
  const hasCaseData = savedSymptoms.length > 0

  return (
    <div style={{ fontFamily: PAGE_FONT }}>
      <div className="page-header">
        <h1 className="page-title" style={{ fontFamily: HEAD_FONT }}>Clinical Report</h1>
        <p className="page-subtitle">A structured, evidence-based symptom report formatted for your GP.</p>
      </div>

      {/* ── Visual dashboard ── */}
      {hasCaseData && (
        <div style={{
          marginBottom: 28,
          padding: '36px 0',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 28,
        }}>
            {/* Gauge + Rotterdam row */}
            <div style={{
              display: 'flex',
              gap: 28,
              alignItems: 'center',
              flexWrap: 'wrap',
              justifyContent: 'center',
              width: '100%',
            }}>
              {/* Gauge */}
              <CaseGauge value={caseStrength} />

              {/* Rotterdam criteria glass cards */}
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
                {Object.entries(CRITERIA_CONFIG).map(([key, cfg]) => {
                  const state = savedCriteria[key] || ''
                  const accent =
                    state === 'detected' ? '#178068' :
                    state === 'possible' ? '#886800' :
                    'var(--faint)'
                  const icon =
                    state === 'detected' ? '✓' :
                    state === 'possible' ? '~' : '—'
                  return (
                    <GlassCard key={key} style={{ minWidth: 160, textAlign: 'center' }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: '50%',
                        background: state ? `${accent}22` : 'rgba(0,0,0,0.04)',
                        border: `1.5px solid ${accent}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 16, fontWeight: 700, color: accent,
                        margin: '0 auto 10px',
                      }}>
                        {icon}
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 4, fontFamily: PAGE_FONT }}>
                        {cfg.label}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 10, fontFamily: PAGE_FONT }}>
                        {cfg.sub}
                      </div>
                      <span style={{
                        display: 'inline-block',
                        padding: '2px 10px',
                        borderRadius: 99,
                        fontSize: 11,
                        fontWeight: 700,
                        color: accent,
                        background: state ? `${accent}22` : 'transparent',
                        border: `1px solid ${accent}55`,
                        fontFamily: PAGE_FONT,
                      }}>
                        {state === 'detected' ? 'Detected' : state === 'possible' ? 'Possible' : 'Not flagged'}
                      </span>
                    </GlassCard>
                  )
                })}
              </div>
            </div>

            {/* Symptom count summary */}
            <GlassCard style={{ width: '100%', maxWidth: 640 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)', fontFamily: PAGE_FONT }}>
                  Symptoms flagged
                </span>
                <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', fontFamily: HEAD_FONT }}>
                  {savedSymptoms.length}
                  <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 400, marginLeft: 4 }}>selected</span>
                </span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {savedSymptoms.slice(0, 18).map(s => (
                  <span key={s} style={{
                    padding: '4px 11px',
                    borderRadius: 99,
                    fontSize: 12,
                    background: 'rgba(255,255,255,0.45)',
                    border: '1px solid rgba(255,255,255,0.65)',
                    color: 'var(--text)',
                    fontFamily: PAGE_FONT,
                  }}>{s}</span>
                ))}
                {savedSymptoms.length > 18 && (
                  <span style={{ padding: '4px 11px', borderRadius: 99, fontSize: 12, color: 'var(--muted)', fontFamily: PAGE_FONT }}>
                    +{savedSymptoms.length - 18} more
                  </span>
                )}
              </div>
            </GlassCard>
        </div>
      )}

      {/* ── Category breakdown ── */}
      {categoryBreakdown.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="section-label" style={{ marginBottom: 16 }}>Symptom breakdown by category</div>
          {categoryBreakdown.map((c, i) => (
            <CategoryBar key={c.id} {...c} index={i} />
          ))}
        </div>
      )}

      {/* ── Empty state ── */}
      {!hasCaseData && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="empty-state">
            <div className="empty-state-title">No symptoms saved yet</div>
            <div className="empty-state-desc">Go to the Symptoms tab, build your case, then come back here to generate your report.</div>
          </div>
        </div>
      )}

      {/* ── Actions ── */}
      <div className="report-actions">
        <button
          className="btn btn-primary"
          onClick={generateReport}
          disabled={loading || !hasCaseData}
        >
          {loading ? <><span className="spinner" /> Generating report…</> : 'Generate Report'}
        </button>
        {report && (
          <>
            <button className="btn btn-ghost" onClick={copyReport}>
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <button className="btn btn-ghost" onClick={printReport}>
              Print / Save PDF
            </button>
          </>
        )}
      </div>

      {loading && (
        <div className="loading-box">
          <span className="spinner dark" style={{ width: 28, height: 28, borderWidth: 3 }} />
          <div>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>Generating your clinical report…</div>
            <div style={{ fontSize: 13 }}>This typically takes 10–20 seconds. Claude is writing a detailed 5-section document.</div>
          </div>
        </div>
      )}

      {/* ── Report sections ── */}
      {sections.length > 0 && (
        <div className="card">
          {sections.map((s, i) => (
            <div key={i} className="report-section">
              <div className="report-section-title">{s.title}</div>
              <div className="report-body">{s.body}</div>
              {i < sections.length - 1 && <div className="divider" style={{ marginTop: 20 }} />}
            </div>
          ))}
        </div>
      )}

      {report && sections.length === 0 && (
        <div className="card">
          <div className="report-body">{report}</div>
        </div>
      )}
    </div>
  )
}
