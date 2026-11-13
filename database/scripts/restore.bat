@echo off
REM MSMS Windows Batch Restore Utility (Section 12.3)
setlocal

if "%~1"=="" (
    echo Usage: restore.bat ^<path_to_backup_file.dump^> [target_database_name]
    echo Example: restore.bat ..\backups\mobile_service_management_backup_20261112.dump mobile_service_management_restore
    exit /b 1
)

set DUMP_FILE=%~1
set DB_HOST=127.0.0.1
set DB_PORT=5432
set DB_USER=postgres
set TARGET_DB=mobile_service_management_restore

if not "%~2"=="" set TARGET_DB=%~2

echo ====================================================
echo   MSMS PostgreSQL Database Restore
echo   Source: %DUMP_FILE%
echo   Target: %TARGET_DB%
echo ====================================================

pg_restore -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %TARGET_DB% "%DUMP_FILE%"

if %ERRORLEVEL% equ 0 (
    echo Restore completed successfully!
) else (
    echo Restore finished with exit code %ERRORLEVEL%.
)

endlocal
