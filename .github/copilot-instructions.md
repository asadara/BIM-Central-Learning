## Quick orientation — BCL Phase‑4 (Enterprise)

This repository contains a monorepo-like web platform: a Node/Express backend in `backend/` and a static frontend in `BC-Learning-Main/`. Phase‑4 enterprise features are implemented as in‑process/simulated components inside `backend/server.js` and exercised from the frontend and utility scripts.

What an AI coding agent needs to know to be productive:

- Architecture & important locations
  - Backend: `c:\BCL\backend` — main entry `server.js` (CommonJS). Routes live in `backend/routes/` and `backend/elearning/*`.
  - Frontend: `c:\BCL\BC-Learning-Main` — static site served by the backend (templates, pages, `elearning-assets`).
  - Media: configured via `BASE_DIR` env var (default in `server.js` = `G:/BIM CENTRAL LEARNING/`). Thumbnails are generated into `backend/public/thumbnails`.

- Developer workflows (concrete commands & env)
  - Install backend deps: `cd C:\BCL\backend && npm install`.
  - Start backend (production): `node server.js` (the `backend/package.json` also exposes `start` and `dev` scripts; `npm run dev` uses nodemon if installed).
  - Recommended env vars (used by `server.js` and startup scripts):
    - `USE_HTTPS` ("false" by default in repo), `HTTP_PORT` or `HTTP_PORT` fallback inside `server.js` uses `HTTP_PORT || 5051`.
    - `JWT_SECRET` used for JWTs (default `supersecretkey_change_in_production` in code — override in env).
    - `PHASE4_ENABLED` (used by docs/scripts). See `PHASE4_STARTUP_GUIDE.md` for examples.
  - Quick start (PowerShell example from repo docs):
    - `cd C:\BCL\backend; $env:USE_HTTPS='false'; node server.js`  — server listens on the configured HTTP port (default 5051 in `server.js`).

- Key endpoints you can call for tests
  - Health: `GET /ping`
  - Phase‑4 status: `GET /api/phase4/status` (returns the simulated enterprise components state).
  - AI assistant: `GET /api/ai-assistant` and `POST /api/ai-assistant/chat` (accepts JSON {message}).
  - Useful static paths: frontend served from `BC-Learning-Main` and videos are served from `BASE_DIR` via Express static.

- Project conventions & patterns to preserve
  - Server uses CommonJS and synchronous file access for some utilities (e.g., thumbnail generation, video discovery). Prefer minimal, non-breaking edits when touching `server.js`.
  - Several admin/dev convenience scripts assume Windows (PowerShell or .bat). Do not remove `run-phase4.ps1`, `startup-phase4-enterprise.ps1`, or `start-phase4-enterprise.bat` without updating docs.
  - Admin token documented in `ADMINBCL_README.md`: header `x-admin-token: AdminBCL2025!` is used by admin endpoints — treat as environment/config in production change requests.
  - Tagging priority: manual tags (`tags.json`) override auto extraction (see `ADMINBCL_README.md`). Keep that order when editing `tutorialRoutes` or tag logic.

- Integration points & external deps
  - External libs used heavily by backend: `express`, `cors`, `multer`, `jsonwebtoken`, `bcrypt`, `nodemailer`, `puppeteer`, `fluent-ffmpeg` etc. See `backend/package.json`.
  - The codebase expects local SSL files (`backend/bcl.key`, `backend/bcl.crt`) for HTTPS mode; HTTP is default in `server.js` for dev.
  - Some features assume access to large media files in `BASE_DIR` (G: drive default); when testing locally without that path, provide a smaller media folder and update `BASE_DIR` env.
  - **NEW Phase 4 Feature**: LAN mount support via `backend/utils/lanMountManager.js` and `/api/lan/*` endpoints — allows accessing network shares from other PCs on LAN. See `LAN-MOUNT-DOCUMENTATION.md` for setup.

- Notes for AI edits (how to behave)
  - Keep all Windows-centric scripts and README instructions intact unless adding cross-platform alternatives. If you add Linux/macOS variants, include both scripts and a short README section.
  - Avoid changing hard-coded admin/demo credentials or demo admin toggles (these are documented in `ADMINBCL_README.md`). If needed, put changes behind a clearly named env var and document it.
  - When modifying `server.js`, preserve the top-level component simulation object (`phase4Components`) and endpoints under `/api/phase4/*` — they are used by frontend tests and startup docs.
  - Prefer non-breaking changes: e.g., add new routes under `/api/phase4/*` or `/api/admin/*` and document them in `PHASE4_STARTUP_GUIDE.md` and `ADMINBCL_README.md`.

- Short examples (copy/pasteable tests)
  - Health check (PowerShell): `Invoke-RestMethod -Uri http://localhost:5051/ping`
  - Phase 4 status: `curl http://localhost:5051/api/phase4/status`
  - AI assistant chat: `curl -X POST -H "Content-Type: application/json" -d '{"message":"Hai"}' http://localhost:5051/api/ai-assistant/chat`

- Files to review when changing behavior
  - `backend/server.js` — entrypoint, component simulation, static serving
  - `backend/routes/*` and `backend/elearning/routes/*` — API surface
  - `ADMINBCL_README.md` and `PHASE4_STARTUP_GUIDE.md` — operational expectations and scripts to keep in sync
  - `BC-Learning-Main/*` — frontend pages and client-side components (e.g. `pages/*.html`, `elearning-assets/js/*`)

If anything in these instructions is unclear, point to the specific file or flow you want the agent to change and I will update this guidance or implement the change. Thank you — please review and tell me what to improve or add.
