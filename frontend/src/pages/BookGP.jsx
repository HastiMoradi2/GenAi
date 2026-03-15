import { useState, useEffect, useRef } from 'react'
import { api } from '../lib/api'

const TIME_SLOTS = ['9:00 AM', '10:00 AM', '11:00 AM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '4:30 PM']

function toISO(dateStr, timeStr) {
  const [time, period] = timeStr.split(' ')
  let [h, m] = time.split(':').map(Number)
  if (period === 'PM' && h !== 12) h += 12
  if (period === 'AM' && h === 12) h = 0
  return `${dateStr}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00`
}

function minDateStr() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}

export default function BookGP({ showToast }) {
  const mapRef = useRef(null)
  const mapInstance = useRef(null)
  const [doctors, setDoctors] = useState([])
  const [selectedDoctor, setSelectedDoctor] = useState(null)
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedSlot, setSelectedSlot] = useState('')
  const [calendarToken, setCalendarToken] = useState('')
  const [checkResult, setCheckResult] = useState(null)
  const [booking, setBooking] = useState(null)
  const [loadingMap, setLoadingMap] = useState(false)
  const [loadingCheck, setLoadingCheck] = useState(false)
  const [loadingBook, setLoadingBook] = useState(false)
  const markers = useRef([])

  // Read calendar token from URL hash (set by OAuth callback) or localStorage
  useEffect(() => {
    const hash = window.location.hash
    if (hash.startsWith('#gcal=')) {
      const token = decodeURIComponent(hash.slice(6))
      setCalendarToken(token)
      localStorage.setItem('gcal_token', token)
      window.history.replaceState({}, '', window.location.pathname + window.location.search)
    } else {
      const stored = localStorage.getItem('gcal_token')
      if (stored) setCalendarToken(stored)
    }
  }, [])

  // Initialise map once Maps API is ready
  useEffect(() => {
    function init() {
      if (!mapRef.current || mapInstance.current) return
      mapInstance.current = new window.google.maps.Map(mapRef.current, {
        center: { lat: 43.651070, lng: -79.347015 },  // Toronto default
        zoom: 12,
        styles: [
          { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
        ],
        disableDefaultUI: false,
        zoomControl: true,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      })
    }

    if (window.google?.maps) {
      init()
    } else {
      const timer = setInterval(() => {
        if (window.google?.maps) { clearInterval(timer); init() }
      }, 300)
      return () => clearInterval(timer)
    }
  }, [])

  function clearMarkers() {
    markers.current.forEach(m => m.setMap(null))
    markers.current = []
  }

  function searchDoctors() {
    if (!window.google?.maps || !mapInstance.current) {
      showToast('Google Maps is still loading — please wait a moment', 'error')
      return
    }
    setLoadingMap(true)
    setDoctors([])
    clearMarkers()

    // Try to use user's location first
    const doSearch = (center) => {
      mapInstance.current.setCenter(center)
      const service = new window.google.maps.places.PlacesService(mapInstance.current)
      service.textSearch(
        { query: 'PCOS doctor gynecologist endocrinologist', location: center, radius: 15000 },
        (results, status) => {
          setLoadingMap(false)
          if (status !== window.google.maps.places.PlacesServiceStatus.OK || !results) {
            showToast('No results found. Try enabling location access.', 'error')
            return
          }
          const top = results.slice(0, 8)
          setDoctors(top)

          // Add markers
          top.forEach((place, i) => {
            const loc = place.geometry?.location
            if (!loc) return
            const marker = new window.google.maps.Marker({
              position: loc,
              map: mapInstance.current,
              title: place.name,
              label: { text: String(i + 1), color: '#fff', fontWeight: 'bold', fontSize: '12px' },
              icon: {
                path: window.google.maps.SymbolPath.CIRCLE,
                scale: 16,
                fillColor: '#6A4ED4',
                fillOpacity: 1,
                strokeColor: '#fff',
                strokeWeight: 2,
              },
            })
            marker.addListener('click', () => setSelectedDoctor(top[i]))
            markers.current.push(marker)
          })

          // Fit map to markers
          const bounds = new window.google.maps.LatLngBounds()
          top.forEach(p => { if (p.geometry?.location) bounds.extend(p.geometry.location) })
          mapInstance.current.fitBounds(bounds)
        }
      )
    }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => doSearch({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => doSearch({ lat: 43.651070, lng: -79.347015 })
      )
    } else {
      doSearch({ lat: 43.651070, lng: -79.347015 })
    }
  }

  function connectCalendar() {
    window.location.href = '/api/calendar/auth'
  }

  function disconnectCalendar() {
    setCalendarToken('')
    localStorage.removeItem('gcal_token')
    setCheckResult(null)
    showToast('Google Calendar disconnected', 'info')
  }

  async function checkAvailability() {
    if (!calendarToken || !selectedDate || !selectedSlot || !selectedDoctor) return
    setLoadingCheck(true)
    setCheckResult(null)
    try {
      const iso = toISO(selectedDate, selectedSlot)
      const result = await api.calendarCheck(calendarToken, iso)
      setCheckResult(result)
    } catch (e) {
      if (e.message.includes('401')) {
        showToast('Calendar session expired — please reconnect', 'error')
        setCalendarToken('')
        localStorage.removeItem('gcal_token')
      } else {
        showToast(e.message || 'Availability check failed', 'error')
      }
    } finally {
      setLoadingCheck(false)
    }
  }

  async function bookAppointment() {
    if (!calendarToken || !selectedDate || !selectedSlot || !selectedDoctor) return
    setLoadingBook(true)
    try {
      const iso = toISO(selectedDate, selectedSlot)
      const result = await api.calendarBook(
        calendarToken,
        iso,
        60,
        selectedDoctor.name,
        selectedDoctor.formatted_address || selectedDoctor.vicinity || '',
        'PCOS consultation booked via Clover'
      )
      setBooking(result)
      showToast('Appointment booked! Check your Google Calendar.', 'success')
    } catch (e) {
      if (e.message.includes('401')) {
        showToast('Calendar session expired — please reconnect', 'error')
        setCalendarToken('')
        localStorage.removeItem('gcal_token')
      } else {
        showToast(e.message || 'Booking failed', 'error')
      }
    } finally {
      setLoadingBook(false)
    }
  }

  const canCheck = calendarToken && selectedDate && selectedSlot && selectedDoctor
  const canBook = canCheck && checkResult?.free === true

  if (booking) {
    return (
      <div>
        <h1 className="page-title">Appointment Booked!</h1>
        <div className="card" style={{ textAlign: 'center', padding: 48 }}>
          <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--lav-deep)', marginBottom: 16 }}>Booked</div>
          <div style={{ fontFamily: 'Instrument Serif, serif', fontSize: 22, marginBottom: 8 }}>
            {booking.summary}
          </div>
          <div style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 4 }}>
            {selectedDate} at {selectedSlot}
          </div>
          <div style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 24 }}>
            {selectedDoctor?.formatted_address || selectedDoctor?.vicinity || ''}
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
          <div style={{ marginTop: 16 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => { setBooking(null); setSelectedDoctor(null); setCheckResult(null) }}>
              Book another appointment
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="page-title">Book a GP Appointment</h1>
      <p className="page-subtitle">Find PCOS-aware doctors near you and book directly into your Google Calendar.</p>

      {/* ── Map ── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div className="section-label" style={{ marginBottom: 0 }}>Nearby Doctors</div>
          <button
            className="btn btn-secondary btn-sm"
            onClick={searchDoctors}
            disabled={loadingMap}
          >
            {loadingMap ? <><span className="spinner dark" /> Searching…</> : 'Search near me'}
          </button>
        </div>

        <div className="map-container" ref={mapRef} />

        {doctors.length > 0 && (
          <div className="doctor-list" style={{ marginTop: 14 }}>
            {doctors.map((doc, i) => (
              <div
                key={doc.place_id || i}
                className={`doctor-card ${selectedDoctor?.place_id === doc.place_id ? 'selected' : ''}`}
                onClick={() => setSelectedDoctor(doc)}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{
                      width: 22, height: 22, borderRadius: '50%',
                      background: 'var(--lav-deep)', color: '#fff',
                      fontSize: 11, fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0
                    }}>{i + 1}</span>
                    <div className="doctor-name">{doc.name}</div>
                  </div>
                  <div className="doctor-meta">{doc.formatted_address || doc.vicinity || ''}</div>
                  {doc.opening_hours?.open_now !== undefined && (
                    <div style={{ fontSize: 11, marginTop: 4, color: doc.opening_hours.open_now ? 'var(--mint-deep)' : 'var(--peach-deep)', fontWeight: 600 }}>
                      {doc.opening_hours.open_now ? '● Open now' : '● Closed'}
                    </div>
                  )}
                </div>
                {doc.rating && (
                  <div className="doctor-rating">{doc.rating}</div>
                )}
              </div>
            ))}
          </div>
        )}

        {doctors.length === 0 && !loadingMap && (
          <div className="empty-state" style={{ padding: 24 }}>
            <div className="empty-state-title">Click "Search near me"</div>
            <div className="empty-state-desc">We'll find PCOS-aware GPs, gynecologists, and endocrinologists in your area.</div>
          </div>
        )}
      </div>

      {/* ── Selected doctor + date/slot ── */}
      {selectedDoctor && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="section-label">Selected</div>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{selectedDoctor.name}</div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>
            {selectedDoctor.formatted_address || selectedDoctor.vicinity || ''}
          </div>

          <div className="section-label">Date</div>
          <input
            type="date"
            min={minDateStr()}
            value={selectedDate}
            onChange={e => { setSelectedDate(e.target.value); setCheckResult(null) }}
            style={{ marginBottom: 20, maxWidth: 200 }}
          />

          <div className="section-label">Time slot</div>
          <div className="slot-grid" style={{ marginBottom: 20 }}>
            {TIME_SLOTS.map(slot => (
              <button
                key={slot}
                className={`slot-btn ${selectedSlot === slot ? 'selected' : ''}`}
                onClick={() => { setSelectedSlot(slot); setCheckResult(null) }}
              >
                {slot}
              </button>
            ))}
          </div>

          {/* Calendar connection */}
          <div className={`calendar-status ${calendarToken ? 'connected' : ''}`}>
            <div className={`calendar-dot ${calendarToken ? 'connected' : ''}`} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>
                Google Calendar {calendarToken ? 'Connected' : 'Not Connected'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                {calendarToken
                  ? 'Ready to check availability and book appointments'
                  : 'Connect to check your availability and create the event'}
              </div>
            </div>
            {calendarToken ? (
              <button className="btn btn-ghost btn-sm" onClick={disconnectCalendar}>Disconnect</button>
            ) : (
              <button className="btn btn-primary btn-sm" onClick={connectCalendar}>Connect →</button>
            )}
          </div>

          {/* Check + Book */}
          {checkResult && (
            <div style={{
              padding: 14, borderRadius: 'var(--radius-sm)', marginTop: 14,
              background: checkResult.free ? 'var(--mint-light)' : 'var(--peach-light)',
              border: `1.5px solid ${checkResult.free ? 'var(--mint)' : 'var(--peach)'}`,
              fontSize: 13
            }}>
              {checkResult.free ? (
                <span style={{ color: 'var(--mint-deep)', fontWeight: 600 }}>✓ You're free at this time</span>
              ) : (
                <div>
                  <div style={{ color: 'var(--peach-deep)', fontWeight: 600, marginBottom: 6 }}>✗ Conflict detected</div>
                  {checkResult.conflicts.map((c, i) => (
                    <div key={i} style={{ color: 'var(--muted)' }}>• {c.summary}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
            <button
              className="btn btn-secondary"
              onClick={checkAvailability}
              disabled={!canCheck || loadingCheck}
            >
              {loadingCheck ? <><span className="spinner dark" /> Checking…</> : 'Check Availability'}
            </button>
            <button
              className="btn btn-primary"
              onClick={bookAppointment}
              disabled={!canBook || loadingBook}
            >
              {loadingBook ? <><span className="spinner" /> Booking…</> : 'Confirm Booking'}
            </button>
          </div>
          {!calendarToken && (
            <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 10 }}>
              Connect your Google Calendar above to check availability and confirm.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
