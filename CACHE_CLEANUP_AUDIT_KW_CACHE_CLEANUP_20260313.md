# Cache Cleanup Audit

Date: 2026-03-13
Scope:
- `C:\BCL\data\pc-bim02-cache`
- `C:\BCL\backend\public\cache\project-media-proxy`

## Summary

The two largest storage consumers under `C:\BCL` are not equal in cleanup safety.

- `backend\public\cache\project-media-proxy` is a derived cache and is the safest large target for pruning.
- `data\pc-bim02-cache` is currently acting as an operational fallback source and should not be aggressively deleted while the primary `PC-BIM02` link remains unstable.

## Measured Size

- `C:\BCL\data\pc-bim02-cache`: `42.321 GB`, `3519` files
- `C:\BCL\backend\public\cache\project-media-proxy`: `37.512 GB`, `3441` files

Breakdown:
- `pc-bim02-cache\PROJECT BIM 2025`: `41.972 GB`
- `pc-bim02-cache\PROJECT BIM 2026`: `0.348 GB`

## Runtime Relevance

### `pc-bim02-cache`

Evidence:
- [lan-mounts.json](/c:/BCL/backend/utils/lan-mounts.json) maps `pc-bim02` and `pc-bim02-2026` local mount points to:
  - `C:\BCL\data\pc-bim02-cache\PROJECT BIM 2025`
  - `C:\BCL\data\pc-bim02-cache\PROJECT BIM 2026`
- [projectMediaUtilityService.js](/c:/BCL/backend/services/projectMediaUtilityService.js) explicitly treats `pc-bim02-cache` as a lower-priority mirror, not junk.
- [bimMethodeRoutes.js](/c:/BCL/backend/routes/bimMethodeRoutes.js) uses the same candidate strategy for BIM Methode source resolution.

Critical finding:
- `C:\BCL\PC-BIM02` is a symbolic link to `\\10.0.0.122\PROJECT BIM 2025`
- In the current environment, direct access to that link returns `The network path was not found`

Operational meaning:
- The intended primary local source is not currently healthy.
- Because of that, `data\pc-bim02-cache` remains an important local fallback source for media browsing and BIM-related file access.

### `project-media-proxy`

Evidence:
- [server.js](/c:/BCL/backend/server.js) defines `PROJECT_MEDIA_PROXY_CACHE_DIR` at `backend\public\cache\project-media-proxy`
- [projectMediaUtilityRoutes.js](/c:/BCL/backend/routes/projectMediaUtilityRoutes.js) serves `/api/media-proxy`
- If source exists, the route streams origin directly and only refreshes cache asynchronously.
- The route only serves cached copy when origin is unavailable.
- [projectMediaUtilityService.js](/c:/BCL/backend/services/projectMediaUtilityService.js) currently limits cache refresh eligibility to small image-like extensions.

Operational meaning:
- This folder is not the canonical source.
- It is a convenience cache.
- Clearing it does not remove the underlying project media if the source path remains reachable.

## Content Profile

### `project-media-proxy`

By extension:
- `.mp4`: `27.505 GB`
- `.avi`: `7.496 GB`
- `.png`: `1.402 GB`
- `.jpg`: `1.076 GB`
- other extensions: negligible

Important inconsistency:
- Current cache policy only considers image-like files cacheable.
- Despite that, the cache still contains `35.020 GB` of video files (`.mp4`, `.avi`, `.wmv`).
- That strongly indicates legacy cache buildup from older behavior.

Age profile:
- newer than 30 days: `0.695 GB`
- older than 30 days: `36.817 GB`
- older than 90 days: `31.385 GB`
- older than 180 days: `6.233 GB`
- older than 365 days: `0.248 GB`

Conclusion:
- Most of the storage here is stale cache, especially old video payloads.

### `pc-bim02-cache`

By extension:
- `.mp4`: `27.520 GB`
- `.avi`: `7.496 GB`
- `.png`: `1.664 GB`
- `.jpg`: `0.990 GB`
- `.rvt`: `1.308 GB`
- `.tm`: `1.197 GB`
- `.fbx`: `0.650 GB`
- `.pptx`: `0.341 GB`
- `.dwg`: `0.183 GB`
- `.rfa`: `0.138 GB`

Age profile:
- older than 30 days: `40.211 GB`
- older than 90 days: `32.093 GB`
- older than 180 days: `6.919 GB`
- older than 365 days: `0.205 GB`

Conclusion:
- This is not just a thumbnail/image cache.
- It contains project media plus source-like BIM assets (`.rvt`, `.rfa`, `.fbx`, `.tm`, `.dwg`, `.pptx`).
- Deleting it would remove a meaningful offline/local mirror of production material.

## Cleanup Recommendation

### Safe Candidate: `backend\public\cache\project-media-proxy`

Recommended action order:
1. Prune all cached videos first (`.mp4`, `.avi`, `.wmv`)
2. Re-test `projects.html`, project preview, and any direct `/api/media-proxy` consumers
3. If stable, consider full cache flush

Why this is safe:
- Source media is streamed directly when available
- Cache repopulates only as needed
- Current policy no longer wants large video cache here anyway

Expected space recovery:
- video-only prune: about `35.020 GB`
- full folder flush: about `37.512 GB`

Risk:
- If source path is temporarily unavailable, first request may fail until source is restored
- Existing stale cache can currently mask some source outages

### Do Not Aggressively Delete Yet: `data\pc-bim02-cache`

Recommended action:
- keep for now
- only consider pruning after `C:\BCL\PC-BIM02` is restored and verified stable as a working live source
- if cleanup is still desired later, quarantine by year or by project group first, not full delete

Why not safe right now:
- the intended primary symlink target is currently unavailable
- this cache mirror may be the only reliable local source for some project/BIM flows

## Suggested Next Cleanup Batch

Best next storage-saving move:
1. prune `backend\public\cache\project-media-proxy` video files
2. re-verify runtime
3. decide whether to flush remaining image cache too

Not recommended yet:
- deleting `data\pc-bim02-cache`

## Status

Batch executed on 2026-03-13:
1. Pruned cached video files from [project-media-proxy](/c:/BCL/backend/public/cache/project-media-proxy)
   - deleted extensions: `.mp4`, `.avi`, `.wmv`
2. Flushed the remaining derived cache files from [project-media-proxy](/c:/BCL/backend/public/cache/project-media-proxy)

Measured result after flush:
- remaining files in `project-media-proxy`: `0`
- remaining size in `project-media-proxy`: `0 MB`

Verification after prune:
- `https://bcl.nke.net/api/server/status` still returned `running`
- `node .\backend\scripts\db-ping.js` remained healthy

No deletion was performed in `data\pc-bim02-cache`.
