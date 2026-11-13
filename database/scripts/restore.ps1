# =====================================================================
# MSMS Database Restore Script (Section 12.3)
# Restores a custom compressed backup (.dump) into a target database
# =====================================================================

param (
    [Parameter(Mandatory=$true)]
    [string]$DumpFile,
    [string]$DbHost = "127.0.0.1",
    [int]$DbPort = 5432,
    [string]$TargetDb = "mobile_service_management_restore",
    [string]$DbUser = "postgres"
)

Write-Host "===================================================="
Write-Host "  MSMS PostgreSQL Restore Utility"
Write-Host "  Source: $DumpFile"
Write-Host "  Target Database: $TargetDb on $DbHost`:$DbPort"
Write-Host "===================================================="

if (!(Test-Path $DumpFile)) {
    Write-Error "Backup file does not exist: $DumpFile"
    exit 1
}

try {
    $pgRestore = Get-Command "pg_restore" -ErrorAction SilentlyContinue
    if (-not $pgRestore) {
        $pgPaths = @(
            "C:\Program Files\PostgreSQL\18\bin\pg_restore.exe",
            "C:\Program Files\PostgreSQL\17\bin\pg_restore.exe",
            "C:\Program Files\PostgreSQL\16\bin\pg_restore.exe",
            "C:\Program Files\PostgreSQL\15\bin\pg_restore.exe",
            "C:\Program Files\PostgreSQL\14\bin\pg_restore.exe"
        )
        foreach ($p in $pgPaths) {
            if (Test-Path $p) {
                $pgRestore = $p
                break
            }
        }
    }

    if (-not $pgRestore) {
        Write-Error "pg_restore command not found. Please ensure PostgreSQL bin directory is in PATH."
        exit 1
    }

    Write-Host "Restoring database into $TargetDb..."
    & $pgRestore -h $DbHost -p $DbPort -U $DbUser -d $TargetDb $DumpFile

    if ($LASTEXITCODE -eq 0) {
        Write-Host "Database restoration completed successfully." -ForegroundColor Green
    } else {
        Write-Warning "pg_restore finished with exit code $LASTEXITCODE (check for non-critical warnings)."
    }
} catch {
    Write-Error "Restore error: $_"
}
