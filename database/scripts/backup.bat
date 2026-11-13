@echo off
REM MSMS Windows Batch Backup Utility (Section 12.3)
setlocal

set DB_HOST=127.0.0.1
set DB_PORT=5432
set DB_NAME=mobile_service_management
set DB_USER=postgres
set BACKUP_DIR=%~dp0..\backups

if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set dt=%%I
set TIMESTAMP=%dt:~0,8%_%dt:~8,6%
set DUMP_FILE=%BACKUP_DIR%\%DB_NAME%_backup_%TIMESTAMP%.dump

echo ====================================================
echo   MSMS PostgreSQL Database Backup
echo   Target: %DB_NAME%
echo   Output: %DUMP_FILE%
echo ====================================================

pg_dump -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -F c -d %DB_NAME% -f "%DUMP_FILE%"

if %ERRORLEVEL% equ 0 (
    echo Backup completed successfully! File: %DUMP_FILE%
) else (
    echo Backup failed with error code %ERRORLEVEL%.
)

endlocal
