@echo off
echo Stopping RLC Simulator Processes...
echo.
echo Killing processes on port 3999 (Static Server)...
for /f "tokens=5" %%a in ('netstat -aon ^| find ":3999" ^| find "LISTENING"') do taskkill /f /pid %%a
echo.
echo Killing processes on port 8888 (Netlify Dev)...
for /f "tokens=5" %%a in ('netstat -aon ^| find ":8888" ^| find "LISTENING"') do taskkill /f /pid %%a
echo.
echo Done. You can now run start-dev.bat again.
pause
