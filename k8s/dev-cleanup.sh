#!/bin/bash

# IoT Control System - Development Environment Cleanup
# Removes all development resources

set -e

echo "🧹 IoT Control System - Development Environment Cleanup"
echo "======================================================"

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

# Check if namespace exists
if kubectl get namespace iot-control-dev &> /dev/null; then
    print_status "Found development namespace. Cleaning up..."
    
    # Delete the entire namespace (this removes all resources)
    kubectl delete namespace iot-control-dev
    
    print_success "Development namespace deleted successfully"
else
    print_warning "Development namespace not found. Nothing to clean up."
fi

# Remove development Docker images
print_status "Removing development Docker images..."

if docker image inspect iot-control-backend:dev &> /dev/null; then
    docker rmi iot-control-backend:dev
    print_success "Removed iot-control-backend:dev image"
else
    print_warning "iot-control-backend:dev image not found"
fi

if docker image inspect iot-control-frontend:dev &> /dev/null; then
    docker rmi iot-control-frontend:dev
    print_success "Removed iot-control-frontend:dev image"
else
    print_warning "iot-control-frontend:dev image not found"
fi

print_success "Development environment cleanup completed!"

echo ""
print_status "Cleanup Summary:"
echo "==================="
echo "✅ Removed iot-control-dev namespace"
echo "✅ Removed development Docker images"
echo "✅ All development resources cleaned up"

echo ""
print_status "To start development environment again:"
echo "./k8s/dev-deploy.sh" 