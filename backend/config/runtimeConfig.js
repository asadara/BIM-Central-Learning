const path = require("path");

require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });

function getOptionalEnv(...names) {
    for (const name of names) {
        const value = process.env[name];
        if (typeof value === "string" && value.trim() !== "") {
            return value.trim();
        }
    }
    return "";
}

function getRequiredEnv(name) {
    const value = getOptionalEnv(name);
    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
}

function getNumberEnv(name, fallback) {
    const rawValue = getOptionalEnv(name);
    if (!rawValue) {
        return fallback;
    }

    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed)) {
        throw new Error(`Invalid numeric environment variable: ${name}`);
    }

    return parsed;
}

function createPgConfig(overrides = {}) {
    return {
        host: getOptionalEnv("DB_HOST") || "localhost",
        port: getNumberEnv("DB_PORT", 5432),
        database: getOptionalEnv("DB_NAME") || "bcl_database",
        user: getOptionalEnv("DB_USER") || "bcl_user",
        password: getRequiredEnv("DB_PASSWORD"),
        ...overrides
    };
}

function getJwtSecret() {
    return getRequiredEnv("JWT_SECRET");
}

function getSessionSecret() {
    return getRequiredEnv("SESSION_SECRET");
}

function getLegacyAdminToken() {
    return getOptionalEnv("ADMIN_TOKEN");
}

function getLegacyAdminBearerSecret() {
    return getOptionalEnv("ADMIN_BEARER_SECRET");
}

function getDefaultAdminPassword() {
    return getOptionalEnv("DEFAULT_ADMIN_PASSWORD");
}

function getGoogleClientId() {
    return getOptionalEnv("GOOGLE_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_ID");
}

module.exports = {
    createPgConfig,
    getDefaultAdminPassword,
    getGoogleClientId,
    getJwtSecret,
    getLegacyAdminBearerSecret,
    getLegacyAdminToken,
    getOptionalEnv,
    getRequiredEnv,
    getSessionSecret
};
