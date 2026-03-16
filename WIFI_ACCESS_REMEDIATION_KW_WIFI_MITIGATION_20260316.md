# Wi-Fi Access Remediation

Date: 2026-03-16
Keyword: `KW_WIFI_MITIGATION_20260316`
Scope: low-risk server-side mitigation after initial audit

## Summary

This remediation was executed on 2026-03-16 after the initial audit in `WIFI_ACCESS_AUDIT_KW_WIFI_ACCESS_20260316.md`.

Goal:

- improve Wi-Fi access resilience without breaking the active BCL runtime
- reduce dependence on `bcl.nke.net` when local domain resolution fails on Wi-Fi clients

## What Was Applied

### Live now through Nginx static serving

- `BC-Learning-Main/check.html`
  - removed hardcoded dependency on `https://bcl.nke.net`
  - now probes multiple candidates in order, including:
    - current origin
    - current hostname
    - IPs from `/api/network-info`
    - legacy fallback `http://10.0.0.90`
    - legacy domain fallbacks
  - this gives Wi-Fi users a direct-IP recovery path even if local domain resolution is broken

- `BC-Learning-Main/index.html`
  - added a dynamic hint under the HTTPS certificate banner
  - the hint now shows a direct server IP link such as `http://10.0.0.90`
  - if the backend does not yet expose `preferredServerIP`, the page falls back to the first IP in `serverIPs`

### Code prepared but not yet active in backend runtime

- `backend/utils/networkIdentity.js`
  - new shared helper to prefer LAN-relevant IPv4 addresses and deprioritize virtual adapters

- `backend/server.js`
  - updated to use the shared preferred-IP helper

- `backend/routes/systemStatusRoutes.js`
  - updated to return:
    - `preferredServerIP`
    - `httpUrl`
    - `httpsUrl`
  - this should make direct-IP hints more accurate after the backend process is truly restarted

## Verification Results

Verified on 2026-03-16:

- `http://localhost/check.html` served updated content
- `http://localhost/` served updated `direct-ip-hint` logic
- `http://10.0.0.90/check.html` returned HTTP `200`
- `http://localhost/ping` returned OK
- `http://10.0.0.90/ping` returned OK
- `http://bcl.nke.net/ping` returned OK

## Admin-Level Mitigations Attempted But Blocked

The following host-level mitigations were attempted from the current shell session but failed because the session is not elevated as Windows Administrator:

- change `Ethernet` network category from `Public` to `Private`
- add explicit firewall rules via `netsh advfirewall`

Observed result:

- Windows returned elevation/permission errors

## Backend Restart Limitation

A full restart was requested through the internal restart API on 2026-03-16 08:26:08 +07:00.

Observed result:

- the request was accepted
- however, the active backend process on port `5052` did not actually rotate
- `/api/network-info` still returned the older payload format

Interpretation:

- static-file mitigations are live now
- backend IP-selection improvements are staged on disk, but will only become active after a real backend restart under the owning process context

## Practical Effect

The most important live mitigation is now in place:

- users who fail on `bcl.nke.net` over Wi-Fi have a clearer direct-IP path
- server detection page no longer depends on the local domain alone

This does not solve Wi-Fi isolation, guest SSID segmentation, or router ACL problems.
It does reduce false failures caused only by local DNS / hosts mapping issues.

## Next Recommended Step

To complete the host-side mitigation fully, run an elevated Administrator session on the server and then:

1. change the active network profile to `Private`
2. add or verify explicit firewall rules for `80`, `443`, and ICMP echo
3. perform a true backend restart from the owning runtime context
