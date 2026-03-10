const fs = require('fs');
const path = require('path');

const DEFAULT_SRC_ROOT = 'C:/BCL/PC-BIM02';
const DEFAULT_DST_ROOT = 'C:/BCL/data/pc-bim02-cache/PROJECT BIM 2025';
const SYNC_FOLDER = 'MEDIA_SYNC';
const VALID_EXT = new Set([
  '.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp',
  '.mp4', '.mov', '.webm', '.avi', '.mkv', '.wmv'
]);

function parseArgs(argv) {
  const options = {
    projects: [],
    skipExisting: true,
    srcRoot: DEFAULT_SRC_ROOT,
    dstRoot: DEFAULT_DST_ROOT
  };

  for (const arg of argv) {
    if (arg.startsWith('--projects=')) {
      options.projects = arg
        .slice('--projects='.length)
        .split('|')
        .map((value) => value.trim())
        .filter(Boolean);
      continue;
    }

    if (arg === '--force') {
      options.skipExisting = false;
      continue;
    }

    if (arg.startsWith('--src=')) {
      options.srcRoot = arg.slice('--src='.length).trim() || DEFAULT_SRC_ROOT;
      continue;
    }

    if (arg.startsWith('--dst=')) {
      options.dstRoot = arg.slice('--dst='.length).trim() || DEFAULT_DST_ROOT;
    }
  }

  return options;
}

function walkMediaFiles(dir, bucket) {
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkMediaFiles(fullPath, bucket);
      continue;
    }

    if (!entry.isFile()) continue;

    const ext = path.extname(entry.name).toLowerCase();
    if (VALID_EXT.has(ext)) {
      bucket.push(fullPath);
    }
  }
}

function sanitizeBaseName(filePath) {
  const parsed = path.parse(filePath);
  const clean = parsed.name.replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '');
  return `${clean || 'media'}${parsed.ext.toLowerCase()}`;
}

function getProjectNames(srcRoot, requestedProjects) {
  if (requestedProjects.length > 0) {
    return requestedProjects;
  }

  return fs.readdirSync(srcRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, 'en'));
}

function ensureCleanDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}

function countFiles(dir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true }).filter((entry) => entry.isFile()).length;
  } catch {
    return 0;
  }
}

function syncProject(projectName, options) {
  const projectPath = path.join(options.srcRoot, projectName);
  if (!fs.existsSync(projectPath) || !fs.statSync(projectPath).isDirectory()) {
    console.log(`MISSING|${projectName}`);
    return;
  }

  const syncDir = path.join(options.dstRoot, projectName, SYNC_FOLDER);
  const existingCount = countFiles(syncDir);
  if (options.skipExisting && existingCount > 0) {
    console.log(`SKIP|${projectName}|${existingCount}`);
    return;
  }

  const mediaFiles = [];
  walkMediaFiles(projectPath, mediaFiles);
  if (mediaFiles.length === 0) {
    console.log(`EMPTY|${projectName}`);
    return;
  }

  ensureCleanDir(syncDir);

  let index = 0;
  for (const mediaFile of mediaFiles) {
    index += 1;
    const destName = `${String(index).padStart(4, '0')}__${sanitizeBaseName(mediaFile)}`;
    const destPath = path.join(syncDir, destName);

    try {
      fs.linkSync(mediaFile, destPath);
    } catch {
      fs.copyFileSync(mediaFile, destPath);
    }
  }

  console.log(`SYNCED|${projectName}|${mediaFiles.length}`);
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const projects = getProjectNames(options.srcRoot, options.projects);

  console.log(`START|projects=${projects.length}|skipExisting=${options.skipExisting}|src=${options.srcRoot}|dst=${options.dstRoot}`);
  for (const projectName of projects) {
    syncProject(projectName, options);
  }
  console.log('DONE');
}

main();
