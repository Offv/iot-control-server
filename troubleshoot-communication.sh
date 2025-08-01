#!/bin/bash

# IoT Control System - Communication Troubleshooting Script
# Diagnoses and fixes common frontend-backend communication issues

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

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

echo "🔧 IoT Control System - Communication Troubleshooting"
echo "====================================================="

# Check if we're in the right directory
if [[ ! -f "docker-compose.yml" ]]; then
    print_error "docker-compose.yml not found. Please run this script from the project root directory."
    exit 1
fi

print_status "Checking Docker containers..."

# Check if containers are running
if ! docker ps | grep -q "iot-control-server"; then
    print_error "No IoT control containers found running."
    print_status "Start the system with: docker-compose up -d"
    exit 1
fi

print_success "Docker containers are running"

# Check backend API
print_status ""
print_status "=== Backend API Check ==="

if docker ps | grep -q "backend-unit1"; then
    print_success "✅ Backend container is running"
    
    # Test backend API internally
    if docker exec iot-control-server_backend-unit1_1 wget -qO- http://localhost:8000/api/temperature/htr-a &>/dev/null; then
        print_success "✅ Backend API is responding"
        
        # Get actual temperature data
        temp_data=$(docker exec iot-control-server_backend-unit1_1 wget -qO- http://localhost:8000/api/temperature/htr-a 2>/dev/null)
        if [[ -n "$temp_data" ]]; then
            print_success "✅ Temperature data available: $temp_data"
        else
            print_warning "⚠️  No temperature data returned"
        fi
    else
        print_error "❌ Backend API not responding"
    fi
else
    print_error "❌ Backend container not found"
fi

# Check frontend
print_status ""
print_status "=== Frontend Check ==="

if docker ps | grep -q "frontend-unit1"; then
    print_success "✅ Frontend container is running"
    
    # Test frontend-backend communication
    if docker exec iot-control-server_frontend-unit1_1 wget -qO- http://backend-unit1:8000/api/temperature/htr-a &>/dev/null; then
        print_success "✅ Frontend can communicate with backend"
    else
        print_error "❌ Frontend cannot communicate with backend"
        print_status "This is likely the main issue!"
        
        # Check environment variables
        print_status "Checking frontend environment variables..."
        docker exec iot-control-server_frontend-unit1_1 env | grep VITE_API_BASE_URL || print_warning "VITE_API_BASE_URL not set"
        docker exec iot-control-server_frontend-unit1_1 env | grep VITE_MQTT_WS_PORT || print_warning "VITE_MQTT_WS_PORT not set"
    fi
else
    print_error "❌ Frontend container not found"
fi

# Check MQTT
print_status ""
print_status "=== MQTT Check ==="

if docker ps | grep -q "mqtt"; then
    print_success "✅ MQTT container is running"
    
    # Check MQTT WebSocket port
    if curl -I http://localhost:9001 &>/dev/null; then
        print_success "✅ MQTT WebSocket port 9001 is accessible"
    else
        print_warning "⚠️  MQTT WebSocket port 9001 not accessible"
    fi
else
    print_error "❌ MQTT container not found"
fi

# Check IO-Link connectivity
print_status ""
print_status "=== IO-Link Connectivity Check ==="

# Get IO-Link IPs from environment
htr_a_ip=$(docker exec iot-control-server_backend-unit1_1 env | grep HTR_A_IP | cut -d'=' -f2)
htr_b_ip=$(docker exec iot-control-server_backend-unit1_1 env | grep HTR_B_IP | cut -d'=' -f2)

if [[ -n "$htr_a_ip" ]]; then
    print_status "Testing IO-Link A at $htr_a_ip..."
    if curl -s --connect-timeout 5 "http://$htr_a_ip/iolinkmaster/port%5B6%5D/iolinkdevice/pdin/getdata" &>/dev/null; then
        print_success "✅ IO-Link A is responding"
    else
        print_error "❌ IO-Link A not responding"
    fi
fi

if [[ -n "$htr_b_ip" ]]; then
    print_status "Testing IO-Link B at $htr_b_ip..."
    if curl -s --connect-timeout 5 "http://$htr_b_ip/iolinkmaster/port%5B6%5D/iolinkdevice/pdin/getdata" &>/dev/null; then
        print_success "✅ IO-Link B is responding"
    else
        print_error "❌ IO-Link B not responding"
    fi
fi

# Summary and recommendations
print_status ""
print_status "=== Summary & Recommendations ==="

if docker exec iot-control-server_frontend-unit1_1 wget -qO- http://backend-unit1:8000/api/temperature/htr-a &>/dev/null; then
    print_success "✅ Communication chain is working correctly!"
    print_status "If you're still not seeing temperature data in the frontend:"
    echo "  1. Check browser console for JavaScript errors (F12)"
    echo "  2. Clear browser cache and refresh"
    echo "  3. Check if MQTT WebSocket connection is established"
else
    print_error "❌ Frontend-backend communication is broken"
    print_status "Recommended fixes:"
    echo "  1. Restart containers: docker-compose restart"
    echo "  2. Check environment variables in docker-compose.yml"
    echo "  3. Verify VITE_API_BASE_URL=http://backend-unit1:8000"
    echo "  4. Check firewall settings"
    echo "  5. Rebuild containers: docker-compose up -d --build"
fi

print_status ""
print_status "For detailed logs, run:"
echo "  docker-compose logs backend-unit1"
echo "  docker-compose logs frontend-unit1"
echo "  docker-compose logs mqtt" 