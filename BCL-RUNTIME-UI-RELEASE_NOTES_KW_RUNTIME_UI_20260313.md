# BCL Runtime and Shared UI Release Notes

Date: 2026-03-13
Keyword: `KW_RUNTIME_UI_20260313`
Commit: `8ad4885f6851880ae1af8744190370ddc98e27b1`

## Scope

- runtime startup, watchdog, and Docker fallback cleanup
- shared navbar behavior across `pages` and `elearning-assets`
- frontend console-noise reduction
- `Knowledgehub`, `Projects`, `Plugins`, `BIM Methode`, `Admin BCL`, and e-learning page fixes
- BIM media public cache and projects explorer cache

## Main Outcomes

### 1. Runtime no longer depends on Docker Desktop

- `start-bcl-http.bat`, `stop-bcl-http.bat`, and `watchdog-bcl.bat` were simplified toward native PostgreSQL service usage.
- Native PostgreSQL on the host is now the expected production database path.
- Docker fallback logic was removed from the active runtime path.

### 2. Shared navbar behavior is now consistent

- The trio logo block remains the priority area.
- Desktop navbar stays expanded only while the layout still fits cleanly.
- When width becomes tight, navbar now collapses into a hamburger pattern instead of allowing menu overlap.
- The same navbar scheme now applies to both:
  - `BC-Learning-Main/components/navbar.html`
  - `BC-Learning-Main/elearning-assets/components/navbar.html`

### 3. E-learning mobile header duplication was removed

- The old mobile top header in `elearning-assets` was hidden/removed from the active mobile experience.
- Android/mobile views now rely on the shared navbar instead of showing a second header row with search/profile/settings icons.

### 4. Console output was cleaned across many public pages

- Removed non-urgent `console.log`, `console.info`, and similar debug noise from shared loaders and multiple page scripts.
- Retained only failure-oriented logging where it still helps diagnose real issues.
- Reduced unauthenticated admin/session noise on pages that should not probe admin state aggressively.

### 5. Knowledgehub viewer path was repaired and simplified

- `showroom-player.js` was reduced to the logic actually used by `Knowledgehub.html`.
- Sidebar/navigation behavior was simplified.
- Preview auto-hides until a media item is selected.
- Preview sizing now uses contain-style media display so images/videos are shown fully instead of being cropped.
- BIM media tagged from Admin Panel now uses a public cache path for live preview.

### 6. Projects page loading was stabilized

- `projects-explorer.js` now reads fast static cache files for years, project lists, and project media before falling back to slower API paths.
- New cache helper scripts were added:
  - `sync-projects-explorer-cache.ps1`
  - `sync-project-media-cache.ps1`

### 7. BIM media public publishing path was added

- Added `sync-bim-media-public.ps1`.
- Tagged BIM media intended for public preview can now be copied into `data/bim-media-public` for reliable serving through Nginx.
- This avoids direct dependency on backend service access to external UNC paths during public playback.

## Files to Know

- `start-bcl-http.bat`
- `stop-bcl-http.bat`
- `watchdog-bcl.bat`
- `BC-Learning-Main/components/navbar.html`
- `BC-Learning-Main/elearning-assets/components/navbar.html`
- `BC-Learning-Main/elearning-assets/components/header.html`
- `BC-Learning-Main/pages/Knowledgehub.html`
- `BC-Learning-Main/js/showroom-player.js`
- `BC-Learning-Main/js/projects-explorer.js`
- `backend/services/projectCatalogService.js`
- `backend/routes/bimMediaPublic.js`

## Verification Snapshot

- runtime verified healthy without Docker daemon running
- shared navbar verified in desktop and narrow-width states
- `Knowledgehub` preview verified to use contain-style media layout
- several e-learning pages verified with zero browser console messages after cleanup
- `BIM Questions` admin list route corrected from 404 to the active questions API

## Operational Notes

1. If BIM media tags change, refresh the public cache:

```powershell
powershell -ExecutionPolicy Bypass -File C:\BCL\sync-bim-media-public.ps1
```

2. If projects/media catalog changes, refresh the explorer caches:

```powershell
powershell -ExecutionPolicy Bypass -File C:\BCL\sync-projects-explorer-cache.ps1
```

3. `5051` should still be treated as compatibility-only while `5052` remains the real backend path.

## Residual Follow-up

- remove or retire the old scheduled task `BCL Auto Start (Logon Hidden Fallback)` with an elevated terminal if it is no longer needed
- optionally reload/restart the backend process when backend-side cache optimizations need to go live immediately
- continue sweeping remaining pages only if there are real runtime errors, not just old debug output
