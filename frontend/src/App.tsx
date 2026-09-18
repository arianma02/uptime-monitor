import { useEffect, useState } from 'react';
import './App.css';

const API_URL = import.meta.env.VITE_API_URL;

type CheckResult = {
  id: number;
  monitorId: number;
  isUp: boolean;
  statusCode: number | null;
  responseTimeMs: number;
  error: string | null;
  checkedAt: string;
};

type Monitor = {
  id: number;
  name: string;
  url: string;
  intervalMinutes: number;
  active: boolean;
  createdAt: string;
};

type MonitorWithStatus = Monitor & {
  latestCheck?: CheckResult;
  recentChecks: CheckResult[];
};

function App() {
  const [monitors, setMonitors] = useState<MonitorWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [expandedMonitorId, setExpandedMonitorId] = useState<number | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  async function loadMonitors() {
    try {
      setError(null);
      const response = await fetch(`${API_URL}/monitors`);

      if (!response.ok) {
        throw new Error('Failed to load monitors');
      }

      const monitorData: Monitor[] = await response.json();

      const monitorsWithStatus = await Promise.all(
        monitorData.map(async (monitor) => {
          const checksResponse = await fetch(
            `${API_URL}/monitors/${monitor.id}/checks`,
          );

          const checks: CheckResult[] = checksResponse.ok
            ? await checksResponse.json()
            : [];

          return {
            ...monitor,
            latestCheck: checks[0],
            recentChecks: checks.slice(0, 5),
          };
        }),
      );

      setMonitors(monitorsWithStatus);
      setLastUpdated(new Date());
    } catch (caughtError) {
      console.error('Failed to load monitoring data', caughtError);
      setError('Unable to load monitoring data.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadMonitors();

    const interval = setInterval(() => {
      void loadMonitors();
    }, 60_000);

    return () => clearInterval(interval);
  }, []);

  const upCount = monitors.filter(
    (monitor) => monitor.latestCheck?.isUp,
  ).length;

  const downCount = monitors.filter(
    (monitor) => monitor.latestCheck && !monitor.latestCheck.isUp,
  ).length;

  if (loading) {
    return <div className="loading">Loading monitoring data...</div>;
  }

  if (error) {
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

            const status = !check ? 'unknown' : check.isUp ? 'up' : 'down';

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
                          ? new Date(check.checkedAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : 'Never'}
                      </strong>
                    </div>
                  </div>

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

                    {monitor.recentChecks.length === 0 ? (
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
                              {result.isUp ? 'UP' : 'DOWN'}
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
