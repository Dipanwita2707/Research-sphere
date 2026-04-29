if (-NOT ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]"Administrator")) {
    Start-Process powershell -ArgumentList "-ExecutionPolicy Bypass -File `"$PSCommandPath`"" -Verb RunAs
    exit
}

netsh advfirewall firewall add rule name="SGT Backend LAN 5001" protocol=TCP dir=in localport=5001 action=allow

Write-Host "Done! Port 5001 is now open for LAN connections." -ForegroundColor Green
pause
