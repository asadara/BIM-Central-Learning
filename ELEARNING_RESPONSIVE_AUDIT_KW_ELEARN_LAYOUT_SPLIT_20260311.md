# E-Learning Responsive Audit

Date: 2026-03-11
Keyword: `KW_ELEARN_LAYOUT_SPLIT_20260311`

## Scope

- `BC-Learning-Main/elearning-assets/css/style.css`
- `BC-Learning-Main/elearning-assets/profile.html`
- `BC-Learning-Main/elearning-assets/login.html`
- `BC-Learning-Main/elearning-assets/register.html`
- `BC-Learning-Main/elearning-assets/favorites.html`

## Main Finding

`/elearning-assets` behaves like a separate front-end system.

It already has:
- its own fixed top navbar shell via `#navbar-container`
- its own sidebar layout via `body { padding-left: 30rem; }`
- its own responsive rules that collapse the sidebar under `1200px`
- its own page-specific modules such as profile, dashboard, courses, exams, and practice

The main inconsistency came from a mixed-style setup:
- several e-learning pages also loaded `../css/style.css` from the main site
- those pages were therefore combining two layout systems in one document

Affected pages found during audit:
- `elearning-assets/profile.html`
- `elearning-assets/login.html`
- `elearning-assets/register.html`
- `elearning-assets/favorites.html`

## Risks Observed

- duplicate navbar/layout assumptions between main-site CSS and e-learning CSS
- desktop-first width behavior leaking into pages that should follow the e-learning mobile/sidebar model
- profile page showed the clearest symptom during mobile verification, with a large overflow footprint while auth modal logic was active

## Applied Fixes

- removed `../css/style.css` from the four mixed-layout e-learning pages above
- added mobile-safe baseline rules to `elearning-assets/css/style.css`:
  - `body { max-width: 100%; overflow-x: hidden; }`
  - media elements constrained with `max-width: 100%`
- reduced oversized card/grid minimums in shared e-learning CSS:
  - `.upgrade-cards`
  - `.progress-grid`
  - `.overview-grid`

## Verification Targets

- `home.html`
- `dashboard.html`
- `courses.html`
- `search.html`
- `profile.html`

## Next Recommended Batch

- audit pages that still use legacy inline header/footer instead of `header-container` and `footer-container`
- especially:
  - `watch-video.html`
  - `teacher_profile.html`
- scope broad semantic selectors in `elearning-assets/css/style.css` such as:
  - `.card-header`
  - `.card-actions`
  - `.modal-body`
