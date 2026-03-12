const { Client } = require("pg");
const { createPgConfig } = require("../config/runtimeConfig");

const client = new Client(createPgConfig({
    host: process.env.DB_HOST || "127.0.0.1",
    connectionTimeoutMillis: Number(process.env.DB_CONNECT_TIMEOUT_MS || 5000)
}));

(async () => {
    try {
        await client.connect();
        await client.query("select 1");
        await client.end();
        process.exit(0);
    } catch (error) {
        try {
            await client.end();
        } catch (_) {
        }
        process.stderr.write(`${error.message}\n`);
        process.exit(1);
    }
})();
