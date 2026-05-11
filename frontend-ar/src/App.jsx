import { useCallback, useEffect, useState } from 'react'
import Dashboard, { ArCamera } from '../../dashboard/Dashboard'
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

const dashboardApiUrl = import.meta.env.VITE_DASHBOARD_API_URL ?? '/api/dashboard'
const apiRootUrl = dashboardApiUrl.replace(/\/dashboard\/?$/, '')
const loginApiUrl = `${apiRootUrl}/login`
const faultApiUrl = `${apiRootUrl}/dashboard/faults`
const roleTabs = {
  admin: ['Dashboard', 'AR Camera', 'Settings'],
  engineer: ['Dashboard', 'AR Camera', 'Settings'],
  viewer: ['Dashboard', 'AR Camera', 'Settings'],
}
const roleLabels = {
  admin: 'Admin',
  engineer: 'Engineer',
  viewer: 'Viewer',
}
const tokenStorageKey = 'techinno-token'
const userStorageKey = 'techinno-user'
const savedTheme = window.localStorage.getItem('techinno-theme')

function loadStoredUser() {
  try {
    return JSON.parse(window.localStorage.getItem(userStorageKey) ?? 'null')
  } catch {
    return null
  }
}

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
  const tokenFromStorage = window.localStorage.getItem(tokenStorageKey) ?? ''
  const [isAuthenticated, setIsAuthenticated] = useState(tokenFromStorage.length > 0)
  const [authToken, setAuthToken] = useState(tokenFromStorage)
  const [currentUser, setCurrentUser] = useState(loadStoredUser)
  const [technicianId, setTechnicianId] = useState('')
  const [passkey, setPasskey] = useState('')
  const [isPasskeyVisible, setIsPasskeyVisible] = useState(false)
  const [loginError, setLoginError] = useState('')
  const [faultReportStatus, setFaultReportStatus] = useState('')
  const [activeTab, setActiveTab] = useState('Dashboard')
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [theme, setTheme] = useState(savedTheme === 'dark' ? 'dark' : 'light')
  const [dashboard, setDashboard] = useState(emptyDashboard)
  const [status, setStatus] = useState('Connecting')
  const [lastUpdated, setLastUpdated] = useState(null)
  const currentRole = currentUser?.role ?? ''
  const availableTabs = roleTabs[currentRole] ?? ['Dashboard']
  const canSubmitFault = currentRole === 'engineer'
  const canDeleteFault = currentRole === 'admin'

  const fetchDashboard = useCallback(async () => {
    if (!authToken) {
      setStatus('Offline')
      return
    }

    try {
      setStatus('Connecting')
      const res = await fetch(dashboardApiUrl, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      })

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          window.localStorage.removeItem(tokenStorageKey)
          window.localStorage.removeItem(userStorageKey)
          setAuthToken('')
          setCurrentUser(null)
          setIsAuthenticated(false)
        }

        throw new Error(`Dashboard request failed with ${res.status}`)
      }

      const data = await res.json()
      setDashboard(normaliseDashboard(data))
      setLastUpdated(new Date())
      setStatus('Live')
    } catch {
      setStatus('Offline')
    }
  }, [authToken])

  useEffect(() => {
    window.localStorage.setItem('techinno-theme', theme)
  }, [theme])

  useEffect(() => {
    if (!availableTabs.includes(activeTab)) {
      setActiveTab('Dashboard')
    }
  }, [activeTab, availableTabs])

  useEffect(() => {
    if (!isAuthenticated) {
      return undefined
    }

    fetchDashboard()
    const intervalId = window.setInterval(fetchDashboard, 5000)

    return () => window.clearInterval(intervalId)
  }, [fetchDashboard, isAuthenticated])

  const handleLogin = async (event) => {
    event.preventDefault()
    setLoginError('')

    try {
      const res = await fetch(loginApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ technicianId, passkey }),
      })

      if (!res.ok) {
        throw new Error('Login failed')
      }

      const data = await res.json()
      setAuthToken(data.token)
      setCurrentUser(data.user)
      window.localStorage.setItem(tokenStorageKey, data.token)
      window.localStorage.setItem(userStorageKey, JSON.stringify(data.user))
      setIsAuthenticated(true)
      setActiveTab('Dashboard')
      setLoginError('')
    } catch {
      setLoginError('Check the technician ID and passkey, then try again.')
    }
  }

  const submitSampleFault = async () => {
    if (!authToken) {
      setFaultReportStatus('Sign in before sending fault reports.')
      return
    }

    if (!canSubmitFault) {
      setFaultReportStatus('Only engineers can submit fault reports.')
      return
    }

    setFaultReportStatus('Sending fault report...')

    try {
      const res = await fetch(faultApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          title: 'Test report',
          location: 'Central platform',
          severity: 'medium',
        }),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        if (res.status === 401) {
          window.localStorage.removeItem(tokenStorageKey)
          window.localStorage.removeItem(userStorageKey)
          setAuthToken('')
          setCurrentUser(null)
          setIsAuthenticated(false)
          throw new Error('Session expired. Sign in again to send fault reports.')
        }

        throw new Error(errorData.error || 'Unable to submit fault report')
      }

      setFaultReportStatus('Sample fault report sent successfully.')
      fetchDashboard()
    } catch (error) {
      setFaultReportStatus(error.message)
    }
  }

  const deleteFault = async (faultId) => {
    if (!authToken || !canDeleteFault || !faultId) {
      return
    }

    try {
      const res = await fetch(`${faultApiUrl}/${encodeURIComponent(faultId)}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        if (res.status === 401) {
          window.localStorage.removeItem(tokenStorageKey)
          window.localStorage.removeItem(userStorageKey)
          setAuthToken('')
          setCurrentUser(null)
          setIsAuthenticated(false)
          throw new Error('Session expired. Sign in again to manage faults.')
        }

        throw new Error(errorData.error || 'Unable to delete fault')
      }

      fetchDashboard()
    } catch (error) {
      setFaultReportStatus(error.message)
    }
  }

  const handleTabChange = (tab) => {
    setActiveTab(tab)
    setIsMenuOpen(false)
  }

  const handleLogout = () => {
    window.localStorage.removeItem(tokenStorageKey)
    window.localStorage.removeItem(userStorageKey)
    setAuthToken('')
    setCurrentUser(null)
    setIsAuthenticated(false)
    setTechnicianId('')
    setPasskey('')
    setFaultReportStatus('')
    setActiveTab('Dashboard')
    setIsMenuOpen(false)
  }

  const renderMainView = () => {
    if (activeTab === 'Settings') {
      return (
        <section className="workspace single-view" aria-label="Settings">
          <div className="feature-panel">
            <p className="eyebrow">Settings</p>
            <h1>Prototype controls</h1>
            <p>Manage role access, reporting, and appearance for the demo environment.</p>
            <dl className="settings-list">
              <div>
                <dt>Signed in as</dt>
                <dd>{roleLabels[currentRole] ?? 'Unknown'}</dd>
              </div>
              <div>
                <dt>Refresh interval</dt>
                <dd>5 seconds</dd>
              </div>
            </dl>

            <div className="report-panel">
              <p className="eyebrow">Report a fault</p>
              <p>Engineers can send a sample report into the live dashboard stream.</p>
              <button
                type="button"
                onClick={submitSampleFault}
                disabled={!canSubmitFault}
              >
                Send sample fault report
              </button>
              {faultReportStatus.length > 0 && (
                <p className="report-status">{faultReportStatus}</p>
              )}
            </div>

            <div className="theme-setting">
              <div>
                <p className="eyebrow">Appearance</p>
                <h2>Global theme</h2>
                <p>Set the interface theme globally.</p>
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

    if (activeTab === 'AR Camera') {
      return <ArCamera dashboard={dashboard} />
    }

    return (
      <Dashboard
        dashboard={dashboard}
        fetchDashboard={fetchDashboard}
        lastUpdated={lastUpdated}
        status={status}
        canDeleteFault={canDeleteFault}
        onDeleteFault={deleteFault}
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
              Prototype access only. Sign in with an account issued by an admin.
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
          <span className="role-pill">{roleLabels[currentRole] ?? 'User'}</span>
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
              {availableTabs.map((tab) => (
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
              <button
                className="menu-item logout-item"
                type="button"
                onClick={handleLogout}
              >
                Log out
              </button>
            </div>
          )}
        </nav>
      </header>

      {renderMainView()}
    </main>
  )
}

export default App
