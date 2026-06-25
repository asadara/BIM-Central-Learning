const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../backend/config/runtimeConfig');

const baseUrl = process.env.BCL_BASE_URL || 'http://127.0.0.1:5052';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function fetchJson(pathname, token) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  const body = await response.text();
  assert(response.ok, `${pathname} returned HTTP ${response.status}: ${body.slice(0, 160)}`);
  return JSON.parse(body);
}

(async () => {
  const token = jwt.sign(
    {
      userId: 9,
      id: 9,
      username: 'admin_bcl',
      email: 'admin@bcl.local',
      role: 'System Administrator',
      isAdmin: true
    },
    getJwtSecret(),
    { expiresIn: '10m' }
  );

  const dashboard = await fetchJson('/api/competency/dashboard', token);
  assert(dashboard.dataSource === 'postgresql', 'dashboard should use PostgreSQL source');
  assert(Number(dashboard.totalUsers || 0) > 0, 'dashboard should return users');
  assert(Array.isArray(dashboard.users), 'dashboard users should be an array');

  const users = await fetchJson('/api/competency/users', token);
  assert(Array.isArray(users) && users.length === dashboard.users.length, 'users endpoint should match dashboard users');

  const userWithAttempt = users.find(user => Number(user.progress?.totalAttempts || 0) > 0);
  if (userWithAttempt) {
    assert(Number(userWithAttempt.progress.quizAttempts || 0) >= 0, 'quiz attempts should be present');
    assert(Number(userWithAttempt.progress.averageAttemptScore || 0) > 0, 'average attempt score should be populated');
    assert(Array.isArray(userWithAttempt.progress.categoriesAttempted), 'categories attempted should be present');

    const detail = await fetchJson(`/api/competency/users/${encodeURIComponent(userWithAttempt.id)}/detail`, token);
    assert(detail.user && String(detail.user.id) === String(userWithAttempt.id), 'detail endpoint should return selected user');
    assert(Array.isArray(detail.attempts), 'detail endpoint should return attempt history');
    assert(Array.isArray(detail.timeline), 'detail endpoint should return combined timeline');
    assert(detail.attemptSummary && Number(detail.attemptSummary.totalAttempts || 0) > 0, 'detail endpoint should summarize attempts');
  }

  const summaryReport = await fetchJson('/api/competency-reports', token);
  assert(Array.isArray(summaryReport), 'reports endpoint should return an array');

  console.log('OK smoke-competency-mapping passed');
})().catch((error) => {
  console.error(`FAIL smoke-competency-mapping: ${error.message}`);
  process.exit(1);
});
