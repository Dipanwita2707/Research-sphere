@echo off
echo Starting ngrok tunnel for HTTPS access...
echo.
echo After ngrok starts, look for the HTTPS URL like:
echo   https://xxxxx.ngrok-free.app
echo.
echo Use that URL on your phone to access the app with camera support!
echo.
ngrok http 3000
pause
