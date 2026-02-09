# =====================================================
# EVENT MANAGEMENT MODULE - QUICK SETUP SCRIPT (PowerShell)
# =====================================================
# This script helps you set up the Event Management module
# Run this from the backend directory in PowerShell
# Usage: .\prisma\setup-event-management.ps1
# =====================================================

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   Event Management Module - Database Setup            ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Check if we're in the backend directory
if (-not (Test-Path "prisma\schema.prisma")) {
    Write-Host "❌ Error: Please run this script from the backend directory" -ForegroundColor Red
    Write-Host "   cd backend" -ForegroundColor Yellow
    Write-Host "   .\prisma\setup-event-management.ps1" -ForegroundColor Yellow
    exit 1
}

# Check if .env file exists
if (-not (Test-Path ".env")) {
    Write-Host "❌ Error: .env file not found" -ForegroundColor Red
    Write-Host "   Please create .env with DATABASE_URL" -ForegroundColor Yellow
    exit 1
}

# Load DATABASE_URL from .env
$envContent = Get-Content ".env" | Where-Object { $_ -notmatch '^\s*#' -and $_ -match '\S' }
$DATABASE_URL = $null

foreach ($line in $envContent) {
    if ($line -match '^DATABASE_URL\s*=\s*(.+)$') {
        $DATABASE_URL = $matches[1].Trim().Trim('"').Trim("'")
        break
    }
}

if (-not $DATABASE_URL) {
    Write-Host "❌ Error: DATABASE_URL not found in .env" -ForegroundColor Red
    exit 1
}

Write-Host "✓ Environment configured" -ForegroundColor Green
Write-Host ""

# Parse DATABASE_URL
# Format: postgresql://user:password@host:port/database
if ($DATABASE_URL -match 'postgresql://([^:]+):([^@]+)@([^:]+):(\d+)/(.+)') {
    $DB_USER = $matches[1]
    $DB_PASS = $matches[2]
    $DB_HOST = $matches[3]
    $DB_PORT = $matches[4]
    $DB_NAME = $matches[5]
} else {
    Write-Host "❌ Error: Invalid DATABASE_URL format" -ForegroundColor Red
    Write-Host "   Expected: postgresql://user:password@host:port/database" -ForegroundColor Yellow
    exit 1
}

Write-Host "Database Information:" -ForegroundColor Cyan
Write-Host "  Host: $DB_HOST`:$DB_PORT"
Write-Host "  Database: $DB_NAME"
Write-Host "  User: $DB_USER"
Write-Host ""

# Ask for confirmation
$confirmation = Read-Host "Do you want to proceed with migration? (y/n)"
if ($confirmation -notmatch '^[Yy]') {
    Write-Host "Migration cancelled" -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "Step 1: Executing database migration..." -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray

# Set PGPASSWORD environment variable for psql
$env:PGPASSWORD = $DB_PASS

try {
    # Check if psql is available
    $psqlPath = Get-Command psql -ErrorAction SilentlyContinue
    
    if (-not $psqlPath) {
        Write-Host "⚠️  psql not found in PATH" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Manual execution required:" -ForegroundColor Yellow
        Write-Host "1. Open pgAdmin, DBeaver, or TablePlus" -ForegroundColor White
        Write-Host "2. Connect to your database" -ForegroundColor White
        Write-Host "3. Execute the SQL file:" -ForegroundColor White
        Write-Host "   prisma\manual-migrations\event-management-module.sql" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "After executing manually, press Enter to continue..." -ForegroundColor Yellow
        Read-Host
    } else {
        # Execute migration
        $sqlFile = "prisma\manual-migrations\event-management-module.sql"
        psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f $sqlFile
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Migration executed successfully" -ForegroundColor Green
        } else {
            throw "Migration failed with exit code $LASTEXITCODE"
        }
    }
} catch {
    Write-Host "❌ Migration failed: $_" -ForegroundColor Red
    exit 1
} finally {
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "Step 2: Regenerating Prisma Client..." -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray

try {
    npx prisma generate
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Prisma Client regenerated" -ForegroundColor Green
    } else {
        throw "Prisma generation failed"
    }
} catch {
    Write-Host "❌ Prisma generation failed: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Step 3: Verifying setup..." -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray

# Set PGPASSWORD again for verification
$env:PGPASSWORD = $DB_PASS

try {
    # Check if tables exist (if psql available)
    if ($psqlPath) {
        $tableQuery = "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('Event', 'EventRegistration', 'EventVolunteer', 'EventEntry');"
        $tableCount = psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c $tableQuery
        $tableCount = $tableCount.Trim()
        
        if ($tableCount -eq 4) {
            Write-Host "✅ All 4 tables created successfully" -ForegroundColor Green
        } else {
            Write-Host "⚠️  Table verification: found $tableCount/4 tables" -ForegroundColor Yellow
        }
        
        # Check if enums exist
        $enumQuery = "SELECT COUNT(*) FROM pg_type WHERE typname IN ('EventType', 'EventPaymentType', 'EventStatus', 'RegistrationStatus', 'PaymentStatus', 'EntryType');"
        $enumCount = psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c $enumQuery
        $enumCount = $enumCount.Trim()
        
        if ($enumCount -eq 6) {
            Write-Host "✅ All 6 enums created successfully" -ForegroundColor Green
        } else {
            Write-Host "⚠️  Enum verification: found $enumCount/6 enums" -ForegroundColor Yellow
        }
    } else {
        Write-Host "⚠️  Automatic verification skipped (psql not available)" -ForegroundColor Yellow
        Write-Host "   Verify manually using pgAdmin or similar tool" -ForegroundColor Gray
    }
} catch {
    Write-Host "⚠️  Verification failed: $_" -ForegroundColor Yellow
    Write-Host "   Tables may still be created successfully" -ForegroundColor Gray
} finally {
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║   ✅ Event Management Module Setup Complete!          ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "Database Tables Created:" -ForegroundColor Cyan
Write-Host "  • Event" -ForegroundColor White
Write-Host "  • EventRegistration" -ForegroundColor White
Write-Host "  • EventVolunteer" -ForegroundColor White
Write-Host "  • EventEntry" -ForegroundColor White
Write-Host ""
Write-Host "Enums Created:" -ForegroundColor Cyan
Write-Host "  • EventType, EventPaymentType, EventStatus" -ForegroundColor White
Write-Host "  • RegistrationStatus, PaymentStatus, EntryType" -ForegroundColor White
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "  1. Start backend:  " -NoNewline; Write-Host "npm run dev" -ForegroundColor Yellow
Write-Host "  2. Test endpoint:  " -NoNewline; Write-Host "curl http://localhost:5000/api/v1/events" -ForegroundColor Yellow
Write-Host "  3. View database:  " -NoNewline; Write-Host "npx prisma studio" -ForegroundColor Yellow
Write-Host ""
Write-Host "Documentation:" -ForegroundColor Cyan
Write-Host "  • Quick Start: " -NoNewline; Write-Host "prisma\manual-migrations\README.md" -ForegroundColor White
Write-Host "  • Full Guide:  " -NoNewline; Write-Host "prisma\migrations\EVENT_MANAGEMENT_MIGRATION_GUIDE.md" -ForegroundColor White
Write-Host "  • SQL Queries: " -NoNewline; Write-Host "prisma\manual-migrations\quick-reference-queries.sql" -ForegroundColor White
Write-Host ""
Write-Host "Happy coding! 🚀" -ForegroundColor Magenta
Write-Host ""
