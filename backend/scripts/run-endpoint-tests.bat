@echo off
echo ========================================
echo Bug Report System - Endpoint Testing
echo ========================================
echo.

echo Checking if backend server is running...
curl -s http://localhost:5001/health >nul 2>&1
if %errorlevel% equ 0 (
    echo ✓ Backend server is running
    echo.
    echo Running endpoint tests...
    node scripts/test-bug-report-endpoints-with-auth.js
) else (
    echo ✗ Backend server is not running
    echo.
    echo Please start the backend server first using one of these methods:
    echo.
    echo Method 1 - Direct Node.js:
    echo   cd backend
    echo   npm run dev
    echo.
    echo Method 2 - Docker Development:
    echo   docker-compose -f docker-compose.dev.yml up backend-dev
    echo.
    echo Method 3 - Docker Production:
    echo   docker-compose up backend
    echo.
    echo Then run this script again.
    pause
)