#!/bin/bash

# IoT Control System - Isolated Docker Development Environment
# Runs everything in containers, completely isolated from your Mac

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

echo "🚀 IoT Control System - Isolated Development Environment"
echo "======================================================="

# Check if Docker is running
if ! docker info &> /dev/null; then
    print_error "Docker is not running. Please start Docker Desktop first."
    exit 1
fi

print_status "Starting isolated development environment..."

# Create necessary directories
mkdir -p mosquitto/config nginx/conf.d

# Create MQTT configuration
cat > mosquitto/config/mosquitto.conf << EOF
listener 1883
allow_anonymous true

listener 9001
protocol websockets
allow_anonymous true

log_dest stdout
log_type all
log_timestamp true
EOF

# Start the development environment
print_status "Starting containers..."
docker-compose -f docker-compose.dev.yml up -d

# Wait for services to be ready
print_status "Waiting for services to be ready..."
sleep 10

# Check if containers are running
print_status "Checking container status..."
docker-compose -f docker-compose.dev.yml ps

print_success "Development environment started successfully!"

echo ""
print_status "Access Information:"
echo "======================"
echo "Unit 1:"
echo "  Frontend: http://localhost (or http://unit1htr.system)"
echo "  Backend API: http://localhost/api (or http://unit1htr.system/api)"
echo "  Direct Backend: http://localhost:38001"
echo "  Direct Frontend: http://localhost:33001"
echo ""
echo "Unit 2:"
echo "  Frontend: http://unit2htr.system"
echo "  Backend API: http://unit2htr.system/api"
echo "  Direct Backend: http://localhost:38002"
echo "  Direct Frontend: http://localhost:33002"
echo ""
echo "Shared Services:"
echo "  MQTT: localhost:31883"
echo "  MQTT WebSocket: ws://localhost:39001"
echo "  Database: localhost:35432"

echo ""
print_status "Unit Configuration:"
echo "======================"
echo "Unit 1:"
echo "  Subnet: 192.168.30.x"
echo "  HTR-A: 192.168.30.29 (IO-Link A) - Device ID: 00-02-01-6D-55-8A"
echo "  HTR-B: 192.168.30.29 (IO-Link B) - Device ID: 00-02-01-6D-55-86"
echo "  MQTT Topics: instrument/unit1/htr_a/temperature (shared for both HTR-A & HTR-B)"
echo ""
echo "Unit 2:"
echo "  Subnet: 192.168.30.x"
echo "  HTR-A: 192.168.30.29 (IO-Link A) - Device ID: 00-02-01-6D-55-8C"
echo "  HTR-B: 192.168.30.33 (IO-Link B) - Device ID: 00-02-01-6D-55-8D"
echo "  MQTT Topics: instrument/unit2/htr_a/temperature (shared for both HTR-A & HTR-B)"

echo ""
print_status "Development Commands:"
echo "========================"
echo "View logs: docker-compose -f docker-compose.dev.yml logs -f"
echo "View Unit 1 logs: docker-compose -f docker-compose.dev.yml logs -f backend-unit1"
echo "View Unit 2 logs: docker-compose -f docker-compose.dev.yml logs -f backend-unit2"
echo "Restart Unit 1: docker-compose -f docker-compose.dev.yml restart backend-unit1 frontend-unit1"
echo "Restart Unit 2: docker-compose -f docker-compose.dev.yml restart backend-unit2 frontend-unit2"
echo "Stop environment: docker-compose -f docker-compose.dev.yml down"

echo ""
print_status "Adding Units:"
echo "================"
echo "To add more units, edit docker-compose.dev.yml and add:"
echo "  - backend-unit3 and frontend-unit3 services"
echo "  - Update nginx configuration"
echo "  - Use subnet 40.x.x.x for Unit 3"

echo ""
print_warning "Important notes:"
echo "1. All services run in isolated containers"
echo "2. No impact on your Mac system"
echo "3. Source code is mounted for live development"
echo "4. Each unit has its own backend and frontend"
echo "5. Shared MQTT broker and database"
echo "6. Domain-based routing through nginx"

echo ""
print_success "Environment is ready! Access Unit 1 at http://localhost" 