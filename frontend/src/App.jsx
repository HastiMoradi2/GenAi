import { useState } from 'react'
import { useToast } from './hooks/useToast'
import { useMagicCards } from './hooks/useMagicCards'
import Aurora from './components/Aurora'
import Symptoms from './pages/Symptoms'
import CycleTracker from './pages/CycleTracker'
import HealthData from './pages/HealthData'
import Report from './pages/Report'
import FindCare from './pages/FindCare'
import IfDismissed from './pages/IfDismissed'

const TABS = [
  { id: 'symptoms',   label: 'Symptoms' },
  { id: 'cycle',      label: 'Cycle' },
  { id: 'health',     label: 'Health Data' },
  { id: 'report',     label: 'Report' },
  { id: 'book',       label: 'Find Care' },
  { id: 'dismissed',  label: 'If Dismissed' },
]

export default function App() {
  const [activeTab, setActiveTab] = useState('symptoms')
  const { toasts, showToast, removeToast } = useToast()
  useMagicCards({ particleCount: 12 })

  const renderPage = () => {
    switch (activeTab) {
      case 'symptoms':  return <Symptoms showToast={showToast} onNavigate={setActiveTab} />
      case 'cycle':     return <CycleTracker showToast={showToast} />
      case 'health':    return <HealthData showToast={showToast} />
      case 'report':    return <Report showToast={showToast} />
      case 'book':      return <FindCare showToast={showToast} />
      case 'dismissed': return <IfDismissed showToast={showToast} />
      default:          return null
    }
  }

  return (
    <>
      {/* ── Global aurora background (sibling of app-shell, never inside its stacking context) ── */}
      <div className="aurora-bg">
        <Aurora
          colorStops={['#1133ee', '#6633dd', '#cc44ff']}
          blend={0.65}
          amplitude={1.3}
          speed={0.6}
        />
      </div>

    <div className="app-shell">
      {/* ── Top nav ── */}
      <header className="topnav">
        <div className="topnav-inner">
          <div className="brand">
            <span className="brand-name">Clover</span>
            <span className="brand-tag">PCOS Early Detection</span>
          </div>
          <nav className="tab-nav">
            {TABS.map(t => (
              <button
                key={t.id}
                className={`tab-btn ${activeTab === t.id ? 'active' : ''}`}
                onClick={() => setActiveTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* ── Page content ── */}
      <main className="page-content">
        {renderPage()}
      </main>

      {/* ── Toast container ── */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.type}`} onClick={() => removeToast(t.id)}>
            <span>{t.message}</span>
            <button className="toast-close">×</button>
          </div>
        ))}
      </div>
    </div>
    </>
  )
}
