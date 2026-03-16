# Data Cleanup Audit

Date: 2026-03-13
Scope:
- `C:\BCL\data`

## Summary

The `data` folder is dominated by one large operational fallback mirror:

- [pc-bim02-cache](/c:/BCL/data/pc-bim02-cache): `42.321 GB`

Everything else under `data` is relatively small and currently has a clear runtime role:

- [bim-media-public](/c:/BCL/data/bim-media-public): `0.953 GB`
- [iso19650](/c:/BCL/data/iso19650): `0.023 GB`
- [projects-explorer-cache](/c:/BCL/data/projects-explorer-cache): `0.016 GB`

## Current Sizes

- [pc-bim02-cache](/c:/BCL/data/pc-bim02-cache): `42.321 GB`, `3519` files
- [bim-media-public](/c:/BCL/data/bim-media-public): `0.953 GB`, `9` files
- [iso19650](/c:/BCL/data/iso19650): `0.023 GB`, `4` files
- [projects-explorer-cache](/c:/BCL/data/projects-explorer-cache): `0.016 GB`, `233` files

## Runtime Relevance

### `pc-bim02-cache`

This remains the only meaningful storage target in `data`.

Important context:
- [projectMediaUtilityService.js](/c:/BCL/backend/services/projectMediaUtilityService.js) and [bimMethodeRoutes.js](/c:/BCL/backend/routes/bimMethodeRoutes.js) treat `pc-bim02-cache` as a lower-priority mirror, not junk.
- [lan-mounts.json](/c:/BCL/backend/utils/lan-mounts.json) maps:
  - `pc-bim02` -> `C:\BCL\data\pc-bim02-cache\PROJECT BIM 2025`
  - `pc-bim02-2026` -> `C:\BCL\data\pc-bim02-cache\PROJECT BIM 2026`
- The intended primary source `C:\BCL\PC-BIM02` is a symlink to a UNC path and is not reliably accessible in the current environment.

Operational conclusion:
- `pc-bim02-cache` is still acting as a practical fallback source.
- Do not aggressively delete or quarantine it yet.

Largest subfolders under [PROJECT BIM 2025](/c:/BCL/data/pc-bim02-cache/PROJECT%20BIM%202025):
- `13. RENOVASI BANK INDONESIA - BALI`: `12.718 GB`
- `11. CIPUTRA WORLD - MAKASSAR`: `8.744 GB`
- `20. METHODE ESTIMATE & TENDER`: `5.507 GB`
- `18. KANTOR KEMENTERIAN PU - TIMOR LESTE`: `3.915 GB`
- `06. HILTON MEGA KUNINGAN`: `3.844 GB`
- `22. PDHJ - TIMOR LESTE`: `2.086 GB`
- `07. FT GEDUNG UNP`: `1.580 GB`

Largest subfolder under [PROJECT BIM 2026](/c:/BCL/data/pc-bim02-cache/PROJECT%20BIM%202026):
- `01. UNIVERSITAS CIPUTRA SURABAYA`: `0.348 GB`

### `bim-media-public`

This is a small public publish cache used by Knowledge Hub/Admin preview fallback:
- referenced by [showroom-player.js](/c:/BCL/BC-Learning-Main/js/showroom-player.js)
- referenced by [content-management.js](/c:/BCL/BC-Learning-Main/js/admin/modules/content-management.js)
- referenced by [adminbcl.js](/c:/BCL/BC-Learning-Main/pages/sub/adminbcl.js)
- regenerated via [sync-bim-media-public.ps1](/c:/BCL/sync-bim-media-public.ps1)

Operational conclusion:
- Regeneratable, but currently useful.
- Keep unless you explicitly want to republish it later.

### `projects-explorer-cache`

This is a small derived cache:
- used by [projects-explorer.js](/c:/BCL/BC-Learning-Main/js/projects-explorer.js)
- written/read by [projectCatalogService.js](/c:/BCL/backend/services/projectCatalogService.js)
- regenerated via [sync-projects-explorer-cache.ps1](/c:/BCL/sync-projects-explorer-cache.ps1)

Operational conclusion:
- Fully regeneratable.
- Very small, so low-value cleanup target.

### `iso19650`

This is not cache. It is live content referenced directly by [standards.html](/c:/BCL/BC-Learning-Main/pages/standards.html).

Operational conclusion:
- Keep.

## Safe Cleanup Performed

Executed in this batch:
- removed empty folder [bim-media-public-test](/c:/BCL/data/bim-media-public-test)
- deleted all `Thumbs.db` files under [data](/c:/BCL/data)
- rebuilt [projects-explorer-cache](/c:/BCL/data/projects-explorer-cache) cleanly via [sync-projects-explorer-cache.ps1](/c:/BCL/sync-projects-explorer-cache.ps1)

Attempted:
- none

## Recommendation

### Keep
- [pc-bim02-cache](/c:/BCL/data/pc-bim02-cache)
- [bim-media-public](/c:/BCL/data/bim-media-public)
- [iso19650](/c:/BCL/data/iso19650)

### Optional Regeneratable
- [projects-explorer-cache](/c:/BCL/data/projects-explorer-cache)

### Main Decision Still Pending

If you want meaningful storage recovery from `data`, the only real candidate is [pc-bim02-cache](/c:/BCL/data/pc-bim02-cache). That should only happen after one of these is true:

1. `C:\BCL\PC-BIM02` is restored and verified stable
2. specific project groups inside `pc-bim02-cache` are confirmed obsolete and can be quarantined selectively

## Suggested Next Step Inside `data`

Do a selective project-level quarantine analysis for the biggest project folders inside `pc-bim02-cache`, starting with:
- `13. RENOVASI BANK INDONESIA - BALI`
- `11. CIPUTRA WORLD - MAKASSAR`
- `20. METHODE ESTIMATE & TENDER`
- `18. KANTOR KEMENTERIAN PU - TIMOR LESTE`
- `06. HILTON MEGA KUNINGAN`

If you do not want to make project-level retention decisions, `data` should be considered complete for safe cleanup at this stage.

## Reminder

After `data` is considered finished, the next cleanup locus should move to:
1. `backend`
2. `BC-Learning-Main`
