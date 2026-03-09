const { Client } = require("pg");

const client = new Client({
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME || "bcl_database",
    user: process.env.DB_USER || "bcl_user",
    password: process.env.DB_PASSWORD || "secure_password_2025",
    connectionTimeoutMillis: Number(process.env.DB_CONNECT_TIMEOUT_MS || 5000)
});

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
