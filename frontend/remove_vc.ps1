$f = 'src\features\dsw\components\ClubCreationForm.tsx'
(Get-Content $f -Encoding UTF8) | Where-Object { $_ -notmatch 'viceChairpersonId: string' } | Set-Content $f -Encoding UTF8
Write-Host "Done"
