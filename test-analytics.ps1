# PowerShell Test Script for Gate Entry Analytics
# Run with: powershell -ExecutionPolicy Bypass -File test-analytics.ps1

Write-Host "`n🧪 Testing Gate Entry Analytics Endpoint...`n" -ForegroundColor Cyan

$API_URL = "http://localhost:5001/api/v1"
$LOGIN_ENDPOINT = "$API_URL/auth/login"
$ANALYTICS_ENDPOINT = "$API_URL/gate-entry/analytics"

try {
    # Step 1: Login
    Write-Host "Step 1: Logging in..." -ForegroundColor Yellow
    
    $loginBody = @{
        username = "admin"
        password = "admin123"
    } | ConvertTo-Json
    
    $loginResponse = Invoke-RestMethod -Uri $LOGIN_ENDPOINT -Method Post `
        -Body $loginBody -ContentType "application/json" -TimeoutSec 10
    
    if ($loginResponse.success -ne $true) {
        Write-Host "❌ Login failed: $($loginResponse.message)" -ForegroundColor Red
        exit 1
    }
    
    $token = $loginResponse.data.token
    Write-Host "✅ Login successful" -ForegroundColor Green
    Write-Host "   User: $($loginResponse.data.user.uid)" -ForegroundColor White
    Write-Host "   Role: $($loginResponse.data.user.role)" -ForegroundColor White
    
    # Step 2: Call Analytics Endpoint
    Write-Host "`nStep 2: Fetching analytics data..." -ForegroundColor Yellow
    
    $headers = @{
        "Authorization" = "Bearer $token"
        "Content-Type" = "application/json"
    }
    
    $analyticsResponse = Invoke-RestMethod -Uri $ANALYTICS_ENDPOINT -Method Get `
        -Headers $headers -TimeoutSec 15
    
    if ($analyticsResponse.success) {
        Write-Host "✅ Analytics endpoint working!" -ForegroundColor Green
        
        Write-Host "`n📊 Analytics Data Structure:" -ForegroundColor Cyan
        $data = $analyticsResponse.data
        
        Write-Host "`n  Overview Stats:" -ForegroundColor White
        Write-Host "    - Total passes: $($data.overview.total)" -ForegroundColor White
        Write-Host "    - Active today: $($data.overview.activeToday)" -ForegroundColor White
        Write-Host "    - Checked in now: $($data.overview.checkedInNow)" -ForegroundColor White
        Write-Host "    - Completed today: $($data.overview.completedToday)" -ForegroundColor White
        Write-Host "    - Pending: $($data.overview.pending)" -ForegroundColor White
        Write-Host "    - Expired: $($data.overview.expired)" -ForegroundColor White
        Write-Host "    - Cancelled: $($data.overview.cancelled)" -ForegroundColor White
        
        Write-Host "`n  Data Sections Available:" -ForegroundColor White
        Write-Host "    - Purpose breakdown: $(if ($data.byPurpose) { '✓' } else { '✗' })" -ForegroundColor $(if ($data.byPurpose) { 'Green' } else { 'Red' })
        Write-Host "    - Status breakdown: $(if ($data.byStatus) { '✓' } else { '✗' })" -ForegroundColor $(if ($data.byStatus) { 'Green' } else { 'Red' })
        Write-Host "    - Vehicle stats: $(if ($data.vehicleStats) { '✓' } else { '✗' })" -ForegroundColor $(if ($data.vehicleStats) { 'Green' } else { 'Red' })
        Write-Host "    - Hostel bookings: $(if ($data.hostelBookings) { '✓' } else { '✗' })" -ForegroundColor $(if ($data.hostelBookings) { 'Green' } else { 'Red' })
        Write-Host "    - Extensions: $(if ($data.extensions) { '✓' } else { '✗' })" -ForegroundColor $(if ($data.extensions) { 'Green' } else { 'Red' })
        Write-Host "    - Guard performance: $(if ($data.guardPerformance) { '✓' } else { '✗' })" -ForegroundColor $(if ($data.guardPerformance) { 'Green' } else { 'Red' })
        Write-Host "    - Daily trend: $(if ($data.dailyTrend) { '✓' } else { '✗' })" -ForegroundColor $(if ($data.dailyTrend) { 'Green' } else { 'Red' })
        Write-Host "    - Recent activity: $(if ($data.recentActivity) { '✓' } else { '✗' })" -ForegroundColor $(if ($data.recentActivity) { 'Green' } else { 'Red' })
        Write-Host "    - Top creators: $(if ($data.topCreators) { '✓' } else { '✗' })" -ForegroundColor $(if ($data.topCreators) { 'Green' } else { 'Red' })
        
        Write-Host "`n✅ All tests passed!" -ForegroundColor Green
        Write-Host "🎯 Analytics endpoint is fully functional" -ForegroundColor Cyan
        Write-Host " `nYou can now access: http://localhost:3000/admin/gate-entry/analytics`n" -ForegroundColor Yellow
        
    } else {
        Write-Host "❌ Analytics request failed: $($analyticsResponse.message)" -ForegroundColor Red
        exit 1
    }
    
} catch {
    Write-Host "`n❌ Test failed:" -ForegroundColor Red
    
    $errorDetails = $_.Exception.Message
    
    if ($errorDetails -match "timeout") {
        Write-Host "   Error: Request timeout" -ForegroundColor Red
        Write-Host "   Backend query might be taking too long" -ForegroundColor Yellow
    } elseif ($errorDetails -match "ConnectFailure" -or $errorDetails -match "refused") {
        Write-Host "   Error: Cannot connect to backend" -ForegroundColor Red
        Write-Host "   Make sure backend is running on port 5001" -ForegroundColor Yellow
    } elseif ($_.Exception.Response) {
        $statusCode = $_.Exception.Response.StatusCode.value__
        Write-Host "   HTTP Status: $statusCode" -ForegroundColor Red
        
        if ($statusCode -eq 500) {
            Write-Host "   💡 Check backend terminal logs for detailed error" -ForegroundColor Yellow
        }
    } else {
        Write-Host "   Error: $errorDetails" -ForegroundColor Red
    }
    
    Write-Host ""
    exit 1
}
