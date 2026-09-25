# Projects Explorer Route Authentication — Remediation Note

**Recorded:** 24 September 2026
**Origin:** BCL Internship Phase 0/1A security review
**Status:** Open; intentionally outside Internship Phase 1A

## Finding

`backend/routes/projectCatalogRoutes.js` exposes these routes without explicit route-level authentication:

- `GET /api/years`
- `GET /api/projects/:year`
- `GET /api/project-media/:year/:project`
- `POST /api/projects/refresh-cache`

The read routes can disclose internal project catalog and media metadata. The refresh route can start a server-side PowerShell synchronization process. File perimeter checks elsewhere do not provide object-level authorization for these catalog routes.

No Projects data or endpoint is used by the Internship Phase 1A implementation.

## Recommended smallest remediation

1. Require validated BCL authentication on catalog read routes.
2. Apply the existing project/feature-access policy, if that policy is the intended entitlement boundary.
3. Require `system_admin` for `POST /api/projects/refresh-cache` and add rate/concurrency protection.
4. Allowlist response fields and remove native paths, UNC roots, mount identifiers, and sensitive error details.
5. Add tests for unauthenticated, unauthorized, authorized, and admin-only refresh access.

## Regression considerations

- `projects.html` currently may depend on anonymous catalog calls; adding auth must preserve the login/redirect behavior expected by internal users.
- Media proxy and cached project sources use multiple mounts. Authorization must be enforced before source resolution without breaking valid internal thumbnails/media.
- Refresh automation or operational scripts may call the current endpoint without credentials and will need a supported authenticated mechanism.

## Recommended handling

Track this as a dedicated security change with its own rollout and regression tests. Do not couple it to Internship, evidence upload, or BCL Online. If exposure is reachable outside the trusted internal perimeter, prioritize the remediation independently as a security hotfix.
