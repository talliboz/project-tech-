import { useCallback, useEffect, useRef, useState } from 'react'
import Dashboard from '../../dashboard/Dashboard'
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
const tabs = ['Dashboard', 'AR-Camera', 'Settings']
const savedTheme = window.localStorage.getItem('techinno-theme')

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
  const cameraVideoRef = useRef(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [technicianId, setTechnicianId] = useState('')
  const [passkey, setPasskey] = useState('')
  const [isPasskeyVisible, setIsPasskeyVisible] = useState(false)
  const [loginError, setLoginError] = useState('')
  const [activeTab, setActiveTab] = useState('Dashboard')
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [theme, setTheme] = useState(savedTheme === 'dark' ? 'dark' : 'light')
  const [dashboard, setDashboard] = useState(emptyDashboard)
  const [status, setStatus] = useState('Connecting')
  const [lastUpdated, setLastUpdated] = useState(null)
  const [cameraError, setCameraError] = useState('')

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
    window.localStorage.setItem('techinno-theme', theme)
  }, [theme])

  useEffect(() => {
    if (!isAuthenticated) {
      return undefined
    }

    fetchDashboard()
    const intervalId = window.setInterval(fetchDashboard, 5000)

    return () => window.clearInterval(intervalId)
  }, [fetchDashboard, isAuthenticated])

  useEffect(() => {
    if (!isAuthenticated || activeTab !== 'AR-Camera') {
      return undefined
    }

    let activeStream

    const startCamera = async () => {
      try {
        setCameraError('')

        if (!navigator.mediaDevices?.getUserMedia) {
          setCameraError('Camera access is not supported by this browser.')
          return
        }

        activeStream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: 'environment' },
          },
        })

        if (cameraVideoRef.current) {
          cameraVideoRef.current.srcObject = activeStream
        }
      } catch {
        setCameraError(
          'Camera permission was blocked or this page is not running over HTTPS.',
        )
      }
    }

    startCamera()

    return () => {
      activeStream?.getTracks().forEach((track) => {
        track.stop()
      })

      if (cameraVideoRef.current) {
        cameraVideoRef.current.srcObject = null
      }
    }
  }, [activeTab, isAuthenticated])

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

  const handleTabChange = (tab) => {
    setActiveTab(tab)
    setIsMenuOpen(false)
  }

  const renderMainView = () => {
    if (activeTab === 'AR-Camera') {
      return (
        <section className="workspace single-view" aria-label="AR camera prototype">
          <div className="feature-panel">
            <p className="eyebrow">AR-Camera</p>
            <h1>Camera preview placeholder</h1>
            <p>
              Point a phone camera at a simulated marker or fault location. The prototype
              overlays show where detection and confirmation prompts would appear.
            </p>
            <div className="camera-frame">
              <video
                ref={cameraVideoRef}
                className="camera-video"
                autoPlay
                muted
                playsInline
                aria-label="Live AR camera preview"
              />
              <div className="scan-window camera-overlay">
                <span className="fault-marker high">F1</span>
              </div>
              {cameraError.length > 0 && (
                <p className="camera-error" role="alert">
                  {cameraError}
                </p>
              )}
            </div>
          </div>
        </section>
      )
    }

    if (activeTab === 'Settings') {
      return (
        <section className="workspace single-view" aria-label="Settings">
          <div className="feature-panel">
            <p className="eyebrow">Settings</p>
            <h1>Prototype controls</h1>
            <p>
              Configure demo credentials in the frontend environment file, then restart
              the dev server to require a specific technician ID and passkey.
            </p>
            <dl className="settings-list">
              <div>
                <dt>Dashboard API</dt>
                <dd>{apiUrl}</dd>
              </div>
              <div>
                <dt>Credential mode</dt>
                <dd>
                  {demoTechnicianId && demoPasskey ? 'Configured' : 'Open prototype'}
                </dd>
              </div>
              <div>
                <dt>Refresh interval</dt>
                <dd>5 seconds</dd>
              </div>
            </dl>

            <div className="theme-setting">
              <div>
                <p className="eyebrow">Appearance</p>
                <h2>Global theme</h2>
                <p>Switch the whole prototype between light and dark mode.</p>
              </div>
              <fieldset className="theme-toggle">
                <legend>Theme mode</legend>
                <button
                  type="button"
                  aria-pressed={theme === 'light'}
                  onClick={() => setTheme('light')}
                >
                  Light
                </button>
                <button
                  type="button"
                  aria-pressed={theme === 'dark'}
                  onClick={() => setTheme('dark')}
                >
                  Dark
                </button>
              </fieldset>
            </div>
          </div>
        </section>
      )
    }

    return (
      <Dashboard
        dashboard={dashboard}
        fetchDashboard={fetchDashboard}
        lastUpdated={lastUpdated}
        status={status}
      />
    )
  }

  if (!isAuthenticated) {
    return (
      <main className="login-shell" data-theme={theme}>
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
    <main className="app-shell" data-theme={theme}>
      <header className="app-header">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 15.5h3.1L10.4 7l3.2 12 2.1-7.5H19" />
            </svg>
          </span>
          <span>Techinno AR</span>
        </div>

        <nav className="burger-nav" aria-label="Main navigation">
          <button
            className="burger-button"
            type="button"
            aria-expanded={isMenuOpen}
            aria-controls="main-menu"
            onClick={() => setIsMenuOpen((open) => !open)}
          >
            <span className="burger-lines" aria-hidden="true" />
            Menu
          </button>

          {isMenuOpen && (
            <div className="menu-popover" id="main-menu">
              {tabs.map((tab) => (
                <button
                  className="menu-item"
                  type="button"
                  aria-current={activeTab === tab ? 'page' : undefined}
                  key={tab}
                  onClick={() => handleTabChange(tab)}
                >
                  {tab}
                </button>
              ))}
            </div>
          )}
        </nav>
      </header>

      {renderMainView()}
    </main>
  )
}

export default App
