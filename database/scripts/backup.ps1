# =====================================================================
# MSMS Database Backup Script (Section 12.3)
# Creates a custom compressed backup (.dump) of mobile_service_management
# =====================================================================

param (
    [string]$DbHost = "127.0.0.1",
    [int]$DbPort = 5432,
    [string]$DbName = "mobile_service_management",
    [string]$DbUser = "postgres",
    [string]$BackupDir = "$PSScriptRoot\..\backups"
)

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
if (!(Test-Path -Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
}

$dumpFile = "$BackupDir\${DbName}_backup_$timestamp.dump"

Write-Host "===================================================="
Write-Host "  MSMS PostgreSQL Backup Utility"
Write-Host "  Target: $DbName on $DbHost`:$DbPort"
Write-Host "  Destination: $dumpFile"
Write-Host "===================================================="

try {
    # Check if pg_dump is available in path
    $pgDump = Get-Command "pg_dump" -ErrorAction SilentlyContinue
    if (-not $pgDump) {
        # Check standard postgres installation folders on Windows
        $pgPaths = @(
            "C:\Program Files\PostgreSQL\18\bin\pg_dump.exe",
            "C:\Program Files\PostgreSQL\17\bin\pg_dump.exe",
            "C:\Program Files\PostgreSQL\16\bin\pg_dump.exe",
            "C:\Program Files\PostgreSQL\15\bin\pg_dump.exe",
            "C:\Program Files\PostgreSQL\14\bin\pg_dump.exe"
        )
        foreach ($p in $pgPaths) {
            if (Test-Path $p) {
                $pgDump = $p
                break
            }
        }
    }

    if (-not $pgDump) {
        Write-Error "pg_dump command not found. Please ensure PostgreSQL bin directory is in PATH."
        exit 1
    }

    Write-Host "Running pg_dump..."
    & $pgDump -h $DbHost -p $DbPort -U $DbUser -F c -d $DbName -f $dumpFile

    if ($LASTEXITCODE -eq 0) {
        Write-Host "Backup completed successfully: $dumpFile" -ForegroundColor Green
    } else {
        Write-Error "Backup failed with exit code $LASTEXITCODE."
    }
} catch {
    Write-Error "Backup error: $_"
}
