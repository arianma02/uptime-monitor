import { useEffect, useState } from 'react';
import './App.css';
import {
  getMonitorStatus,
  loadMonitors,
  type MonitorWithStatus,
} from './monitors';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function App() {
  const [monitors, setMonitors] = useState<MonitorWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [expandedMonitorId, setExpandedMonitorId] = useState<number | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    const controller = new AbortController();
    let refreshing = false;

    async function refresh() {
      if (refreshing) return;
      refreshing = true;
      try {
        const data = await loadMonitors(API_URL, controller.signal);
        if (controller.signal.aborted) return;
        setMonitors((previous) =>
          data.map((monitor) => {
            const old = previous.find((item) => item.id === monitor.id);
            return monitor.historyError && old
              ? {
                  ...monitor,
                  latestCheck: old.latestCheck,
                  recentChecks: old.recentChecks,
                }
              : monitor;
          }),
        );
        setLastUpdated(new Date());
        setError(null);
      } catch {
        if (!controller.signal.aborted)
          setError('Unable to refresh monitoring data.');
      } finally {
        refreshing = false;
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void refresh();
    const interval = setInterval(() => {
      setNow(Date.now());
      void refresh();
    }, 60_000);
    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, []);

  const upCount = monitors.filter(
    (monitor) => getMonitorStatus(monitor, now) === 'up',
  ).length;

  const downCount = monitors.filter(
    (monitor) => getMonitorStatus(monitor, now) === 'down',
  ).length;

  if (loading) {
    return <div className="loading">Loading monitoring data...</div>;
  }

  if (error && monitors.length === 0) {
    return (
      <div className="message-state">
        <strong>Unable to load monitoring data</strong>
        <span>Check the API connection and try again.</span>
      </div>
    );
  }

  return (
    <main className="page">
      <section className="dashboard">
        <header className="header">
          <div>
            <p className="eyebrow">SYSTEM STATUS</p>
            <h1>Uptime Monitoring</h1>
            <p className="subtitle">
              Live status and response times for monitored services.
            </p>
          </div>

          <div className="refresh">
            <span className="live-dot" />
            Auto-refreshing
          </div>
        </header>

        {error && (
          <p role="alert">{error} Showing previously loaded results.</p>
        )}
        <section className="summary">
          <div className="summary-card">
            <span>Monitors</span>
            <strong>{monitors.length}</strong>
          </div>

          <div className="summary-card">
            <span>Operational</span>
            <strong>{upCount}</strong>
          </div>

          <div className="summary-card">
            <span>Down</span>
            <strong>{downCount}</strong>
          </div>

          <div className="summary-card">
            <span>Last refresh</span>
            <strong className="refresh-time">
              {lastUpdated
                ? lastUpdated.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : '—'}
            </strong>
          </div>
        </section>

        <section className="monitor-list">
          {monitors.length === 0 && (
            <div className="empty-state">
              <strong>No monitors yet</strong>
              <span>
                Monitoring data will appear here once a service is added.
              </span>
            </div>
          )}
          {monitors.map((monitor) => {
            const check = monitor.latestCheck;

            const status = getMonitorStatus(monitor, now);

            const isExpanded = expandedMonitorId === monitor.id;

            return (
              <div className="monitor-item" key={monitor.id}>
                <article className="monitor-card">
                  <div className="monitor-main">
                    <div className={`status-indicator ${status}`} />

                    <div>
                      <h2>{monitor.name}</h2>

                      <a href={monitor.url} target="_blank" rel="noreferrer">
                        {monitor.url}
                      </a>
                    </div>
                  </div>

                  <div className="monitor-data">
                    <div>
                      <span>Status</span>
                      <strong className={`status-text ${status}`}>
                        {status.toUpperCase()}
                      </strong>
                    </div>

                    <div>
                      <span>Response</span>
                      <strong>
                        {check ? `${check.responseTimeMs} ms` : '—'}
                      </strong>
                    </div>

                    <div>
                      <span>HTTP</span>
                      <strong>{check?.statusCode ?? '—'}</strong>
                    </div>

                    <div>
                      <span>Last checked</span>
                      <strong>
                        {check
                          ? new Date(check.checkedAt).toLocaleString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : 'Never'}
                      </strong>
                    </div>
                  </div>

                  {monitor.historyError && (
                    <p role="alert">{monitor.historyError}</p>
                  )}
                  {status === 'stale' && (
                    <p>Last result is overdue for an update.</p>
                  )}
                  {status === 'redirect' && <p>Redirect not followed.</p>}
                  <button
                    className="history-button"
                    onClick={() =>
                      setExpandedMonitorId(isExpanded ? null : monitor.id)
                    }
                  >
                    {isExpanded ? 'Hide history' : 'View history'}
                  </button>
                </article>

                {isExpanded && (
                  <div className="history-panel">
                    <p className="history-title">Recent checks</p>

                    {monitor.historyError && (
                      <p role="alert">{monitor.historyError}</p>
                    )}
                    {monitor.recentChecks.length === 0 &&
                    !monitor.historyError ? (
                      <p className="history-empty">No checks yet.</p>
                    ) : (
                      <div className="history-list">
                        <div className="history-header">
                          <span>Time</span>
                          <span>Status</span>
                          <span>Response</span>
                          <span>HTTP</span>
                        </div>

                        {monitor.recentChecks.map((result) => (
                          <div className="history-row" key={result.id}>
                            <span>
                              {new Date(result.checkedAt).toLocaleTimeString(
                                [],
                                {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                },
                              )}
                            </span>

                            <strong
                              className={
                                result.isUp
                                  ? 'history-status up'
                                  : 'history-status down'
                              }
                            >
                              {result.statusCode !== null &&
                              result.statusCode >= 300 &&
                              result.statusCode < 400
                                ? 'REDIRECT'
                                : result.isUp
                                  ? 'UP'
                                  : 'DOWN'}
                            </strong>

                            <span>{result.responseTimeMs} ms</span>

                            <span>{result.statusCode ?? '—'}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </section>
      </section>
    </main>
  );
}

export default App;
