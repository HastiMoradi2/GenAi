import { useState, useCallback } from 'react'

const STORAGE_KEY = 'clover_cycle_data'

function load() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
  } catch {
    return {}
  }
}

function save(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

// Returns an array of all period day strings sorted ascending
function getPeriodDays(data) {
  return Object.keys(data).filter(k => data[k]?.isPeriod).sort()
}

// Compute average cycle length from period day strings
function computeAvgCycle(periodDays) {
  if (periodDays.length < 2) return null
  // Find cycle starts: first day of each run
  const starts = []
  for (let i = 0; i < periodDays.length; i++) {
    if (i === 0) { starts.push(periodDays[i]); continue; }
    const prev = new Date(periodDays[i - 1])
    const curr = new Date(periodDays[i])
    const diff = (curr - prev) / 86400000
    if (diff > 2) starts.push(periodDays[i])  // gap > 2 days = new cycle
  }
  if (starts.length < 2) return null
  const gaps = []
  for (let i = 1; i < starts.length; i++) {
    const a = new Date(starts[i - 1])
    const b = new Date(starts[i])
    gaps.push(Math.round((b - a) / 86400000))
  }
  return Math.round(gaps.reduce((s, v) => s + v, 0) / gaps.length)
}

export function useCycleData() {
  const [data, setData] = useState(load)

  const togglePeriod = useCallback((dateStr) => {
    setData(prev => {
      const next = { ...prev, [dateStr]: { ...prev[dateStr], isPeriod: !prev[dateStr]?.isPeriod } }
      save(next)
      return next
    })
  }, [])

  const toggleDaySymptom = useCallback((dateStr, symptom) => {
    setData(prev => {
      const daySymptoms = prev[dateStr]?.symptoms || []
      const has = daySymptoms.includes(symptom)
      const updated = has ? daySymptoms.filter(s => s !== symptom) : [...daySymptoms, symptom]
      const next = { ...prev, [dateStr]: { ...prev[dateStr], symptoms: updated } }
      save(next)
      return next
    })
  }, [])

  const getDayData = useCallback((dateStr) => data[dateStr] || {}, [data])

  const periodDays = getPeriodDays(data)
  const avgCycleLength = computeAvgCycle(periodDays)

  // Collect all unique symptoms logged
  const allLoggedSymptoms = [...new Set(
    Object.values(data).flatMap(d => d.symptoms || [])
  )]

  return { data, togglePeriod, toggleDaySymptom, getDayData, periodDays, avgCycleLength, allLoggedSymptoms }
}
