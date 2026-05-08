function Dashboard({ dashboard, fetchDashboard, lastUpdated, status }) {
  const { high, medium, low } = dashboard.severityCount
  const highestRisk = high > 0 ? 'High' : medium > 0 ? 'Medium' : low > 0 ? 'Low' : 'Clear'

  return (
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
  )
}

export default Dashboard
