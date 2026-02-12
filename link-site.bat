@echo off
echo ========================================================
echo   FORCE LINKING TO NETLIFY
echo ========================================================
echo.
echo Please follow the instructions below:
echo 1. If it asks "How would you like to link", choose "Search by full or short site name"
echo 2. Type: rlc-simulator
echo 3. Select the site.
echo.
echo Running 'netlify link'...
echo.
call netlify link
echo.
echo ========================================================
echo   Linking Complete (hopefully).
echo   Now try running 'start-dev.bat' again.
echo ========================================================
pause
