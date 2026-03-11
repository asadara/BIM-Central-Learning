# Responsive Audit: Card and Container

Date: 2026-03-11
Keyword: `KW_CARD_CONTAINER_AUDIT_20260311`

## Scope

Audit target:
- `BC-Learning-Main/css/style.css`
- `BC-Learning-Main/elearning-assets/css/style.css`

Goal:
- identify global `.card` and `.container` overrides that can break responsiveness across pages
- separate low-risk shared baseline from page-specific styling

## Main Findings

### 1. Global Bootstrap container override in shared stylesheet

File:
- `BC-Learning-Main/css/style.css`

Rules:
- around `:208` to `:214` shared container width normalization
- around `:1007` to `:1013` global `flex: 1 !important` on every Bootstrap container

Assessment:
- `width: 100%` plus mobile padding rules are acceptable as baseline
- `flex: 1 !important` is high risk because it applies to every `.container`, `.container-fluid`, `.container-sm`, `.container-md`, `.container-lg`, `.container-xl`, `.container-xxl`

Why risky:
- can stretch containers inside layouts that were never meant to be flex children
- can distort alignment in pages using nested Bootstrap sections
- likely added as a sticky-footer workaround, but its blast radius is global

### 2. Global Bootstrap card override in shared stylesheet

File:
- `BC-Learning-Main/css/style.css`

Rules:
- around `:1149` to `:1158`

Current behavior:
- `.card { width: 100%; max-width: 320px; min-width: 250px; transition: transform 0.2s; }`
- `.card:hover { transform: scale(1.05); }`

Assessment:
- this is the most dangerous remaining global override

Why risky:
- forces every Bootstrap card to inherit a narrow card-grid pattern
- breaks pages where cards are supposed to fill grid columns naturally
- `min-width: 250px` is especially hostile to narrow screens and compact containers
- hover scale on all cards can create layout jump and overlap

### 3. Global card title truncation

File:
- `BC-Learning-Main/css/style.css`

Rules:
- around `:1160` to `:1167`

Current behavior:
- `.card-title` is globally truncated to one line with ellipsis

Why risky:
- affects unrelated dashboard/admin/content cards
- may hide important titles in narrow layouts

### 4. Global card body and footer behavior

File:
- `BC-Learning-Main/css/style.css`

Rules:
- around `:1275` to `:1285`

Current behavior:
- `.card-body { flex-grow: 1; }`
- `.card-footer { height: 60px; display: flex; align-items: center; justify-content: center; }`

Assessment:
- medium risk

Why risky:
- works for some fixed-height card designs
- can misalign footer content or force awkward empty space on pages using normal Bootstrap card footers

### 5. E-learning stylesheet does not currently have a generic `.card` override

File:
- `BC-Learning-Main/elearning-assets/css/style.css`

Assessment:
- lower risk than main shared stylesheet for this specific audit

Notes:
- it contains component rules such as `.card-header`, `.card-content`, `.card-actions`
- these are still broad names and can collide semantically, but they are not a blanket `.card { ... }` override

## Impacted Areas Observed

High-likelihood impact from global `.card` / `.container` rules:
- `BC-Learning-Main/pages/dashboard.html`
- `BC-Learning-Main/pages/elearning.html`
- `BC-Learning-Main/pages/library.html`
- `BC-Learning-Main/pages/tutorial.html`
- `BC-Learning-Main/pages/projects.html`
- `BC-Learning-Main/pages/Knowledgehub.html`
- `BC-Learning-Main/pages/sub/adminbcl.html`

Lower-risk but related:
- any page using Bootstrap `container` for normal layout spacing
- any page using shared footer with custom flex wrappers

## Recommended Safe Order

### Batch A
- scope or remove global `.container { flex: 1 !important; }`
- replace with a page-level or layout-wrapper-level sticky-footer rule

### Batch B
- remove global `.card` width/min/max/hover rule from shared stylesheet
- move it into only the page that actually needs that card-grid behavior

### Batch C
- scope `.card-title`, `.card-body`, `.card-footer` to specific card systems instead of all Bootstrap cards

### Batch D
- review `elearning-assets/css/style.css` for semantic collisions like `.card-header` and `.card-content`
- rename toward component-specific selectors if needed

## Recommendation

Next safest move:
- fix the global `.container { flex: 1 !important; }` first
- then isolate the global `.card` rule

Reason:
- both are shared-architecture issues with the highest blast radius
- both can be replaced incrementally without redesigning every page at once

## Status Update

Completed:
- global `.container* { flex: 1 !important; }` workaround has been removed from:
  - `BC-Learning-Main/css/style.css`
  - `BC-Learning-Main/css/navbar-footer-fix.css`
- sticky footer behavior now uses:
  - `body { display: flex; flex-direction: column; }`
  - `#footer-container { margin-top: auto; width: 100%; }`

Quick verification after change:
- homepage mobile: no horizontal overflow
- `pages/modul.html` mobile: no horizontal overflow, short-page footer still sits near bottom
- `pages/projects.html` mobile: no horizontal overflow

Next recommended batch:
- isolate the remaining global `.card` rule in `BC-Learning-Main/css/style.css`

## Status Update 2

Completed:
- global `.card` width / min-width / hover / title truncation override has been removed from:
  - `BC-Learning-Main/css/style.css`
- dashboard-specific card presentation has been replaced locally in:
  - `BC-Learning-Main/pages/dashboard.html`

Quick verification target after change:
- `pages/dashboard.html` should keep its elevated card look without relying on shared `.card`
- `pages/elearning.html` course cards should continue using local `.course-card` styling
- `pages/bim-mindset.html` quiz card should fall back to normal Bootstrap card behavior without horizontal overflow

Next recommended batch:
- scope the remaining global `.card-body` and `.card-footer` rules if they still create cross-page side effects
