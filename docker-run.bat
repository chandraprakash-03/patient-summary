@echo off

echo Stopping existing container...
docker stop aravind-app-3002 2>nul
docker rm aravind-app-3002 2>nul

echo Building Docker image...
docker build -t aravind-visual-nextjs .

echo Starting container with environment variables...
docker run -d -p 3002:3000 --name aravind-app-3002 --env-file .env.qa aravind-visual-nextjs

echo Container started! Access your app at: http://localhost:3002
echo.
echo To view logs: docker logs aravind-app-3002
echo To stop: docker stop aravind-app-3002