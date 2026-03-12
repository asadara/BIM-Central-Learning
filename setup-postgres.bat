@echo off
title BCL PostgreSQL Setup & Migration
color 0A

echo ================================================================
echo                BCL POSTGRESQL SETUP & MIGRATION
echo ================================================================
echo.

:: Check if Docker is installed
docker --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker is not installed or not running
    echo [INFO] Please install Docker from https://docker.com
    pause
    exit /b 1
)

:: Check if environment variables are set
if "%DB_PASSWORD%"=="" (
    echo [ERROR] DB_PASSWORD environment variable is not set
    echo [INFO] Please set DB_PASSWORD environment variable
    echo [INFO] Example: set DB_PASSWORD=your_secure_password
    pause
    exit /b 1
)

if "%PGADMIN_DEFAULT_PASSWORD%"=="" (
    echo [ERROR] PGADMIN_DEFAULT_PASSWORD environment variable is not set
    echo [INFO] Please set PGADMIN_DEFAULT_PASSWORD environment variable
    echo [INFO] Example: set PGADMIN_DEFAULT_PASSWORD=your_pgadmin_password
    pause
    exit /b 1
)

echo [INFO] Docker detected, proceeding with PostgreSQL setup...
echo.

:: Create .env file for Docker
echo [INFO] Creating .env file for Docker...
(
echo DB_PASSWORD=%DB_PASSWORD%
echo PGADMIN_DEFAULT_PASSWORD=%PGADMIN_DEFAULT_PASSWORD%
) > .env

echo [INFO] Starting PostgreSQL and pgAdmin...
docker-compose -f docker-compose.postgres.yml up -d

echo [INFO] Waiting for PostgreSQL to be ready...
timeout /t 30 /nobreak >nul

:: Test PostgreSQL connection
echo [INFO] Testing PostgreSQL connection...
docker exec bcl-postgres pg_isready -U bcl_user -d bcl_database
if errorlevel 1 (
    echo [ERROR] PostgreSQL is not ready yet
    echo [INFO] Please wait a few more minutes and try again
    pause
    exit /b 1
)

echo [SUCCESS] PostgreSQL is ready!
echo.
echo ================================================================
echo                     ACCESS INFORMATION
echo ================================================================
echo.
echo PostgreSQL Database:
echo   Host: localhost
echo   Port: 5432
echo   Database: bcl_database
echo   Username: bcl_user
echo   Password: [configured via DB_PASSWORD]
echo.
echo pgAdmin Web Interface:
echo   URL: http://localhost:5050
echo   Email: admin@bcl.local
echo   Password: [configured via PGADMIN_DEFAULT_PASSWORD]
echo.
echo ================================================================
echo.
echo [NEXT STEPS]
echo 1. Open pgAdmin at http://localhost:5050
echo 2. Login with the pgAdmin password you configured in PGADMIN_DEFAULT_PASSWORD
echo 3. Connect to server: localhost:5432
echo 4. Run migration script when ready
echo.
echo [MIGRATION COMMAND]
echo node import-json-to-postgres.js
echo.

pause
