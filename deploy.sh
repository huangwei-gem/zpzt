#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

IMAGE_FILE="${1:-ai-interview-images.tar}"

if [ ! -f "$IMAGE_FILE" ]; then
    echo "Error: Image file '$IMAGE_FILE' not found!"
    echo "Usage: ./deploy.sh <image-file.tar>"
    exit 1
fi

if [ ! -f "docker-compose.prod.yml" ]; then
    echo "Error: docker-compose.prod.yml not found!"
    exit 1
fi

echo "=========================================="
echo "AI Interview System - Deployment Script"
echo "=========================================="
echo ""

echo "[1/4] Loading Docker images..."
docker load -i "$IMAGE_FILE"

echo ""
echo "[2/4] Checking .env file..."
if [ ! -f ".env" ]; then
    echo "Creating .env file from template..."
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo "Please edit .env file with your configuration!"
    else
        echo "Creating minimal .env file..."
        cat > .env << EOF
SECRET_KEY=$(openssl rand -hex 32)
OPENAI_API_KEY=your-api-key-here
OPENAI_BASE_URL=
EOF
    fi
fi

echo ""
echo "[3/4] Stopping existing containers..."
docker-compose -f docker-compose.prod.yml down 2>/dev/null || true

echo ""
echo "[4/4] Starting services..."
docker-compose -f docker-compose.prod.yml up -d

echo ""
echo "Waiting for services to start..."
sleep 10

echo ""
echo "Checking service status..."
docker-compose -f docker-compose.prod.yml ps

echo ""
echo "=========================================="
echo "Deployment completed!"
echo "=========================================="
echo ""
echo "Services are running:"
echo "  - Frontend: http://localhost"
echo "  - Backend API: http://localhost/api"
echo ""
echo "Default admin credentials:"
echo "  - Email: admin@example.com"
echo "  - Password: admin123"
echo ""
echo "Useful commands:"
echo "  - View logs: docker-compose -f docker-compose.prod.yml logs -f"
echo "  - Stop services: docker-compose -f docker-compose.prod.yml down"
echo "  - Restart services: docker-compose -f docker-compose.prod.yml restart"