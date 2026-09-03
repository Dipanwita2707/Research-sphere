Write-Host "========================================" -ForegroundColor Blue
Write-Host "Bug Report System - Endpoint Testing" -ForegroundColor Blue
Write-Host "========================================" -ForegroundColor Blue
Write-Host ""

Write-Host "Checking if backend server is running..." -ForegroundColor Yellow

try {
    $response = Invoke-WebRequest -Uri "http://localhost:5001/health" -Method GET -TimeoutSec 5 -ErrorAction Stop
    if ($response.StatusCode -eq 200) {
        Write-Host "✓ Backend server is running" -ForegroundColor Green
        Write-Host ""
        Write-Host "Running endpoint tests..." -ForegroundColor Yellow
        node scripts/test-bug-report-endpoints-with-auth.js
    }
} catch {
    Write-Host "✗ Backend server is not running" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please start the backend server first using one of these methods:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Method 1 - Direct Node.js:" -ForegroundColor Cyan
    Write-Host "  cd backend" -ForegroundColor White
    Write-Host "  npm run dev" -ForegroundColor White
    Write-Host ""
    Write-Host "Method 2 - Docker Development:" -ForegroundColor Cyan
    Write-Host "  docker-compose -f docker-compose.dev.yml up backend-dev" -ForegroundColor White
    Write-Host ""
    Write-Host "Method 3 - Docker Production:" -ForegroundColor Cyan
    Write-Host "  docker-compose up backend" -ForegroundColor White
    Write-Host ""
    Write-Host "Then run this script again." -ForegroundColor Yellow
    Read-Host "Press Enter to continue"
}