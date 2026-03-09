# BCL Native PostgreSQL Migration

## Goal

Move BCL from Docker Desktop PostgreSQL to a native Windows PostgreSQL service so BCL can recover at boot without requiring a user logon session.

## Backups

Before cutover, create a Docker PostgreSQL backup:

```bat
cd C:\BCL
powershell -NoProfile -ExecutionPolicy Bypass -File .\backup-bcl-postgres-docker.ps1
```

Backup artifacts are stored under:

```text
C:\BCL\migrations\postgres-native\<timestamp>\
```

Files included:

- `bcl_database.dump`
- `globals.sql`
- `root.env.snapshot`
- `backend.env.snapshot`

## One-shot install

Run as Administrator:

```bat
cd C:\BCL
install-native-postgres-service.bat
```

What it does:

1. Backs up the Docker PostgreSQL database.
2. Stops the Docker PostgreSQL stack to free port `5432`.
3. Installs PostgreSQL 15 as a Windows service.
4. Restores the BCL role and database into the native service.
5. Reinstalls BCL autostart and watchdog tasks for native mode.

## After native PostgreSQL is installed

Expected runtime model after cutover:

- PostgreSQL runs as a Windows service.
- `BCL Auto Start (Startup Hidden)` becomes the primary boot path.
- `BCL Watchdog (5m)` can safely run as `SYSTEM`.
- Logon fallback remains as a safety net, not the primary recovery path.

## Rollback

If native PostgreSQL installation fails and you need to go back quickly:

```bat
cd C:\BCL
docker compose -f docker-compose.postgres.yml up -d
start-bcl-http.bat --hidden --auto
```

## Notes

- `pgAdmin` is not required for BCL runtime.
- Docker Desktop can remain installed for development or legacy rollback, but BCL startup should no longer depend on it after cutover.
