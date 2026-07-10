const path = require('path');

const root = path.resolve(__dirname, '..');
const baseUrl = (process.env.BCL_BASE_URL || 'http://127.0.0.1:5052').replace(/\/$/, '');
const targetYear = (process.env.BCL_PROJECT_YEAR || '').trim();
const targetProject = (process.env.BCL_PROJECT_NAME || '').trim();
const targetSourceId = (process.env.BCL_PROJECT_SOURCE_ID || '').trim();
const mediaType = (process.env.BCL_MEDIA_TYPE || 'image').trim().toLowerCase();
const maxMediaChecks = Number.parseInt(process.env.BCL_MAX_MEDIA_CHECKS || '3', 10);
const headless = !/^false|0|no$/i.test(process.env.BCL_HEADLESS || 'true');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function makeUrl(pathname) {
  return `${baseUrl}${pathname}`;
}

function timeoutSignal(ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { controller, timer };
}

async function fetchText(pathname, options = {}) {
  const { controller, timer } = timeoutSignal(options.timeoutMs || 12000);
  try {
    const response = await fetch(makeUrl(pathname), {
      ...options,
      signal: controller.signal
    });
    const body = await response.text();
    return { response, body };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJson(pathname) {
  const { response, body } = await fetchText(pathname);
  assert(response.ok, `${pathname} returned HTTP ${response.status}: ${body.slice(0, 220)}`);
  return JSON.parse(body);
}

function isVisualMedia(url, detail) {
  const value = String(url || detail?.url || detail?.displayUrl || '').split('?')[0].toLowerCase();
  const kind = String(detail?.mediaKind || '').toLowerCase();
  if (kind === 'image' || kind === 'video' || kind === 'model') return true;
  return /\.(png|jpe?g|webp|gif|bmp|mp4|mov|webm|avi|mkv|wmv|m4v|ifc)$/i.test(value);
}

function isPreferredMedia(url, detail) {
  if (!mediaType || mediaType === 'all') return isVisualMedia(url, detail);
  const value = String(url || detail?.url || detail?.displayUrl || '').split('?')[0].toLowerCase();
  const kind = String(detail?.mediaKind || '').toLowerCase();
  if (mediaType === 'image') return kind === 'image' || /\.(png|jpe?g|webp|gif|bmp)$/i.test(value);
  if (mediaType === 'video') return kind === 'video' || /\.(mp4|mov|webm|avi|mkv|wmv|m4v)$/i.test(value);
  if (mediaType === 'model') return kind === 'model' || /\.ifc$/i.test(value);
  return isVisualMedia(url, detail);
}

function getProjectScopes(yearsPayload) {
  if (targetYear) {
    return [{ year: targetYear, sourceId: targetSourceId || null }];
  }

  const sources = Array.isArray(yearsPayload.sources) ? yearsPayload.sources : [];
  const yearsBySource = yearsPayload.yearsBySource || {};

  if (sources.length > 0 && Object.keys(yearsBySource).length > 0) {
    return [...sources]
      .sort((a, b) => (a.priority || 0) - (b.priority || 0))
      .flatMap((source) => {
        const years = [...new Set((yearsBySource[source.id] || []).map(String))]
          .filter((year) => /^(19|20)\d{2}$/.test(year))
          .sort((a, b) => b.localeCompare(a));
        return years.map((year) => ({ year, sourceId: source.id }));
      });
  }

  return [...new Set((yearsPayload.years || []).map(String))]
    .filter((year) => /^(19|20)\d{2}$/.test(year))
    .sort((a, b) => b.localeCompare(a))
    .map((year) => ({ year, sourceId: null }));
}

function getMediaDetailsByUrl(mediaPayload) {
  const details = new Map();
  for (const detail of mediaPayload.mediaDetails || []) {
    if (detail && detail.url) {
      details.set(detail.url, detail);
    }
  }
  return details;
}

async function loadProjectMedia(year, projectName, sourceId) {
  const query = sourceId ? `?sourceId=${encodeURIComponent(sourceId)}` : '';
  return fetchJson(`/api/project-media/${encodeURIComponent(year)}/${encodeURIComponent(projectName)}${query}`);
}

async function discoverTargetProject() {
  const yearsPayload = await fetchJson('/api/years');
  const scopes = getProjectScopes(yearsPayload);
  assert(scopes.length > 0, 'No project year/source scope was returned by /api/years');

  for (const scope of scopes) {
    const query = scope.sourceId ? `?sourceId=${encodeURIComponent(scope.sourceId)}` : '';
    const projectsPayload = await fetchJson(`/api/projects/${encodeURIComponent(scope.year)}${query}`);
    const projects = Array.isArray(projectsPayload.projects) ? projectsPayload.projects : [];
    const candidates = projects.filter((project) => {
      if (targetProject && project.name !== targetProject) return false;
      if (targetSourceId && project.sourceId !== targetSourceId) return false;
      return Number(project.mediaCount || 0) > 0 || targetProject;
    });

    for (const project of candidates) {
      const mediaPayload = await loadProjectMedia(scope.year, project.name, project.sourceId || scope.sourceId || null);
      const detailsByUrl = getMediaDetailsByUrl(mediaPayload);
      const media = (mediaPayload.media || []).filter((url) => {
        const detail = detailsByUrl.get(url);
        return isPreferredMedia(url, detail);
      });

      if (media.length > 0) {
        return {
          year: scope.year,
          sourceId: project.sourceId || scope.sourceId || null,
          projectName: project.name,
          mediaPayload,
          media
        };
      }
    }
  }

  const requested = [targetYear, targetSourceId, targetProject].filter(Boolean).join(' / ') || 'auto discovery';
  throw new Error(`No project with ${mediaType} media found for ${requested}`);
}

async function validateMediaProxy(target) {
  const detailsByUrl = getMediaDetailsByUrl(target.mediaPayload);
  const results = [];

  for (const mediaUrl of target.media.slice(0, Math.max(1, maxMediaChecks))) {
    const detail = detailsByUrl.get(mediaUrl);
    assert(
      !detail || !['unavailable', 'invalid', 'missing'].includes(String(detail.availability || '').toLowerCase()),
      `Media is marked unavailable before browser test: ${mediaUrl} (${detail?.sourceStatus || detail?.availability || 'unknown'})`
    );

    const proxyPath = `/api/media-proxy?url=${encodeURIComponent(mediaUrl)}`;
    const { response, body } = await fetchText(proxyPath, {
      headers: { Range: 'bytes=0-0' },
      timeoutMs: 15000
    });
    results.push({
      mediaUrl,
      status: response.status,
      mediaSource: response.headers.get('x-media-source') || '',
      contentType: response.headers.get('content-type') || ''
    });
    assert(
      response.status === 200 || response.status === 206,
      `${proxyPath} returned HTTP ${response.status}: ${body.slice(0, 220)}`
    );
  }

  return results;
}

async function validateBrowser(target) {
  let puppeteer;
  try {
    puppeteer = require(path.join(root, 'backend/node_modules/puppeteer'));
  } catch (error) {
    throw new Error('Puppeteer is not installed under backend/node_modules. Run npm install in backend first.');
  }

  const browser = await puppeteer.launch({
    headless: headless ? 'new' : false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const failedResponses = [];
  const thumbnailFailures = [];
  const consoleErrors = [];
  const page = await browser.newPage();
  page.setDefaultTimeout(30000);

  page.on('response', (response) => {
    const url = response.url();
    if (/\/api\/project-media-thumbnail/i.test(url) && response.status() >= 400) {
      thumbnailFailures.push({ status: response.status(), url });
      return;
    }
    if (/\/api\/(media-proxy|project-media\/)/i.test(url) && response.status() >= 400) {
      failedResponses.push({ status: response.status(), url });
    }
  });
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      consoleErrors.push(`${message.type()}: ${message.text()}`);
    }
  });

  try {
    const params = new URLSearchParams({
      year: target.year,
      project: target.projectName
    });
    if (target.sourceId) params.set('sourceId', target.sourceId);

    await page.goto(makeUrl(`/pages/projects.html?${params.toString()}`), {
      waitUntil: 'domcontentloaded',
      timeout: 45000
    });

    await page.waitForFunction(() => {
      const cards = document.querySelectorAll('.media-card').length;
      const emptyText = document.querySelector('#media-grid')?.textContent || '';
      return cards > 0 || /Gagal memuat|Belum ada|Tidak ada proyek|source belum dapat diakses/i.test(emptyText);
    });

    if (mediaType && mediaType !== 'all') {
      await page.select('#filter-type', mediaType);
      await page.waitForFunction(() => {
        const cards = document.querySelectorAll('.media-card').length;
        const emptyText = document.querySelector('#media-grid')?.textContent || '';
        return cards > 0 || /Tidak ada media|Belum ada|Gagal memuat/i.test(emptyText);
      });
    }

    const gridState = await page.evaluate(() => ({
      cards: document.querySelectorAll('.media-card').length,
      disabledPreviewButtons: document.querySelectorAll('.btn-view[disabled]').length,
      sourceWarnings: Array.from(document.querySelectorAll('.media-source-warning')).map((item) => item.textContent.trim()),
      emptyText: document.querySelector('#media-grid')?.textContent.trim() || '',
      brokenThumbs: Array.from(document.querySelectorAll('.media-thumbnail img')).filter((img) => {
        const visible = getComputedStyle(img).display !== 'none';
        return visible && img.complete && img.naturalWidth === 0;
      }).map((img) => img.getAttribute('src') || '')
    }));

    assert(gridState.cards > 0, `Projects page rendered no media cards: ${gridState.emptyText}`);
    assert(gridState.sourceWarnings.length === 0, `Projects page shows source warning: ${gridState.sourceWarnings.join(' | ')}`);
    assert(gridState.disabledPreviewButtons === 0, `Projects page rendered ${gridState.disabledPreviewButtons} disabled preview button(s)`);
    assert(gridState.brokenThumbs.length === 0, `Projects page has broken visible thumbnail(s): ${gridState.brokenThumbs.join(' | ')}`);

    await page.click('.btn-view:not([disabled])');
    await page.waitForSelector('#mediaModal.show', { timeout: 10000 });
    await page.waitForFunction(() => {
      const viewer = document.querySelector('#media-viewer');
      if (!viewer) return false;
      if (/Media tidak dapat dimuat|gagal dimuat|Timeout/i.test(viewer.textContent || '')) return true;
      const img = viewer.querySelector('img');
      if (img && img.complete && img.naturalWidth > 0) return true;
      const video = viewer.querySelector('video');
      if (video && video.readyState >= 1) return true;
      return false;
    }, { timeout: 20000 });

    const previewState = await page.evaluate(() => ({
      text: document.querySelector('#media-viewer')?.textContent.trim() || '',
      imageLoaded: Boolean(document.querySelector('#media-viewer img')?.naturalWidth),
      videoReadyState: document.querySelector('#media-viewer video')?.readyState || 0
    }));

    assert(!/Media tidak dapat dimuat|gagal dimuat|Timeout/i.test(previewState.text), `Preview modal shows media warning: ${previewState.text}`);
    assert(previewState.imageLoaded || previewState.videoReadyState >= 1, 'Preview modal did not load an image/video');
    assert(failedResponses.length === 0, `Browser saw failed media/API responses: ${failedResponses.map((item) => `${item.status} ${item.url}`).join(' | ')}`);

    return {
      cards: gridState.cards,
      consoleErrors,
      thumbnailFailures
    };
  } finally {
    await page.close();
    await browser.close();
  }
}

(async () => {
  const target = await discoverTargetProject();
  const proxyResults = await validateMediaProxy(target);
  const browserResult = await validateBrowser(target);

  console.log('OK smoke-projects-client passed');
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Project: ${target.year} / ${target.sourceId || '-'} / ${target.projectName}`);
  console.log(`Media type: ${mediaType}`);
  console.log(`Media cards rendered: ${browserResult.cards}`);
  proxyResults.forEach((result, index) => {
    console.log(`Proxy ${index + 1}: HTTP ${result.status} ${result.mediaSource || '-'} ${result.contentType || '-'} ${result.mediaUrl}`);
  });
  if (browserResult.consoleErrors.length > 0) {
    console.log(`Browser console warnings/errors: ${browserResult.consoleErrors.slice(0, 5).join(' | ')}`);
  }
  if (browserResult.thumbnailFailures.length > 0) {
    console.log(`Thumbnail fallback warnings: ${browserResult.thumbnailFailures.slice(0, 5).map((item) => `${item.status} ${item.url}`).join(' | ')}`);
  }
})().catch((error) => {
  console.error(`FAIL smoke-projects-client: ${error.message}`);
  process.exit(1);
});
