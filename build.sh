#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

VERSION="${1:-latest}"
BUILD_DATE=$(date +%Y%m%d%H%M%S)
PLATFORM="${2:-linux/amd64}"

echo "=========================================="
echo "AI Interview System - Docker Build Script"
echo "=========================================="
echo "Version: $VERSION"
echo "Build Date: $BUILD_DATE"
echo "Target Platform: $PLATFORM"
echo ""

echo "[1/5] Building backend image for $PLATFORM..."
docker build --platform $PLATFORM -t ai-interview-backend:$VERSION -t ai-interview-backend:latest ./backend

echo ""
echo "[2/5] Building frontend image for $PLATFORM..."
docker build --platform $PLATFORM -t ai-interview-frontend:$VERSION -t ai-interview-frontend:latest ./frontend

echo ""
echo "[3/5] Pulling postgres image for $PLATFORM..."
docker pull --platform $PLATFORM postgres:15-alpine

echo ""
echo "[4/5] Pulling nginx image for $PLATFORM..."
docker pull --platform $PLATFORM nginx:alpine

echo ""
echo "[5/5] Saving images to tar file..."
docker save -o "$SCRIPT_DIR/ai-interview-images-$BUILD_DATE.tar" \
    ai-interview-backend:$VERSION \
    ai-interview-frontend:$VERSION \
    postgres:15-alpine \
    nginx:alpine

echo ""
echo "=========================================="
echo "Build completed successfully!"
echo "=========================================="
echo ""
echo "Output file: ai-interview-images-$BUILD_DATE.tar"
echo "File size: $(du -h ai-interview-images-$BUILD_DATE.tar | cut -f1)"
echo "Target platform: $PLATFORM"
echo ""
echo "To deploy on offline server:"
echo "  1. Copy ai-interview-images-$BUILD_DATE.tar to target server"
echo "  2. Copy deploy.sh to target server"
echo "  3. Copy docker-compose.prod.yml to target server"
echo "  4. Copy .env.example to target server as .env (and modify as needed)"
echo "  5. Run: ./deploy.sh ai-interview-images-$BUILD_DATE.tar"
echo ""
echo "Tips:"
echo "  - Default builds for x86_64 (linux/amd64)"
echo "  - For ARM servers, use: ./build.sh latest linux/arm64"