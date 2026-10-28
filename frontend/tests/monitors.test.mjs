import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getMonitorStatus, loadMonitors } from '../src/monitors.ts';

const now = Date.parse('2026-10-28T12:00:00Z');
const check = {
  isUp: true,
  statusCode: 200,
  checkedAt: new Date(now).toISOString(),
};
const monitor = {
  id: 1,
  active: true,
  intervalMinutes: 5,
  latestCheck: check,
  recentChecks: [check],
};

test('paused and failed-history states do not claim a service is up', () => {
  assert.equal(getMonitorStatus({ ...monitor, active: false }, now), 'paused');
  assert.equal(
    getMonitorStatus({ ...monitor, historyError: 'Failed' }, now),
    'error',
  );
});

test('an overdue result is stale, while a recent result is up or down', () => {
  assert.equal(getMonitorStatus(monitor, now), 'up');
  assert.equal(getMonitorStatus(monitor, now + 7 * 60_000), 'up');
  assert.equal(getMonitorStatus(monitor, now + 7 * 60_000 + 1), 'stale');
  assert.equal(
    getMonitorStatus(
      { ...monitor, latestCheck: { ...check, isUp: false, statusCode: 500 } },
      now,
    ),
    'down',
  );
  assert.equal(
    getMonitorStatus({ ...monitor, latestCheck: undefined }, now),
    'unknown',
  );
});

test('a redirect is distinct from a down result', () => {
  assert.equal(
    getMonitorStatus(
      { ...monitor, latestCheck: { ...check, isUp: false, statusCode: 302 } },
      now,
    ),
    'redirect',
  );
});

test('history failures are reported per monitor instead of becoming empty history', async (t) => {
  const urls = [];
  t.mock.method(globalThis, 'fetch', async (url) => {
    urls.push(url);
    if (url.endsWith('/monitors'))
      return Response.json([monitor, { ...monitor, id: 2 }]);
    if (url.includes('/1/')) return new Response(null, { status: 503 });
    return Response.json([check]);
  });
  const results = await loadMonitors('http://localhost:3000');
  assert.equal(results[0].historyError, 'Unable to load check history.');
  assert.equal(results[1].latestCheck.isUp, true);
  assert.ok(urls.includes('http://localhost:3000/monitors/1/checks?limit=5'));
});

test('a failed monitor list rejects rather than returning an empty dashboard', async (t) => {
  t.mock.method(
    globalThis,
    'fetch',
    async () => new Response(null, { status: 503 }),
  );
  await assert.rejects(
    loadMonitors('http://localhost:3000'),
    /Failed to load monitors/,
  );
});
