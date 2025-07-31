#!/bin/bash

# IoT Control System - Kubernetes Deployment Script
# This script deploys the complete IoT control system on any Ubuntu system
# Preserves all real instrument configurations from backup notes

set -e

echo "🚀 IoT Control System - Kubernetes Deployment"
echo "=============================================="

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

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   print_error "This script should not be run as root"
   exit 1
fi

# Check if kubectl is installed
if ! command -v kubectl &> /dev/null; then
    print_error "kubectl is not installed. Please install kubectl first."
    exit 1
fi

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker first."
    exit 1
fi

print_status "Prerequisites check passed"

# Create necessary directories
print_status "Creating data directories..."
sudo mkdir -p /data/mqtt
sudo mkdir -p /data/timescaledb
sudo chown -R $USER:$USER /data

# Build Docker images
print_status "Building Docker images..."

# Build backend image
print_status "Building backend image..."
docker build -t iot-control-backend:latest ./backend

# Build frontend image
print_status "Building frontend image..."
docker build -t iot-control-frontend:latest ./frontend

print_success "Docker images built successfully"

# Apply Kubernetes manifests
print_status "Deploying to Kubernetes..."

# Create namespace and basic resources
print_status "Creating namespace and basic resources..."
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmaps.yaml
kubectl apply -f k8s/secrets.yaml
kubectl apply -f k8s/persistent-volumes.yaml

# Wait for resources to be ready
sleep 5

# Deploy core services
print_status "Deploying MQTT broker..."
kubectl apply -f k8s/mqtt-deployment.yaml

print_status "Deploying database..."
kubectl apply -f k8s/database-deployment.yaml

# Wait for database to be ready
print_status "Waiting for database to be ready..."
kubectl wait --for=condition=ready pod -l app=database -n iot-control --timeout=300s

# Deploy application services
print_status "Deploying backend..."
kubectl apply -f k8s/backend-deployment.yaml

print_status "Deploying frontend..."
kubectl apply -f k8s/frontend-deployment.yaml

# Wait for all pods to be ready
print_status "Waiting for all pods to be ready..."
kubectl wait --for=condition=ready pod -l app=backend -n iot-control --timeout=300s
kubectl wait --for=condition=ready pod -l app=frontend -n iot-control --timeout=300s

# Deploy ingress
print_status "Deploying ingress..."
kubectl apply -f k8s/ingress.yaml

print_success "Deployment completed successfully!"

# Display deployment status
echo ""
print_status "Deployment Status:"
echo "===================="
kubectl get pods -n iot-control
echo ""
kubectl get services -n iot-control
echo ""
kubectl get ingress -n iot-control

# Display access information
echo ""
print_status "Access Information:"
echo "======================"
echo "Frontend: http://iot-control.local (or your domain)"
echo "API: http://iot-control.local/api"
echo "MQTT WebSocket: ws://iot-control.local:9001"

# Check if services are running
echo ""
print_status "Checking service health..."
kubectl get pods -n iot-control -o wide

# Display logs for verification
echo ""
print_status "Recent logs from backend:"
kubectl logs -n iot-control -l app=backend --tail=10

echo ""
print_status "Recent logs from frontend:"
kubectl logs -n iot-control -l app=frontend --tail=10

echo ""
print_success "IoT Control System is now running on Kubernetes!"
print_status "All real instrument configurations have been preserved:"
echo "  - IO-Link Master IP: 192.168.30.29"
echo "  - Device IDs: 00-02-01-6D-55-8A (HTR-A), 00-02-01-6D-55-86 (HTR-B)"
echo "  - Temperature sensor: Port 6"
echo "  - MQTT topics: instruments_ti, instrument/htr_a"
echo "  - Real-time temperature conversion: 031B → 79.5°F"

echo ""
print_warning "Next steps:"
echo "1. Update your DNS or /etc/hosts to point iot-control.local to your server IP"
echo "2. Configure your firewall to allow traffic on ports 80, 443, 1883, 9001"
echo "3. Ensure your IO-Link master is accessible from the Kubernetes cluster"
echo "4. Monitor the system logs: kubectl logs -n iot-control -f"

echo ""
print_status "To scale the system:"
echo "kubectl scale deployment backend -n iot-control --replicas=5"
echo "kubectl scale deployment frontend -n iot-control --replicas=5" 