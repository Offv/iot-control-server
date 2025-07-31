#!/bin/bash

# IoT Control System - Development Deployment Script
# For local development on your PC with unit-based addressing
# Preserves all real instrument configurations from backup notes

set -e

echo "🔧 IoT Control System - Development Environment (Unit-Based)"
echo "============================================================"

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

# Check if kubectl is installed
if ! command -v kubectl &> /dev/null; then
    print_error "kubectl is not installed. Please install kubectl first."
    print_status "For macOS: brew install kubectl"
    print_status "For Ubuntu: sudo apt-get install kubectl"
    exit 1
fi

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker first."
    print_status "For macOS: brew install docker"
    print_status "For Ubuntu: sudo apt-get install docker.io"
    exit 1
fi

# Check if Docker is running
if ! docker info &> /dev/null; then
    print_error "Docker is not running. Please start Docker first."
    exit 1
fi

print_status "Prerequisites check passed"

# Build development Docker images
print_status "Building development Docker images..."

# Build backend development image
print_status "Building backend development image..."
docker build -t iot-control-backend:dev ./backend

# Build frontend development image
print_status "Building frontend development image..."
docker build -t iot-control-frontend:dev ./frontend

print_success "Development Docker images built successfully"

# Apply development Kubernetes manifests
print_status "Deploying development environment with unit-based addressing..."

# Create namespace and basic resources
print_status "Creating development namespace and resources..."
kubectl apply -f k8s/dev-deployment.yaml

# Wait for resources to be ready
sleep 10

# Wait for pods to be ready
print_status "Waiting for development pods to be ready..."
kubectl wait --for=condition=ready pod -l app=mqtt-broker-dev -n iot-control-dev --timeout=120s
kubectl wait --for=condition=ready pod -l app=backend-unit1-dev -n iot-control-dev --timeout=120s
kubectl wait --for=condition=ready pod -l app=frontend-unit1-dev -n iot-control-dev --timeout=120s
kubectl wait --for=condition=ready pod -l app=backend-unit2-dev -n iot-control-dev --timeout=120s
kubectl wait --for=condition=ready pod -l app=frontend-unit2-dev -n iot-control-dev --timeout=120s

print_success "Development environment deployed successfully!"

# Display deployment status
echo ""
print_status "Development Environment Status:"
echo "====================================="
kubectl get pods -n iot-control-dev
echo ""
kubectl get services -n iot-control-dev

# Display access information
echo ""
print_status "Unit-Based Access Information:"
echo "===================================="
echo "Unit 1:"
echo "  Frontend: http://unit1htr.system (or http://localhost:33001)"
echo "  Backend API: http://unit1htr.system/api (or http://localhost:38001)"
echo ""
echo "Unit 2:"
echo "  Frontend: http://unit2htr.system (or http://localhost:33002)"
echo "  Backend API: http://unit2htr.system/api (or http://localhost:38002)"
echo ""
echo "Shared Services:"
echo "  MQTT: localhost:31883"
echo "  MQTT WebSocket: ws://localhost:39001"
echo "  Database: localhost:35432 (if needed)"

# Display logs for verification
echo ""
print_status "Recent logs from Unit 1 backend:"
kubectl logs -n iot-control-dev -l app=backend-unit1-dev --tail=10

echo ""
print_status "Recent logs from Unit 1 frontend:"
kubectl logs -n iot-control-dev -l app=frontend-unit1-dev --tail=10

echo ""
print_success "Development environment is now running with unit-based addressing!"
print_status "All real instrument configurations have been preserved:"
echo "  - IO-Link Master IP: 192.168.30.29 (Unit 1), 192.168.30.33 (Unit 2)"
echo "  - Device IDs: 00-02-01-6D-55-8A (HTR-A), 00-02-01-6D-55-86 (HTR-B)"
echo "  - Temperature sensor: Port 6"
echo "  - MQTT topics: instruments_ti, instrument/htr_a"
echo "  - Real-time temperature conversion: 031B → 79.5°F"

echo ""
print_status "Unit Configuration:"
echo "======================"
echo "Unit 1:"
echo "  Domain: unit1htr.system"
echo "  IO-Link IP: 192.168.30.29"
echo "  Device ID: 00-02-01-6D-55-8A"
echo "  MQTT Topic: instrument/unit1/temperature"
echo ""
echo "Unit 2:"
echo "  Domain: unit2htr.system"
echo "  IO-Link IP: 192.168.30.33"
echo "  Device ID: 00-02-01-6D-55-86"
echo "  MQTT Topic: instrument/unit2/temperature"

echo ""
print_status "Development Commands:"
echo "========================"
echo "View Unit 1 logs: kubectl logs -n iot-control-dev -f -l app=backend-unit1-dev"
echo "View Unit 2 logs: kubectl logs -n iot-control-dev -f -l app=backend-unit2-dev"
echo "Access Unit 1 shell: kubectl exec -it -n iot-control-dev deployment/backend-unit1-dev -- /bin/bash"
echo "Access Unit 2 shell: kubectl exec -it -n iot-control-dev deployment/backend-unit2-dev -- /bin/bash"
echo "Restart Unit 1: kubectl rollout restart deployment/backend-unit1-dev -n iot-control-dev"
echo "Restart Unit 2: kubectl rollout restart deployment/backend-unit2-dev -n iot-control-dev"

echo ""
print_status "To stop the development environment:"
echo "kubectl delete namespace iot-control-dev"

echo ""
print_warning "Development Notes:"
echo "1. Source code is mounted from your local directory for live development"
echo "2. Changes to backend/src will require a pod restart"
echo "3. Changes to frontend/src will require a pod restart"
echo "4. MQTT broker is accessible on localhost:31883 and localhost:39001"
echo "5. All real instrument configurations are preserved from backup notes"
echo "6. Each unit has its own domain and dedicated services"

echo ""
print_status "Quick Development Workflow:"
echo "1. Edit code in ./backend/src or ./frontend/src"
echo "2. Restart the respective unit: kubectl rollout restart deployment/backend-unit1-dev -n iot-control-dev"
echo "3. Check logs: kubectl logs -n iot-control-dev -f -l app=backend-unit1-dev"
echo "4. Access the application at http://unit1htr.system or http://localhost:33001"

echo ""
print_status "Adding New Units:"
echo "===================="
echo "To add Unit 3, copy the Unit 2 configuration and update:"
echo "- Change unit number to '3'"
echo "- Update domain to 'unit3htr.system'"
echo "- Update IO-Link IP to the new unit's IP"
echo "- Update device ID to the new unit's device ID"
echo "- Update NodePort numbers (e.g., 38003, 33003)"
echo "- Add new ingress rules for unit3htr.system"

echo ""
print_status "Local DNS Setup (Optional):"
echo "================================"
echo "Add to /etc/hosts for domain access:"
echo "127.0.0.1 unit1htr.system"
echo "127.0.0.1 unit2htr.system"
echo "127.0.0.1 unit3htr.system  # for future units" 