@echo off
echo ========================================================
echo   RESETTING NETLIFY DEV ENVIRONMENT
echo ========================================================
echo.
echo 0. Killing stuck processes...
for /f "tokens=5" %%a in ('netstat -aon ^| find ":3999" ^| find "LISTENING"') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| find ":8888" ^| find "LISTENING"') do taskkill /f /pid %%a >nul 2>&1
echo.

echo 1. Clearing old configurations...
if exist ".netlify" (
    rmdir /s /q ".netlify"
    echo    Deleted .netlify folder.
) else (
    echo    .netlify folder not found (Clean).
)
echo.

echo 2. Linking to Site (Force ID)...
call netlify link --id 698ce7e1-eb36-7296-7bce-52c237653165
echo.

echo 3. Starting Server...
echo    If this works, use 'start-dev.bat' next time.
echo.
call netlify dev
pause
