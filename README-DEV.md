# IoT Dual Heater Control System - Development Environment

This document describes how to set up and use the development environment for the IoT Dual Heater Control System with Docker Compose.

## 🎯 Overview

The development environment provides a complete multi-unit setup for developing and testing the dual heater control system. It supports both single-unit and multi-unit deployments with real IO-Link integration, shared temperature sensing, and advanced PID control features.

## 🔧 Prerequisites

### Required Software
- **Docker Desktop** (latest version)
- **Docker Compose** (v2.0+)
- **Git** (for version control)
- **Node.js 18+** (optional, for direct frontend development)
- **Python 3.8+** (optional, for direct backend development)

### Installation Instructions

#### macOS
```bash
# Install Docker Desktop
brew install --cask docker

# Install Git
brew install git

# Optional: Node.js and Python
brew install node python@3.11
```

#### Ubuntu/Debian
```bash
# Install Docker and Docker Compose
sudo apt-get update
sudo apt-get install docker.io docker-compose-plugin
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker $USER

# Install Git
sudo apt-get install git

# Optional: Node.js and Python
sudo apt-get install nodejs npm python3 python3-pip
```

#### Windows
- Download and install [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop)
- Download and install [Git for Windows](https://git-scm.com/download/win)

## 🚀 Quick Start

### 1. Clone Repository
```bash
git clone https://github.com/Offv/iot-control-server.git
cd iot-control-server
```

### 2. Start Development Environment

```bash
# Start multi-unit development environment
./dev-start.sh

# Or manually start with Docker Compose
docker-compose -f docker-compose.dev.yml up -d
```

### 3. Access Applications

#### Unit 1 (Primary)
- **Dual Control Interface**: http://localhost:33001
- **Backend API**: http://localhost:38001
- **API Documentation**: http://localhost:38001/docs

#### Unit 2 (Secondary)  
- **Dual Control Interface**: http://localhost:33002
- **Backend API**: http://localhost:38002
- **API Documentation**: http://localhost:38002/docs

#### Shared Services
- **MQTT Broker**: localhost:1883
- **MQTT Web UI**: http://localhost:18083 (admin/public)
- **PostgreSQL Database**: localhost:5432

### 4. Stop Development Environment
```bash
# Stop all services
./dev-stop.sh

# Or manually stop
docker-compose -f docker-compose.dev.yml down
```

## 🏗️ Development Architecture

### Services Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Frontend-Unit1 │    │  Frontend-Unit2 │    │   PostgreSQL    │
│   Port: 33001   │    │   Port: 33002   │    │   Port: 5432    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┼───┐
                                 │                       │   │
┌─────────────────┐    ┌─────────────────┐              │   │
│  Backend-Unit1  │    │  Backend-Unit2  │              │   │
│   Port: 38001   │    │   Port: 38002   │              │   │
└─────────────────┘    └─────────────────┘              │   │
         │                       │                       │   │
         └───────────────────────┼───────────────────────┼───┼───┐
                                 │                       │   │   │
                    ┌─────────────────┐                  │   │   │
                    │ MQTT Broker     │◄─────────────────┘   │   │
                    │ Port: 1883      │                      │   │
                    │ Web: 18083      │                      │   │
                    └─────────────────┘                      │   │
                                 │                           │   │
                    ┌─────────────────┐                      │   │
                    │  IO-Link Master │                      │   │
                    │ 192.168.30.29   │◄─────────────────────┘   │
                    │ Temp: Port 6    │                          │
                    │ HTR: Ports 1-4  │◄─────────────────────────┘
                    └─────────────────┘
```

### Technology Stack

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS
- **Backend**: Python FastAPI + asyncio + aiohttp
- **MQTT**: Eclipse Mosquitto 2.0 with WebSocket support
- **Database**: PostgreSQL 15 with async support
- **Containerization**: Docker + Docker Compose
- **Development**: Hot reload for both frontend and backend

## 🔄 Development Workflow

### 1. Making Code Changes

#### Frontend Development
```bash
# The containers automatically detect changes and reload
# Edit files in: ./frontend/src/

# For faster development, you can also run frontend locally:
cd frontend
npm install
npm run dev
# Access at http://localhost:3000
```

#### Backend Development
```bash
# The containers automatically detect changes and reload
# Edit files in: ./backend/src/

# For faster development, you can also run backend locally:
cd backend
pip install -r requirements.txt
python src/main.py
# Access at http://localhost:8000
```

### 2. Monitor Development

```bash
# View all logs
docker-compose -f docker-compose.dev.yml logs -f

# View specific service logs
docker-compose -f docker-compose.dev.yml logs -f frontend-unit1
docker-compose -f docker-compose.dev.yml logs -f backend-unit1
docker-compose -f docker-compose.dev.yml logs -f mosquitto

# Monitor MQTT traffic
docker exec -it iot-mosquitto mosquitto_sub -t "instrument/#"
```

### 3. Development Commands

```bash
# Restart specific services
docker-compose -f docker-compose.dev.yml restart backend-unit1
docker-compose -f docker-compose.dev.yml restart frontend-unit1

# Rebuild containers after dependency changes
docker-compose -f docker-compose.dev.yml build backend-unit1
docker-compose -f docker-compose.dev.yml up -d backend-unit1

# Access container shells
docker exec -it iot-backend-unit1 bash
docker exec -it iot-frontend-unit1 bash

# View container resource usage
docker stats
```

## 🔧 Configuration

### Environment Variables

The development environment uses comprehensive environment variables for both units:

#### Backend Configuration
```bash
# Unit 1 Backend
UNIT_NUMBER=1
HTR_A_IP=192.168.30.29
HTR_B_IP=192.168.30.33
HTR_A_DEVICE_ID=00-02-01-6D-55-8A
HTR_B_DEVICE_ID=00-02-01-6D-55-86
HTR_A_TEMP_TOPIC=instrument/unit1/htr_a/temperature
HTR_B_TEMP_TOPIC=instrument/unit1/htr_a/temperature  # Shared temperature
MQTT_HOST=mosquitto
DATABASE_URL=postgresql://postgres:password@database:5432/iot_control

# Unit 2 Backend
UNIT_NUMBER=2
HTR_A_IP=192.168.30.29
HTR_B_IP=192.168.30.33
HTR_B_TEMP_TOPIC=instrument/unit2/htr_a/temperature  # Shared temperature
```

#### Frontend Configuration
```bash
# Unit 1 Frontend
VITE_UNIT_NUMBER=1
VITE_HTR_A_IP=192.168.30.29
VITE_HTR_B_IP=192.168.30.33
VITE_HTR_A_TOPIC=instrument/unit1/htr_a/temperature
VITE_HTR_B_TOPIC=instrument/unit1/htr_a/temperature  # Shared temperature
VITE_MQTT_HOST=localhost
VITE_MQTT_PORT=1883
VITE_API_BASE_URL=http://localhost:38001
```

### Network Configuration

```yaml
networks:
  iot-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/16
```

### Volume Mounts for Development

```yaml
volumes:
  # Hot reload for frontend
  - ./frontend:/app
  - /app/node_modules
  
  # Hot reload for backend
  - ./backend:/app
  - /app/__pycache__
  
  # Persistent data
  - postgres_data:/var/lib/postgresql/data
  - mosquitto_data:/mosquitto/data
  - mosquitto_logs:/mosquitto/log
```

## 🎛️ Feature Development

### Dual Heater Control Features

The system includes these advanced features for development:

#### 1. Shared Temperature Sensing
```typescript
// Frontend: Both heaters subscribe to same temperature topic
const temperatureTopic = `instrument/unit${unitNumber}/htr_a/temperature`;
```

#### 2. State Persistence
```typescript
// All settings persist across page refreshes
interface PersistentState {
  isAuto: boolean;
  setpoint: number;
  sections: boolean[];
  kp: number;
  ki: number;
  kd: number;
  controlMode: string;
}
```

#### 3. Advanced PID Control
```python
# Backend: Stepped output system with section management
def calculate_pid_output(current_temp, setpoint, kp, ki, kd):
    # PID calculation with stepped output
    # Section control logic (0→1→2→3 for add, 3→2→1→0 for remove)
```

#### 4. Timer-based Section Control
```typescript
// Individual timer settings per unit (5-120 seconds)
const timerSize = loadTimerSize(`unit${unitNumber}htr${htrType}time`);
```

### Testing New Features

#### 1. MQTT Testing
```bash
# Test temperature data
mosquitto_pub -h localhost -p 1883 -t "instrument/unit1/htr_a/temperature" -m "75.5"

# Monitor all topics
mosquitto_sub -h localhost -p 1883 -t "instrument/#"

# Test section control
mosquitto_pub -h localhost -p 1883 -t "instrument/unit1/htr_a/sections" -m '{"sections":[true,true,false,false]}'
```

#### 2. API Testing
```bash
# Test backend health
curl http://localhost:38001/api/status

# Test IO-Link communication
curl -X POST "http://localhost:38001/api/iolink/192.168.30.29/port/1" \
  -H "Content-Type: application/json" \
  -d '{"value": true}'

# Get temperature reading
curl http://localhost:38001/api/temperature
```

#### 3. Frontend Testing
```bash
# Test dual control interface
open http://localhost:33001

# Check browser developer tools for:
# - localStorage persistence
# - MQTT WebSocket connections
# - React component states
# - PID calculations
```

## 🐛 Debugging

### Frontend Debugging

```bash
# View React development tools
# Install React Developer Tools browser extension

# Monitor state changes
# Open browser DevTools → React tab

# Check localStorage persistence
# DevTools → Application → Local Storage

# Monitor MQTT connections
# DevTools → Network → WS (WebSocket)

# View console logs
# DevTools → Console
```

### Backend Debugging

```bash
# View detailed logs
docker-compose -f docker-compose.dev.yml logs -f backend-unit1

# Access backend container
docker exec -it iot-backend-unit1 bash

# Test IO-Link connectivity
curl "http://192.168.30.29/iolinkmaster/port%5B6%5D/iolinkdevice/pdin/getdata"

# Monitor FastAPI logs
tail -f /app/logs/backend.log
```

### MQTT Debugging

```bash
# Access MQTT container
docker exec -it iot-mosquitto bash

# Check MQTT logs
docker-compose -f docker-compose.dev.yml logs -f mosquitto

# Monitor client connections
mosquitto_sub -h localhost -p 1883 -t '$SYS/broker/clients/connected'

# Test WebSocket connection
# Use browser DevTools → Network → WS
```

### Database Debugging

```bash
# Access PostgreSQL
docker exec -it iot-database psql -U postgres -d iot_control

# View tables
\dt

# Check connection logs
docker-compose -f docker-compose.dev.yml logs -f database
```

## 🔍 Advanced Development

### Custom Unit Configuration

```bash
# Add new unit interactively
./install-unit-interactive.sh

# Manual unit configuration
cp docker-compose.unit1.yml docker-compose.unit3.yml
# Edit unit3 configuration
# Deploy: docker-compose -f docker-compose.dev.yml -f docker-compose.unit3.yml up -d
```

### Performance Optimization

```bash
# Monitor container resources
docker stats

# Optimize React build
cd frontend && npm run build

# Profile Python backend
python -m cProfile src/main.py

# Monitor MQTT throughput
mosquitto_sub -h localhost -p 1883 -t "instrument/#" -C 1000
```

### Code Quality

```bash
# Frontend linting
cd frontend && npm run lint

# Backend linting  
cd backend && python -m flake8 src/

# Type checking
cd frontend && npm run type-check
cd backend && python -m mypy src/
```

## 🚀 Deployment Preparation

### Build Production Images

```bash
# Build optimized images
docker-compose -f docker-compose.yml build

# Test production build
docker-compose -f docker-compose.yml up -d
```

### Environment Migration

```bash
# Export development data
docker exec iot-database pg_dump -U postgres iot_control > dev_backup.sql

# Import to production
# (Run on production server)
```

## 📚 Additional Resources

### Useful Development Commands

```bash
# Quick restart everything
./dev-start.sh

# Reset development environment
docker-compose -f docker-compose.dev.yml down -v
docker system prune -f
./dev-start.sh

# Update dependencies
cd frontend && npm update
cd backend && pip install -r requirements.txt --upgrade

# Generate API documentation
cd backend && python -c "import src.main; print('Docs at: http://localhost:38001/docs')"
```

### Development Best Practices

1. **🔄 Use Hot Reload**: Edit files directly, containers auto-reload
2. **📊 Monitor Logs**: Always keep logs visible during development
3. **🧪 Test Incrementally**: Test each feature as you develop
4. **💾 Persist State**: Use localStorage for UI state persistence
5. **📱 Responsive Design**: Test on different screen sizes
6. **🔧 PID Tuning**: Use the built-in PID tuning interface
7. **⏱️ Timer Testing**: Verify timer functionality with different settings

### Performance Monitoring

```bash
# Monitor temperature update frequency
mosquitto_sub -h localhost -p 1883 -t "instrument/unit1/htr_a/temperature" | ts

# Check response times
curl -w "@curl-format.txt" -o /dev/null -s "http://localhost:38001/api/status"

# Monitor WebSocket connections
ss -tulpn | grep :1883
```

This development environment provides everything needed to build, test, and refine the advanced dual heater control system with real-time temperature monitoring, sophisticated PID control, and persistent state management! 🔥 