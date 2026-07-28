@echo off

REM Build the Docker image
echo Building Docker image...
docker build -t aravind-visual-nextjs .

if %ERRORLEVEL% NEQ 0 (
    echo Build failed!
    pause
    exit /b 1
)

echo Build completed successfully!
echo.
echo To run the application, use:
echo   docker-compose up
echo.
echo Or to run directly:
echo   docker run -p 3002:3000 --name aravind-app aravind-visual-nextjs
echo.
pause