import { useState } from 'react'
import { api } from '../lib/api'

const SPECIALISTS = [
  { name: 'Dr. Miriam Adeyemi', specialty: 'Reproductive Endocrinology', hospital: 'Toronto General Hospital', location: 'Toronto, ON', waitTime: '4–6 months' },
  { name: 'Dr. Sarah Kwan', specialty: 'Obstetrics & Gynecology', hospital: 'Sunnybrook Health Sciences', location: 'Toronto, ON', waitTime: '2–3 months' },
  { name: 'Dr. Priya Nambiar', specialty: 'Endocrinology & Metabolism', hospital: 'Mount Sinai Hospital', location: 'Toronto, ON', waitTime: '3–5 months' },
  { name: 'Dr. Leila Rahimi', specialty: "Women's Health & PCOS", hospital: "Women's College Hospital", location: 'Toronto, ON', waitTime: '2–4 months' },
]

const ESCALATION_STEPS = [
  {
    title: 'Send the second opinion letter',
    desc: 'Email or hand-deliver your Clover-generated letter to your family doctor. Request that your concerns be formally documented in your patient file.',
  },
  {
    title: 'Ask for a direct referral',
    desc: 'Specifically request a referral to an endocrinologist or gynecologist. You are entitled to a second opinion — your GP is required to facilitate this.',
  },
  {
    title: 'Book a second GP appointment',
    desc: 'If your current doctor remains dismissive, book with a different GP at the same clinic or a walk-in clinic. Bring your Clover report.',
  },
  {
    title: 'Request a specific lab panel',
    desc: 'Ask for: testosterone (total + free), LH/FSH ratio, fasting insulin, HbA1c, AMH, vitamin D, and thyroid panel. You can cite the Rotterdam Criteria (2003) as justification.',
  },
  {
    title: 'File a formal complaint if needed',
    desc: 'If you continue to be dismissed without adequate explanation, you can contact the College of Physicians and Surgeons in your province to file a formal concern.',
  },
]

export default function IfDismissed({ showToast }) {
  const [loading, setLoading] = useState(false)
  const [letter, setLetter] = useState('')
  const [copied, setCopied] = useState(false)

  const savedSymptoms = (() => {
    try { return JSON.parse(localStorage.getItem('clover_symptoms') || '[]') } catch { return [] }
  })()

  async function generateLetter() {
    setLoading(true)
    setLetter('')
    try {
      const data = await api.letter(savedSymptoms)
      setLetter(data.letter)
    } catch (e) {
      showToast(e.message || 'Letter generation failed', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function copyLetter() {
    try {
      await navigator.clipboard.writeText(letter)
      setCopied(true)
      showToast('Letter copied to clipboard', 'success')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      showToast('Could not copy — please select manually', 'error')
    }
  }

  return (
    <div>
      <h1 className="page-title">If Your Doctor Dismisses You</h1>
      <p className="page-subtitle">You deserve to be taken seriously. Here's your advocacy toolkit.</p>

      <div className="two-col" style={{ alignItems: 'start' }}>
        {/* ── Left column ── */}
        <div>
          {/* Second opinion letter */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="section-label" style={{ marginBottom: 4 }}>Second Opinion Letter</div>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16, lineHeight: 1.6 }}>
              A formal, professional letter requesting documentation of your concerns and a specialist referral. Written by AI, reviewed by you, signed by your hand.
            </p>

            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
              <button
                className="btn btn-primary"
                onClick={generateLetter}
                disabled={loading}
              >
                {loading ? <><span className="spinner" /> Writing letter…</> : 'Generate Letter'}
              </button>
              {letter && (
                <button className="btn btn-ghost" onClick={copyLetter}>
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              )}
            </div>

            {loading && (
              <div className="loading-box" style={{ padding: 32 }}>
                <span className="spinner dark" />
                <div style={{ fontSize: 13, color: 'var(--muted)' }}>Drafting your letter…</div>
              </div>
            )}

            {letter && (
              <div style={{
                background: 'var(--bg)',
                border: '1.5px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: 24,
                marginTop: 4,
              }}>
                <div className="letter-body">{letter}</div>
              </div>
            )}

            {!letter && !loading && (
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                {savedSymptoms.length > 0
                  ? `Will use your ${savedSymptoms.length} logged symptoms as context.`
                  : 'Tip: Log your symptoms on the Symptoms tab first for a more personalised letter.'}
              </div>
            )}
          </div>

          {/* Escalation guide */}
          <div className="card">
            <div className="section-label" style={{ marginBottom: 16 }}>Escalation Guide</div>
            <div className="step-list">
              {ESCALATION_STEPS.map((step, i) => (
                <div key={i} className="step-item">
                  <div className="step-number">{i + 1}</div>
                  <div>
                    <div className="step-title">{step.title}</div>
                    <div className="step-desc">{step.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Right column: specialists ── */}
        <div>
          <div className="card">
            <div className="section-label" style={{ marginBottom: 4 }}>Specialist Finder</div>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
              PCOS-specialised doctors in Ontario who accept referrals.
            </p>

            {SPECIALISTS.map((sp, i) => (
              <div key={i} className="specialist-card">
                <div className="specialist-avatar">{sp.name.split(' ')[1]?.[0] || 'Dr'}</div>
                <div>
                  <div className="specialist-name">{sp.name}</div>
                  <div className="specialist-meta">{sp.specialty}</div>
                  <div className="specialist-hospital">{sp.hospital} · {sp.location}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                    Avg wait: {sp.waitTime}
                  </div>
                </div>
              </div>
            ))}

            <div style={{ marginTop: 16, padding: 14, background: 'var(--lav-light)', borderRadius: 'var(--radius-sm)', fontSize: 12, color: 'var(--muted)' }}>
              Specialist data is for illustrative purposes. Always confirm availability and referral requirements with your GP or directly with the hospital.
            </div>
          </div>

          {/* Rights section */}
          <div className="card" style={{ marginTop: 16 }}>
            <div className="section-label" style={{ marginBottom: 12 }}>Your Rights as a Patient</div>
            {[
              ['Right to information', 'Your doctor must explain their reasoning if they decline to order tests or referrals.'],
              ['Right to a second opinion', 'You can always request a referral to another doctor or specialist.'],
              ['Right to documentation', 'All concerns discussed in an appointment must be documented in your file upon request.'],
              ['Right to choose your provider', 'You can change your family doctor at any time without giving a reason.'],
            ].map(([title, desc], i) => (
              <div key={i} style={{ marginBottom: i < 3 ? 14 : 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{title}</div>
                <div style={{ fontSize: 13, color: 'var(--muted)' }}>{desc}</div>
                {i < 3 && <div className="divider" style={{ marginTop: 14 }} />}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
