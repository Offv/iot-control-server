#!/bin/bash

# Configuration
PI_HOST="ubuntu@your-pi-ip"  # Change this to your Pi's IP address
PI_DIR="/home/ubuntu/iot-control-server"

# Ensure the script stops on any error
set -e

echo "🚀 Deploying to Raspberry Pi..."

# Create the directory on the Pi if it doesn't exist
ssh $PI_HOST "mkdir -p $PI_DIR"

# Copy all files except those in .gitignore
rsync -avz --exclude-from=.gitignore --exclude='.git' ./ $PI_HOST:$PI_DIR/

# SSH into the Pi and start the services
ssh $PI_HOST "cd $PI_DIR && \
    docker compose down && \
    docker compose pull && \
    docker compose up -d"

echo "✅ Deployment completed successfully!" 