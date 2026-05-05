import { useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'

const emptyDashboard = {
  totalFaults: 0,
  severityCount: {
    high: 0,
    medium: 0,
    low: 0,
  },
  faults: [],
}

const apiUrl = import.meta.env.VITE_DASHBOARD_API_URL ?? '/api/dashboard'
const demoTechnicianId = import.meta.env.VITE_DEMO_TECHNICIAN_ID ?? ''
const demoPasskey = import.meta.env.VITE_DEMO_PASSKEY ?? ''

function normaliseDashboard(data) {
  return {
    totalFaults: Number(data?.totalFaults ?? 0),
    severityCount: {
      high: Number(data?.severityCount?.high ?? 0),
      medium: Number(data?.severityCount?.medium ?? 0),
      low: Number(data?.severityCount?.low ?? 0),
    },
    faults: Array.isArray(data?.faults) ? data.faults : [],
  }
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [technicianId, setTechnicianId] = useState('')
  const [passkey, setPasskey] = useState('')
  const [isPasskeyVisible, setIsPasskeyVisible] = useState(false)
  const [loginError, setLoginError] = useState('')
  const [dashboard, setDashboard] = useState(emptyDashboard)
  const [status, setStatus] = useState('Connecting')
  const [lastUpdated, setLastUpdated] = useState(null)

  const fetchDashboard = useCallback(async () => {
    try {
      setStatus('Connecting')
      const res = await fetch(apiUrl)

      if (!res.ok) {
        throw new Error(`Dashboard request failed with ${res.status}`)
      }

      const data = await res.json()
      setDashboard(normaliseDashboard(data))
      setLastUpdated(new Date())
      setStatus('Live')
    } catch {
      setStatus('Offline')
    }
  }, [])

  useEffect(() => {
    if (!isAuthenticated) {
      return undefined
    }

    fetchDashboard()
    const intervalId = window.setInterval(fetchDashboard, 5000)

    return () => window.clearInterval(intervalId)
  }, [fetchDashboard, isAuthenticated])

  const handleLogin = (event) => {
    event.preventDefault()

    const isConfiguredLogin =
      demoTechnicianId.length > 0 &&
      demoPasskey.length > 0 &&
      technicianId === demoTechnicianId &&
      passkey === demoPasskey

    const isPrototypeLogin =
      demoTechnicianId.length === 0 &&
      demoPasskey.length === 0 &&
      technicianId.trim().length > 0 &&
      passkey.trim().length > 0

    if (isConfiguredLogin || isPrototypeLogin) {
      setLoginError('')
      setIsAuthenticated(true)
      return
    }

    setLoginError('Check the technician ID and passkey, then try again.')
  }

  const highestRisk = useMemo(() => {
    const { high, medium, low } = dashboard.severityCount

    if (high > 0) {
      return 'High'
    }

    if (medium > 0) {
      return 'Medium'
    }

    if (low > 0) {
      return 'Low'
    }

    return 'Clear'
  }, [dashboard.severityCount])

  if (!isAuthenticated) {
    return (
      <main className="login-shell">
        <section className="login-page" aria-label="Dashboard sign in">
          <div className="login-brand">
            <div className="brand-lockup">
              <span className="brand-mark" aria-hidden="true">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M5 15.5h3.1L10.4 7l3.2 12 2.1-7.5H19" />
                </svg>
              </span>
              <span>Techinno AR</span>
            </div>

            <div className="login-copy">
              <p className="eyebrow">Secure prototype access</p>
              <h1>Monitor simulated transport faults from one calm workspace.</h1>
              <p>
                Sign in to open the dashboard for AR fault overlays, severity counts, and
                technician report synchronisation.
              </p>
            </div>

            <dl className="login-meta">
              <div>
                <dt>Build</dt>
                <dd>TRL 3 prototype</dd>
              </div>
              <div>
                <dt>Mode</dt>
                <dd>Dashboard access</dd>
              </div>
            </dl>
          </div>

          <form className="login-card" onSubmit={handleLogin}>
            <div className="login-card-heading">
              <p className="eyebrow">Authentication</p>
              <h2>Enter operator details</h2>
            </div>

            <label className="field" htmlFor="technician-id">
              <span>Technician ID</span>
              <input
                id="technician-id"
                name="technician-id"
                type="text"
                autoComplete="username"
                value={technicianId}
                placeholder="TECH-001"
                onChange={(event) => setTechnicianId(event.target.value)}
              />
            </label>

            <label className="field" htmlFor="passkey">
              <span>Security passkey</span>
              <div className="passkey-field">
                <input
                  id="passkey"
                  name="passkey"
                  type={isPasskeyVisible ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={passkey}
                  placeholder="Enter passkey"
                  onChange={(event) => setPasskey(event.target.value)}
                />
                <button
                  className="icon-button"
                  type="button"
                  aria-label={isPasskeyVisible ? 'Hide passkey' : 'Show passkey'}
                  onClick={() => setIsPasskeyVisible((visible) => !visible)}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M2.8 12s3.4-6 9.2-6 9.2 6 9.2 6-3.4 6-9.2 6-9.2-6-9.2-6Z" />
                    <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
                  </svg>
                </button>
              </div>
            </label>

            {loginError.length > 0 && (
              <p className="login-error" role="alert">
                {loginError}
              </p>
            )}

            <button className="login-submit" type="submit">
              Continue to dashboard
            </button>

            <p className="login-note">
              Prototype access only. Use any ID and passkey unless demo credentials are
              configured.
            </p>
          </form>
        </section>
      </main>
    )
  }

  return (
    <main className="app-shell">
      <section className="workspace" aria-label="AR maintenance prototype">
        <div className="viewport">
          <div className="station-grid">
            <div className="track-line" />
            <div className="inspection-target">
              <span className="fault-marker high">F1</span>
              <span className="fault-marker medium">F2</span>
              <span className="fault-marker low">F3</span>
            </div>
            <div className="overlay-card primary-alert">
              <span>Fault overlay</span>
              <strong>{highestRisk} risk detected</strong>
            </div>
            <div className="overlay-card tool-check">
              <span>Tool check</span>
              <strong>Scanner kit active</strong>
            </div>
          </div>
        </div>

        <aside className="dashboard-panel" aria-label="Dashboard">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Public transport AR</p>
              <h1>Fault dashboard</h1>
            </div>
            <span className={`status-pill ${status.toLowerCase()}`}>{status}</span>
          </div>

          <div className="total-card">
            <span>Total faults</span>
            <strong>{dashboard.totalFaults}</strong>
          </div>

          <div className="severity-grid">
            <article className="severity-card high">
              <span>High</span>
              <strong>{dashboard.severityCount.high}</strong>
            </article>
            <article className="severity-card medium">
              <span>Medium</span>
              <strong>{dashboard.severityCount.medium}</strong>
            </article>
            <article className="severity-card low">
              <span>Low</span>
              <strong>{dashboard.severityCount.low}</strong>
            </article>
          </div>

          <div className="fault-list">
            <div className="section-heading">
              <h2>Recent fault reports</h2>
              <button type="button" onClick={fetchDashboard}>
                Refresh
              </button>
            </div>

            {dashboard.faults.length > 0 ? (
              <ul>
                {dashboard.faults.slice(-4).map((fault, index) => (
                  <li key={fault.id ?? `${fault.severity}-${index}`}>
                    <span className={`dot ${fault.severity ?? 'low'}`} />
                    <div>
                      <strong>{fault.title ?? fault.type ?? 'Reported fault'}</strong>
                      <p>
                        {fault.location ?? 'Unknown location'} - {fault.severity ?? 'low'}{' '}
                        severity
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty-state">No live fault reports have been received yet.</p>
            )}
          </div>

          <p className="timestamp">
            {lastUpdated
              ? `Last synced ${lastUpdated.toLocaleTimeString()}`
              : 'Waiting for dashboard data'}
          </p>
        </aside>
      </section>
    </main>
  )
}

export default App
