export type CheckResult = {
  id: number;
  monitorId: number;
  isUp: boolean;
  statusCode: number | null;
  responseTimeMs: number;
  error: string | null;
  checkedAt: string;
};

export type Monitor = {
  id: number;
  name: string;
  url: string;
  intervalMinutes: number;
  active: boolean;
  createdAt: string;
};

export type MonitorWithStatus = Monitor & {
  latestCheck?: CheckResult;
  recentChecks: CheckResult[];
  historyError?: string;
};

export function getMonitorStatus(monitor: MonitorWithStatus, now: number) {
  if (!monitor.active) return 'paused';
  if (monitor.historyError) return 'error';
  const check = monitor.latestCheck;
  if (!check) return 'unknown';
  if (
    now - new Date(check.checkedAt).getTime() >
    monitor.intervalMinutes * 60_000 + 120_000
  ) {
    return 'stale';
  }
  if (
    check.statusCode !== null &&
    check.statusCode >= 300 &&
    check.statusCode < 400
  ) {
    return 'redirect';
  }
  return check.isUp ? 'up' : 'down';
}

export async function loadMonitors(
  apiUrl: string,
  signal?: AbortSignal,
): Promise<MonitorWithStatus[]> {
  const response = await fetch(`${apiUrl}/monitors`, { signal });
  if (!response.ok) throw new Error('Failed to load monitors');
  const monitors: Monitor[] = await response.json();
  return Promise.all(
    monitors.map(async (monitor) => {
      try {
        const response = await fetch(
          `${apiUrl}/monitors/${monitor.id}/checks?limit=5`,
          { signal },
        );
        if (!response.ok) throw new Error('Failed to load check history');
        const checks: CheckResult[] = await response.json();
        return { ...monitor, latestCheck: checks[0], recentChecks: checks };
      } catch {
        return {
          ...monitor,
          recentChecks: [],
          historyError: 'Unable to load check history.',
        };
      }
    }),
  );
}
