# SGT Connect - USB Launch Script
$ErrorActionPreference = "SilentlyContinue"
Write-Host "=== SGT Connect USB Launcher ===" -ForegroundColor Cyan
$lanIp = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.*" -and $_.InterfaceAlias -notlike "*VMware*" -and $_.InterfaceAlias -notlike "*vEthernet*" } | Select-Object -First 1).IPAddress
if (-not $lanIp) { $lanIp = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.*" } | Select-Object -First 1).IPAddress }
Write-Host "Detected LAN IP : $lanIp" -ForegroundColor Green
$useAdb = $false
$adbCmd = Get-Command adb -ErrorAction SilentlyContinue
if ($adbCmd) {
    $connected = (adb devices 2>&1) | Where-Object { $_ -match "device$" -and $_ -notmatch "^List" }
    if ($connected) {
        $useAdb = $true
        adb reverse tcp:8081 tcp:8081 | Out-Null
        adb reverse tcp:5001 tcp:5001 | Out-Null
        Write-Host "ADB reverse OK (Metro 8081, Backend 5001)" -ForegroundColor Green
    } else { Write-Host "No USB device - enable USB Debugging" -ForegroundColor Yellow }
} else { Write-Host "adb not found - WiFi mode" -ForegroundColor Gray }
if ($useAdb) { $apiUrl = "http://localhost:5001/api/v1"; $socketUrl = "http://localhost:5001"; Write-Host "Mode: USB (localhost)" -ForegroundColor Green }
else { $apiUrl = "http://${lanIp}:5001/api/v1"; $socketUrl = "http://${lanIp}:5001"; Write-Host "Mode: WiFi $apiUrl" -ForegroundColor Yellow }
$env_file = Join-Path $PSScriptRoot ".env"
"EXPO_PUBLIC_API_URL=$apiUrl" | Set-Content $env_file
"EXPO_PUBLIC_SOCKET_URL=$socketUrl" | Add-Content $env_file
Write-Host ".env written" -ForegroundColor Green
Set-Location $PSScriptRoot
if ($useAdb) {
    Write-Host "Starting Expo with --host localhost (USB/ADB mode)" -ForegroundColor Cyan
    npx expo start --port 8081 --host localhost
} else {
    Write-Host "Starting Expo with LAN IP (WiFi mode)" -ForegroundColor Cyan
    npx expo start --port 8081
}
