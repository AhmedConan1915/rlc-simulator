@echo off
echo ==========================================
echo   RLC Simulator - Netlify Dev Setup
echo ==========================================
echo.

echo 1. Checking for Netlify CLI...
call npm list -g netlify-cli >nul 2>&1
if %errorlevel% neq 0 (
    echo    Netlify CLI not found. Installing...
    call npm install -g netlify-cli
    echo    Netlify CLI installed!
) else (
    echo    Netlify CLI is already installed.
)
echo.

echo 2. Checking configuration...
if not exist ".env" (
    if exist ".env.example" (
        echo    Creating .env from template...
        copy .env.example .env
        echo    WARNING: .env created! Please edit it to add your MongoDB URI.
        notepad .env
    ) else (
        echo    ERROR: .env.example not found! Cannot configure database.
    )
) else (
    echo    Configuration file (.env) found.
)
echo.

echo 3. Installing dependencies...
if not exist "node_modules" (
    echo    Installing project dependencies (mongodb)...
    call npm install
) else (
    echo    Dependencies already installed.
)
echo.

echo 4. Logging into Netlify...
call netlify login
echo.

echo 5. Linking to Site (Non-Interactive)...
call netlify link --id 698ce7e1-eb36-7296-7bce-52c237653165
echo.

echo ==========================================
echo   Setup Complete!
echo   Run 'start-dev.bat' to start the simulation.
echo ==========================================
pause
