# Wi-Fi Access Audit

Date: 2026-03-16
Keyword: `KW_WIFI_ACCESS_20260316`
Scope: initial inspection only, before any fix

## Status

- Inspection completed on 2026-03-16 08:18:08 +07:00
- No runtime configuration was changed
- This document is a pre-fix report for the issue:
  - BCL can be accessed via LAN
  - BCL cannot be accessed via Wi-Fi

## Executive Summary

Current evidence does not point to a BCL app binding failure.

The active server runtime is healthy:

- backend responds on `127.0.0.1:5052`
- Nginx responds on `localhost`, `10.0.0.90`, and `bcl.nke.net`
- inbound firewall rules for BCL are enabled for `Any` profile

The strongest current hypothesis is that the Wi-Fi clients fail before reaching the app layer, most likely because of one of these:

1. `bcl.nke.net` is not resolving to `10.0.0.90` on Wi-Fi clients
2. Wi-Fi is on a different segment / VLAN / guest isolation path from the wired LAN
3. East-west traffic from Wi-Fi to the server IP is blocked by network infrastructure

## Runtime Facts Verified

### Server network state

- Active server IPv4: `10.0.0.90/23`
- Active interface: `Ethernet`
- No active Wi-Fi adapter was present on the server during inspection
- Current network profile for `Ethernet`: `Public`

Interpretation:

- The server itself is not serving from a Wi-Fi NIC
- Clients must reach the server over the wired server IP `10.0.0.90`

### App and proxy reachability

The following checks succeeded on 2026-03-16:

- `http://127.0.0.1:5052/ping` -> `{"status":"OK",...}`
- `http://localhost/ping` -> HTTP `200`
- `http://10.0.0.90/ping` -> HTTP `200`
- `http://bcl.nke.net/ping` -> HTTP `200`

Interpretation:

- BCL is listening and reachable through the expected local and LAN-facing paths
- There is no direct evidence of an app crash, wrong bind address, or broken reverse proxy

### Listener state

Port `80` is in `LISTENING` state on `0.0.0.0` and owned by `nginx`.

Observed nginx processes on port `80`:

- PID `13988`
- PID `16100`
- PID `52052`

Interpretation:

- Multiple nginx workers are expected because `worker_processes auto;` is configured
- This is not currently evidence of the Wi-Fi-only failure

### Firewall state

Verified enabled inbound rules:

- `BCL HTTP Port 80` -> `Profile: Any`
- `BCL Backend Port 5051` -> `Profile: Any`
- `BCL Nginx HTTP` -> `Profile: Any`
- `BCL HTTPS Inbound` -> `Profile: Any`
- `BCL Backend Port 5052` -> `Profile: Any`

Interpretation:

- Windows Firewall already has BCL allow-rules across all profiles
- The `Public` network profile is not ideal, but it is not the strongest blocker based on current rules

## Name Resolution Findings

Server-side `hosts` file contains:

- `10.0.0.90 bcl.nke.net`

Server-side DNS resolution check returned:

- `bcl.nke.net` -> `10.0.0.90`

Important limitation:

- This only proves name resolution on the server
- It does not prove that Wi-Fi clients resolve `bcl.nke.net` the same way

## Log Clues

Nginx access log shows normal successful responses on 2026-03-16, including:

- requests from `10.0.0.90` to `/ping`
- prior successful traffic from another LAN IP `10.0.0.225`

Interpretation:

- The app stack has been serving LAN-origin traffic successfully
- The logs do not yet show a server-side failure pattern specific to Wi-Fi clients

## Likely Root Cause Ranking

### Most likely

- Wi-Fi clients do not resolve `bcl.nke.net` to `10.0.0.90`
- Wi-Fi SSID is isolated from the wired subnet
- Wi-Fi clients are on a guest network or restricted VLAN

### Possible but lower confidence

- Client-side firewall / browser policy / proxy on Wi-Fi devices
- Router ACL blocking HTTP/HTTPS from Wi-Fi to wired hosts

### Unlikely based on current evidence

- BCL backend bind issue
- Nginx reverse proxy failure
- Missing Windows Firewall allow-rule for BCL ports

## Recommended Next Checks Before Fix

Run these from a Wi-Fi client that is failing:

1. `ping 10.0.0.90`
2. `Test-NetConnection 10.0.0.90 -Port 80`
3. `nslookup bcl.nke.net`
4. open `http://10.0.0.90/ping`
5. open `http://bcl.nke.net/ping`

How to interpret:

- If `http://10.0.0.90/ping` works but `http://bcl.nke.net/ping` fails:
  - root cause is name resolution on Wi-Fi
- If both fail and ping/port test also fail:
  - root cause is Wi-Fi to LAN routing / isolation
- If ping works but port `80` fails:
  - root cause is traffic filtering between Wi-Fi and server

## Pre-Fix Conclusion

Per inspection on 2026-03-16, BCL itself is up and reachable on the server's wired IP `10.0.0.90`.

This issue currently looks more like a Wi-Fi path access problem than an application runtime problem.

No repair has been applied yet.
