# IoT Control System - Development Environment

This document describes how to set up and use the development environment for the IoT Control System on your local PC.

## 🎯 Overview

The development environment is designed for local development and testing while preserving all real instrument configurations from the production system. It runs on Kubernetes with NodePort services for easy local access.

## 🔧 Prerequisites

### Required Software
- **Docker Desktop** (with Kubernetes enabled)
- **kubectl** command-line tool
- **Git** (for version control)

### Installation Instructions

#### macOS
```bash
# Install Docker Desktop
brew install --cask docker

# Install kubectl
brew install kubectl

# Install Git (if not already installed)
brew install git
```

#### Ubuntu/Debian
```bash
# Install Docker
sudo apt-get update
sudo apt-get install docker.io
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker $USER

# Install kubectl
sudo apt-get install kubectl

# Install Git (if not already installed)
sudo apt-get install git
```

#### Windows
- Download and install [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop)
- Download [kubectl for Windows](https://kubernetes.io/docs/tasks/tools/install-kubectl-windows/)
- Download and install [Git for Windows](https://git-scm.com/download/win)

## 🚀 Quick Start

### 1. Start Development Environment
```bash
# Make scripts executable
chmod +x k8s/dev-deploy.sh
chmod +x k8s/dev-cleanup.sh

# Deploy development environment
./k8s/dev-deploy.sh
```

### 2. Access the Application
- **Frontend**: http://localhost:33000
- **Backend API**: http://localhost:38000
- **MQTT**: localhost:31883
- **MQTT WebSocket**: ws://localhost:39001
- **Database**: localhost:35432 (if needed)

### 3. Stop Development Environment
```bash
./k8s/dev-cleanup.sh
```

## 🏗️ Development Architecture

### Services
- **MQTT Broker**: Eclipse Mosquitto 2.0
- **Backend**: Python FastAPI with real IO-Link integration
- **Frontend**: React + Tailwind CSS + Material-UI
- **Database**: PostgreSQL (optional)

### Real Instrument Configuration
All real instrument configurations are preserved from the production system:

- **IO-Link Master IP**: 192.168.30.29
- **Device IDs**: 
  - HTR-A: 00-02-01-6D-55-8A
  - HTR-B: 00-02-01-6D-55-86
- **Temperature Sensor**: Port 6
- **MQTT Topics**: instruments_ti, instrument/htr_a
- **Temperature Conversion**: 031B → 79.5°F

## 🔄 Development Workflow

### 1. Code Changes
Edit code in the following directories:
- **Backend**: `./backend/src/`
- **Frontend**: `./frontend/src/`

### 2. Apply Changes
After making code changes, restart the respective service:

```bash
# Restart backend
kubectl rollout restart deployment/backend-dev -n iot-control-dev

# Restart frontend
kubectl rollout restart deployment/frontend-dev -n iot-control-dev
```

### 3. Monitor Logs
```bash
# Backend logs
kubectl logs -n iot-control-dev -f -l app=backend-dev

# Frontend logs
kubectl logs -n iot-control-dev -f -l app=frontend-dev

# MQTT logs
kubectl logs -n iot-control-dev -f -l app=mqtt-broker-dev
```

### 4. Access Container Shell
```bash
# Backend shell
kubectl exec -it -n iot-control-dev deployment/backend-dev -- /bin/bash

# Frontend shell
kubectl exec -it -n iot-control-dev deployment/frontend-dev -- /bin/bash
```

## 📊 Monitoring and Debugging

### Check Service Status
```bash
# View all pods
kubectl get pods -n iot-control-dev

# View all services
kubectl get services -n iot-control-dev

# View pod details
kubectl describe pod <pod-name> -n iot-control-dev
```

### Check Resource Usage
```bash
# View resource usage
kubectl top pods -n iot-control-dev

# View node resource usage
kubectl top nodes
```

### Debug Network Issues
```bash
# Test MQTT connection
mosquitto_pub -h localhost -p 31883 -t test/topic -m "test message"

# Test backend API
curl http://localhost:38000/api/status

# Test frontend
curl http://localhost:33000
```

## 🔧 Configuration

### Environment Variables
The development environment uses the following key environment variables:

#### Backend
- `MQTT_HOST`: mqtt-service-dev
- `MQTT_PORT`: 1883
- `IOLINK_MASTER_IP`: 192.168.30.29
- `IOLINK_TEMP_PORT`: 6
- `HTR_A_DEVICE_ID`: 00-02-01-6D-55-8A
- `HTR_B_DEVICE_ID`: 00-02-01-6D-55-86
- `LOG_LEVEL`: DEBUG

#### Frontend
- `VITE_MQTT_HOST`: localhost
- `VITE_MQTT_PORT`: 1883
- `VITE_MQTT_WS_PORT`: 9001
- `VITE_HTR_A_IP`: 192.168.30.29
- `VITE_HTR_A_DEVICE_ID`: 00-02-01-6D-55-8A
- `VITE_API_BASE_URL`: http://localhost:38000

### Port Mappings
- **Frontend**: 33000 → 3000
- **Backend**: 38000 → 8000
- **MQTT**: 31883 → 1883
- **MQTT WebSocket**: 39001 → 9001
- **Database**: 35432 → 5432

## 🐛 Troubleshooting

### Common Issues

#### 1. Pods Not Starting
```bash
# Check pod status
kubectl get pods -n iot-control-dev

# Check pod events
kubectl describe pod <pod-name> -n iot-control-dev

# Check pod logs
kubectl logs <pod-name> -n iot-control-dev
```

#### 2. Services Not Accessible
```bash
# Check service status
kubectl get services -n iot-control-dev

# Check service endpoints
kubectl get endpoints -n iot-control-dev

# Test service connectivity
kubectl exec -it <pod-name> -n iot-control-dev -- curl <service-name>
```

#### 3. MQTT Connection Issues
```bash
# Check MQTT broker logs
kubectl logs -n iot-control-dev -l app=mqtt-broker-dev

# Test MQTT connection from inside cluster
kubectl exec -it -n iot-control-dev deployment/backend-dev -- mosquitto_pub -h mqtt-service-dev -t test -m "test"
```

#### 4. IO-Link Connection Issues
```bash
# Check backend logs for IO-Link errors
kubectl logs -n iot-control-dev -l app=backend-dev | grep -i iolink

# Test IO-Link connectivity from backend pod
kubectl exec -it -n iot-control-dev deployment/backend-dev -- curl http://192.168.30.29/iolinkmaster/port%5B6%5D/iolinkdevice/pdin/getdata
```

### Reset Development Environment
If you encounter persistent issues, you can reset the entire environment:

```bash
# Clean up everything
./k8s/dev-cleanup.sh

# Wait a moment
sleep 5

# Redeploy
./k8s/dev-deploy.sh
```

## 📚 Additional Resources

### Useful Commands
```bash
# View all resources in development namespace
kubectl get all -n iot-control-dev

# View ConfigMaps
kubectl get configmaps -n iot-control-dev

# View Secrets
kubectl get secrets -n iot-control-dev

# View events
kubectl get events -n iot-control-dev --sort-by='.lastTimestamp'
```

### Development Tips
1. **Use NodePort services** for easy local access
2. **Mount source code** for live development
3. **Preserve real configurations** from production
4. **Monitor logs** for debugging
5. **Test with real instruments** when possible

### Performance Optimization
- Use resource limits to prevent resource exhaustion
- Monitor memory and CPU usage
- Scale services as needed for development
- Use persistent volumes for data that needs to survive restarts

## 🔒 Security Notes

The development environment is configured for ease of use and may not include all production security measures:

- MQTT broker allows anonymous connections
- Database uses simple passwords
- Services are exposed on NodePort
- Source code is mounted for development

For production deployment, refer to the production Kubernetes manifests in the `k8s/` directory. 