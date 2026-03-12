const crypto = require("crypto");
const express = require("express");

function createActiveUserTracking() {
    const ACTIVE_USER_IDLE_MS = Number(process.env.ACTIVE_USER_IDLE_MS) || 5 * 60 * 1000;
    const ACTIVE_USER_MAX = Number(process.env.ACTIVE_USER_MAX) || 500;
    const ACTIVE_USER_CLIENT_COOKIE = "bcl_client_id";
    const ACTIVE_USER_CLIENT_COOKIE_MAX_AGE_MS = Number(process.env.ACTIVE_USER_CLIENT_COOKIE_MAX_AGE_MS) || 30 * 24 * 60 * 60 * 1000;
    const activeUserStore = new Map();

    function normalizeIp(rawValue) {
        if (!rawValue || typeof rawValue !== "string") return "unknown";
        let ip = rawValue.trim();
        if (ip.includes(",")) {
            ip = ip.split(",")[0].trim();
        }
        if (ip.startsWith("::ffff:")) {
            ip = ip.slice(7);
        }
        if (ip.startsWith("[") && ip.includes("]")) {
            ip = ip.slice(1, ip.indexOf("]"));
        }
        if (ip.includes(".") && ip.includes(":")) {
            ip = ip.split(":")[0];
        }
        return ip || "unknown";
    }

    function getRequestIp(req) {
        const forwarded = req.headers["x-forwarded-for"];
        const realIp = req.headers["x-real-ip"];
        const remoteIp = req.socket && req.socket.remoteAddress ? req.socket.remoteAddress : req.connection?.remoteAddress;
        return normalizeIp(forwarded || realIp || remoteIp || "unknown");
    }

    function isDocumentRequest(req) {
        const dest = String(req.headers["sec-fetch-dest"] || "").toLowerCase();
        if (dest === "document" || dest === "iframe" || dest === "frame") {
            return true;
        }
        const accept = String(req.headers.accept || "").toLowerCase();
        if (accept.includes("text/html")) {
            return true;
        }
        const url = (req.originalUrl || req.url || "").toLowerCase();
        return url.endsWith(".html");
    }

    function sanitizePath(rawUrl) {
        if (!rawUrl) return "-";
        const parts = String(rawUrl).split("?");
        return parts[0] || "-";
    }

    function isHousekeepingPath(rawPath) {
        const pathOnly = String(rawPath || "").toLowerCase();
        return pathOnly === "/api/user-activity/public" || pathOnly === "/api/network-info" || pathOnly === "/ping";
    }

    function parseCookies(rawCookieHeader) {
        const result = {};
        if (!rawCookieHeader || typeof rawCookieHeader !== "string") {
            return result;
        }

        const pairs = rawCookieHeader.split(";");
        for (const pair of pairs) {
            const [rawName, ...rawValueParts] = pair.split("=");
            const name = (rawName || "").trim();
            if (!name) continue;
            const value = rawValueParts.join("=").trim();
            result[name] = value;
        }

        return result;
    }

    function sanitizeClientId(rawValue) {
        if (!rawValue || typeof rawValue !== "string") return "";
        const value = rawValue.trim();
        if (!value) return "";
        if (value.length < 8 || value.length > 128) return "";
        if (!/^[a-zA-Z0-9_.-]+$/.test(value)) return "";
        return value;
    }

    function generateClientId() {
        if (typeof crypto.randomUUID === "function") {
            return crypto.randomUUID();
        }
        return crypto.randomBytes(16).toString("hex");
    }

    function setTrackingClientCookie(res, clientId) {
        if (!clientId) return;
        try {
            res.cookie(ACTIVE_USER_CLIENT_COOKIE, clientId, {
                maxAge: ACTIVE_USER_CLIENT_COOKIE_MAX_AGE_MS,
                httpOnly: false,
                sameSite: "lax",
                secure: false
            });
        } catch (error) {
            // Ignore cookie set errors to keep requests unaffected.
        }
    }

    function resolveTrackingClientIdentity(req, res) {
        const headerClientId = sanitizeClientId(req.headers["x-client-id"]);
        const cookies = parseCookies(req.headers.cookie);
        const cookieClientId = sanitizeClientId(cookies[ACTIVE_USER_CLIENT_COOKIE]);

        if (headerClientId) {
            if (cookieClientId !== headerClientId) {
                setTrackingClientCookie(res, headerClientId);
            }
            return {
                clientId: headerClientId,
                aliasClientId: cookieClientId && cookieClientId !== headerClientId ? cookieClientId : ""
            };
        }

        if (cookieClientId) {
            return { clientId: cookieClientId, aliasClientId: "" };
        }

        const generatedClientId = generateClientId();
        setTrackingClientCookie(res, generatedClientId);
        return { clientId: generatedClientId, aliasClientId: "" };
    }

    function isAutomatedUserAgent(userAgent) {
        const ua = String(userAgent || "").toLowerCase();
        if (!ua) return true;
        return /(curl|wget|postman|insomnia|powershell|python-requests|node-fetch|axios|go-http-client|java\/|libwww-perl|httpclient)/.test(ua);
    }

    function pruneActiveUsers(nowMs) {
        for (const [key, entry] of activeUserStore.entries()) {
            if (!entry || typeof entry.lastActivity !== "number") {
                activeUserStore.delete(key);
                continue;
            }
            if (nowMs - entry.lastActivity > ACTIVE_USER_IDLE_MS) {
                activeUserStore.delete(key);
            }
        }

        if (activeUserStore.size > ACTIVE_USER_MAX) {
            const entries = Array.from(activeUserStore.entries());
            entries.sort((a, b) => (a[1]?.lastActivity || 0) - (b[1]?.lastActivity || 0));
            const removeCount = entries.length - ACTIVE_USER_MAX;
            for (let i = 0; i < removeCount; i += 1) {
                activeUserStore.delete(entries[i][0]);
            }
        }
    }

    function trackUserActivity(req, res) {
        if (req.method === "OPTIONS") return;
        const rawUrl = req.originalUrl || req.url || "";
        if (!rawUrl) return;
        const pathOnly = sanitizePath(rawUrl);

        const nowMs = Date.now();
        pruneActiveUsers(nowMs);

        const ip = getRequestIp(req);
        const userAgent = String(req.headers["user-agent"] || "");
        const identity = resolveTrackingClientIdentity(req, res);
        const clientId = identity.clientId;
        const aliasClientId = identity.aliasClientId;
        const clientInfoHeader = req.headers["x-client-info"];
        const clientInfo = typeof clientInfoHeader === "string" && clientInfoHeader.trim().length > 0
            ? clientInfoHeader.trim()
            : userAgent;

        const key = clientId || `${ip}|${userAgent}`;
        let existing = activeUserStore.get(key);
        if (!existing && aliasClientId && activeUserStore.has(aliasClientId)) {
            existing = activeUserStore.get(aliasClientId);
            activeUserStore.delete(aliasClientId);
        }

        const nextEntry = existing ? { ...existing } : {
            clientId: clientId || "",
            ip,
            userAgent,
            clientInfo,
            currentPath: "-",
            firstSeen: nowMs
        };

        nextEntry.lastActivity = nowMs;
        if (isDocumentRequest(req)) {
            nextEntry.currentPath = pathOnly;
        } else if (!isHousekeepingPath(pathOnly) && (!nextEntry.currentPath || nextEntry.currentPath === "-")) {
            nextEntry.currentPath = pathOnly;
        }

        activeUserStore.set(key, nextEntry);
    }

    const middleware = (req, res, next) => {
        try {
            trackUserActivity(req, res);
        } catch (error) {
            // Ignore tracking errors to avoid affecting requests.
        }
        next();
    };

    const router = express.Router();
    router.get("/api/user-activity/public", (req, res) => {
        const nowMs = Date.now();
        pruneActiveUsers(nowMs);

        const rawActiveUsers = Array.from(activeUserStore.values())
            .filter((entry) => entry && typeof entry.lastActivity === "number" && nowMs - entry.lastActivity <= ACTIVE_USER_IDLE_MS)
            .filter((entry) => !isAutomatedUserAgent(entry.userAgent))
            .map((entry) => ({
                clientId: entry.clientId || "",
                ip: entry.ip || "unknown",
                userAgent: entry.userAgent || "",
                clientInfo: entry.clientInfo || entry.userAgent || "",
                currentPath: entry.currentPath || "-",
                firstSeen: entry.firstSeen || entry.lastActivity,
                lastActivity: entry.lastActivity,
                lastActivityAgoMs: Math.max(0, nowMs - entry.lastActivity)
            }));

        const dedupedByFingerprint = new Map();
        for (const entry of rawActiveUsers) {
            const fingerprint = `${entry.ip}|${entry.userAgent}`;
            const existing = dedupedByFingerprint.get(fingerprint);
            if (!existing) {
                dedupedByFingerprint.set(fingerprint, entry);
                continue;
            }

            const existingIsHousekeeping = isHousekeepingPath(existing.currentPath);
            const nextIsHousekeeping = isHousekeepingPath(entry.currentPath);
            if (existingIsHousekeeping !== nextIsHousekeeping) {
                if (existingIsHousekeeping && !nextIsHousekeeping) {
                    dedupedByFingerprint.set(fingerprint, entry);
                }
                continue;
            }

            const existingHasPath = !!existing.currentPath && existing.currentPath !== "-";
            const nextHasPath = !!entry.currentPath && entry.currentPath !== "-";
            if (existingHasPath !== nextHasPath) {
                if (nextHasPath) {
                    dedupedByFingerprint.set(fingerprint, entry);
                }
                continue;
            }

            if ((entry.lastActivity || 0) > (existing.lastActivity || 0)) {
                dedupedByFingerprint.set(fingerprint, entry);
            }
        }

        const activeUsers = Array.from(dedupedByFingerprint.values())
            .sort((a, b) => (b.lastActivity || 0) - (a.lastActivity || 0));

        res.json({
            totalActiveUsers: activeUsers.length,
            activeUsers,
            windowMs: ACTIVE_USER_IDLE_MS,
            generatedAt: new Date(nowMs).toISOString()
        });
    });

    return {
        middleware,
        router
    };
}

module.exports = createActiveUserTracking;
