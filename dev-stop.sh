#!/bin/bash

# IoT Control System - Stop Isolated Development Environment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

echo "🛑 IoT Control System - Stopping Development Environment"
echo "======================================================="

# Stop containers
print_status "Stopping containers..."
docker-compose -f docker-compose.dev.yml down

# Remove volumes (optional - uncomment if you want to clear data)
# print_status "Removing volumes..."
# docker-compose -f docker-compose.dev.yml down -v

# Remove networks (optional - uncomment if you want to clear networks)
# print_status "Removing networks..."
# docker network prune -f

print_success "Development environment stopped successfully!"

echo ""
print_status "Cleanup Summary:"
echo "==================="
echo "✅ All containers stopped"
echo "✅ All services terminated"
echo "✅ Network connections closed"
echo "✅ Ports freed up"

echo ""
print_status "To start again:"
echo "=================="
echo "./dev-start.sh"

echo ""
print_warning "Note:"
echo "  - Database data is preserved in Docker volumes"
echo "  - MQTT data is not persistent (cleared on restart)"
echo "  - Source code changes are preserved" 