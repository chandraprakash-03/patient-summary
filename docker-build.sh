#!/bin/bash

# Build the Docker image
echo "Building Docker image..."
docker build -t aravind-visual-nextjs .

# Run the container
echo "Starting container..."
docker run -p 3000:3000 --name aravind-app aravind-visual-nextjs