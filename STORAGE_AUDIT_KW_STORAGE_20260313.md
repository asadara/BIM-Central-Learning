# Storage Audit

Date: 2026-03-13
Keyword: `KW_STORAGE_20260313`

## Top Level Size

- `C:\BCL\data` = `43.312 GB`
- `C:\BCL\backend` = `38.339 GB`
- `C:\BCL\BC-Learning-Main` = `0.586 GB`

## Main Findings

### 1. `data` is the largest consumer

- `C:\BCL\data\pc-bim02-cache` = `42.321 GB`
- `C:\BCL\data\bim-media-public` = `0.953 GB`
- `C:\BCL\data\iso19650` = `0.023 GB`
- `C:\BCL\data\projects-explorer-cache` = `0.016 GB`

Within `pc-bim02-cache`:

- `PROJECT BIM 2025` = `41.973 GB`
- `PROJECT BIM 2026` = `0.348 GB`

Interpretation:

- ini jelas cache mirror terbesar dari data proyek BIM
- target penghematan storage paling signifikan ada di sini

### 2. `backend` is large because of public cache

- `C:\BCL\backend\public` = `37.851 GB`
- `C:\BCL\backend\node_modules` = `0.479 GB`
- `C:\BCL\backend\uploads` = `0.006 GB`

Inside `backend\public`:

- `cache` = `37.765 GB`
- `thumbnails` = `0.073 GB`
- `converted` = `0.012 GB`

Inside `backend\public\cache`:

- `project-media-proxy` = `37.512 GB`
- `bim-methode-files` = `0.240 GB`
- `bim-methode-thumbnails` = `0.007 GB`
- `bim-methode-thumbnails-stable` = `0.005 GB`

Interpretation:

- beban storage backend hampir seluruhnya datang dari cache proxy media proyek
- `node_modules` bukan isu utama

### 3. `BC-Learning-Main` is relatively small

- `C:\BCL\BC-Learning-Main\elearning-assets` = `0.562 GB`
- `C:\BCL\BC-Learning-Main\img` = `0.018 GB`

Inside `elearning-assets`:

- `materials` = `0.466 GB`
- `images` = `0.049 GB`
- `videos` = `0.040 GB`
- `test` = `0.003 GB`

Interpretation:

- frontend bukan target utama pengurangan disk
- cleanup frontend lebih bernilai untuk hygiene repo daripada penghematan storage besar

## Runtime Relevance

Relevant code references found:

- `BC-Learning-Main\js\projects-explorer.js`
  - memakai `C:\BCL\data\projects-explorer-cache`

- `BC-Learning-Main\js\showroom-player.js`
- `BC-Learning-Main\js\admin\modules\content-management.js`
- `BC-Learning-Main\pages\sub\adminbcl.js`
  - memakai `C:\BCL\data\bim-media-public`

- `backend\server.js`
  - memakai `backend\public\cache\project-media-proxy`

- `backend\services\projectCatalogService.js`
  - memakai `data\projects-explorer-cache\media`

## Cleanup Priority

### Highest Impact

1. `C:\BCL\data\pc-bim02-cache`
2. `C:\BCL\backend\public\cache\project-media-proxy`

### Medium Impact

3. `C:\BCL\data\bim-media-public`
Only if old published BIM media is no longer needed.

### Low Impact

4. `C:\BCL\BC-Learning-Main\elearning-assets\materials`
This can save some space, but nowhere near the impact of the cache folders above.

## Recommendation

Next audit should focus on:

1. whether `data\pc-bim02-cache` is a regeneratable mirror or the only local copy used operationally
2. whether `backend\public\cache\project-media-proxy` can be pruned by age or fully regenerated on demand
3. defining a cache retention policy instead of ad-hoc deletion

## Do Not Delete Yet

- `data\projects-explorer-cache`
- `data\bim-media-public`
- `backend\public\cache\bim-methode-files`
- `backend\public\cache\bim-methode-thumbnails*`

Reason:

- these are small compared with the main heavy folders
- they currently support live features already tuned in the application
