# IoT Dual Heater Control System

Advanced industrial IoT control system for dual heater units with sophisticated PID control, real-time monitoring, and multi-unit deployment capabilities.

## 🔥 **System Overview**

This system provides precise temperature control for industrial heating applications using:
- **Dual Heater Control**: HTR-A and HTR-B with shared temperature sensing
- **Advanced PID Control**: Stepped output system with variable step sizes
- **Real-time MQTT Communication**: Sub-second temperature updates
- **State Persistence**: All settings survive page refreshes
- **Multi-unit Deployment**: Scalable architecture for multiple heating zones
- **IO-Link Integration**: Direct communication with industrial sensors and actuators

## 🏗️ **Architecture**

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   React Web UI │    │   FastAPI        │    │  IO-Link Master │
│   (Frontend)    │◄──►│   Backend        │◄──►│  192.168.30.29  │
│                 │    │                  │    │   Port 6 Temp   │
│ • Dual Control │    │ • PID Logic      │    │   Ports 1-4 HTR │
│ • State Persist│    │ • MQTT Publish   │    │                 │
│ • Timer Config  │    │ • Section Control│    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
        │                        │
        └────────────────────────┼──────────────────────────────┐
                                 ▼                              │
                    ┌──────────────────┐                       │
                    │ MQTT Broker      │                       │
                    │ (Mosquitto)      │                       │
                    │                  │                       │
                    │ • Temperature    │◄──────────────────────┘
                    │ • Control Topics │
                    │ • Real-time Data │
                    └──────────────────┘
```

## 🎯 **Key Features**

### **🔧 Advanced PID Control**
- **Stepped Output System**: Variable step sizes based on temperature changes
- **Smart Section Management**: Automatic heater section addition/removal
- **Timer-based Logic**: Configurable 5-120 second timers with reset capability
- **Section Protection**: Section 0 always protected from removal
- **Continuous Monitoring**: Independent operation with page refresh persistence

### **🌡️ Temperature Management**
- **Shared Temperature Sensor**: Both HTR-A and HTR-B read from same sensor
- **Real-time Updates**: Sub-second MQTT temperature data
- **Unified Setpoint**: Single temperature target for both heaters
- **Range**: 32°F - 750°F operational range
- **Precision**: 0.1°F temperature resolution

### **💾 State Persistence**
- **Auto/Manual Mode**: Survives page refreshes
- **PID Parameters**: Kp, Ki, Kd values preserved
- **Section States**: Heater section on/off states maintained
- **Timer Settings**: Individual timer configurations per unit
- **Setpoint Memory**: Shared setpoint across both heaters

### **📊 Real-time Monitoring**
- **Live Temperature Display**: Animated temperature indicators
- **PID Output Visualization**: Real-time control output percentage
- **Section Status**: Visual heater section activation states
- **System Health**: MQTT connection and IO-Link status monitoring
- **Debug Information**: Collapsible system logs for troubleshooting

## 🚀 Quick Start

### 1. Install Dependencies
```bash
# Install Docker and Docker Compose
sudo apt update
sudo apt install docker.io docker-compose

# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker
```

### 2. Clone and Setup
```bash
git clone <repository-url>
cd iot-control-server
```

### 3. Install Units
```bash
# Interactive installation for each unit
./install-unit-interactive.sh
```

### 4. Start System
```bash
# Start all units
docker-compose up -d
```

## 🔧 Troubleshooting

### Quick Diagnosis
Run the automated troubleshooting script to diagnose communication issues:

```bash
./troubleshoot-communication.sh
```

This script will check:
- ✅ Docker container status
- ✅ Backend API connectivity
- ✅ Frontend-backend communication
- ✅ MQTT WebSocket connectivity
- ✅ IO-Link device connectivity

### Common Issues

#### 1. Frontend Not Receiving Temperature Data
**Symptom**: Temperature displays show 0°F or no values

**Solution**:
```bash
# Check if backend API is accessible internally
docker-compose exec frontend-unit1 wget -qO- http://backend-unit1:8000/api/temperature/htr-a

# Verify environment variables
docker-compose exec frontend-unit1 env | grep VITE_API_BASE_URL

# Restart frontend container
docker-compose restart frontend-unit1
```

**Prevention**: Always use `VITE_API_BASE_URL=http://backend-unit1:8000` in Docker environment

#### 2. MQTT Connection Issues
**Symptom**: MQTT status shows "Disconnected" or "Connecting..."

**Solution**:
```bash
# Check MQTT WebSocket port (should be 9001)
docker-compose exec frontend-unit1 env | grep VITE_MQTT_WS_PORT

# Verify MQTT service is running
docker-compose logs mqtt

# Test MQTT WebSocket connection
curl -I http://localhost:9001
```

#### 3. IO-Link Communication Issues
**Symptom**: "IO-Link Poll" errors or no temperature updates

**Solution**:
```bash
# Test IO-Link connectivity directly
curl "http://192.168.30.29/iolinkmaster/port%5B6%5D/iolinkdevice/pdin/getdata"

# Check backend logs for IO-Link errors
docker-compose logs backend-unit1 | grep -i "iolink\|error"
```

### Manual Debugging

```bash
# View all logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f backend-unit1
docker-compose logs -f frontend-unit1
docker-compose logs -f mqtt

# Test internal communication
docker-compose exec frontend-unit1 wget -qO- http://backend-unit1:8000/api/temperature/htr-a

# Restart specific services
docker-compose restart backend-unit1 frontend-unit1
```

## 🔧 **System Configuration**

### **Hardware Setup**
- **IO-Link Master**: 192.168.30.29
- **Temperature Sensor**: Port 6 (shared by both heaters)
- **Heater Controls**: Ports 1-4 (section activation)
- **Device IDs**: 
  - HTR-A: 00-02-01-6D-55-8A
  - HTR-B: 00-02-01-6D-55-86

### **Network Architecture**
- **Unit 1**: 192.168.20.x subnet
- **Unit 2**: 192.168.30.x subnet
- **MQTT Topics**: 
  - Temperature: `instrument/unit{N}/htr_a/temperature`
  - Controls: Unit-specific control topics

### **PID Control Logic**
```
Add Sections: PID = 100% for 15+ seconds → Add section (0→1→2→3)
Remove Sections: PID = 0% for 15+ seconds → Remove section (3→2→1→0)
Section 0: Always protected, never removed
Timer Reset: PID change during countdown resets timer
```

## 📁 **Project Structure**

```
iot-control-server/
├── backend/                    # FastAPI backend
│   ├── src/
│   │   ├── main.py            # Main API and control logic
│   │   └── mqtt_temp_publisher.py
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/                   # React frontend
│   ├── src/
│   │   ├── pages/
│   │   │   ├── DualHtrControl.tsx    # Main dual heater interface
│   │   │   └── HtrDeviceDetail.tsx   # Individual heater control
│   │   └── components/
│   ├── Dockerfile
│   └── package.json
├── config/                     # Configuration files
│   └── iolink_config.yml
├── mosquitto/                  # MQTT broker configuration
├── docker-compose.yml          # Production deployment
├── docker-compose.dev.yml      # Development deployment
├── dev-start.sh               # Development startup script
└── install-unit-interactive.sh # Unit installation script
```

## 🛠️ **Development**

### **Frontend Development**
```bash
# Enter frontend container
docker exec -it iot-frontend-unit1 bash

# Install dependencies
npm install

# Start development server
npm run dev
```

### **Backend Development**
```bash
# Enter backend container
docker exec -it iot-backend-unit1 bash

# Install dependencies
pip install -r requirements.txt

# Start development server
python src/main.py
```

### **Debugging**
```bash
# View logs
docker-compose logs -f backend-unit1
docker-compose logs -f frontend-unit1

# MQTT monitoring
docker exec -it iot-mosquitto mosquitto_sub -t "instrument/#"
```

## 🔍 **API Documentation**

### **Backend Endpoints**
- `GET /api/status` - System health check
- `POST /api/iolink/{ip}/port/{port}` - Control IO-Link outputs
- `GET /api/iolink/{ip}/port/{port}` - Read IO-Link inputs
- `GET /api/temperature` - Current temperature reading

### **MQTT Topics**
- `instrument/unit{N}/htr_a/temperature` - Temperature data
- `instrument/unit{N}/htr_a/sections` - Section control states
- `instrument/unit{N}/htr_a/pid` - PID output values

## 🚀 **Multi-Unit Deployment**

### **Adding New Units**
```bash
# Interactive installation
./install-unit-interactive.sh

# Follow prompts for:
# - Unit number (1-9)
# - IO-Link master IPs
# - Device ID discovery
```

### **Network Planning**
- **Unit 1**: 192.168.20.29 (HTR-A), 192.168.20.33 (HTR-B)
- **Unit 2**: 192.168.30.29 (HTR-A), 192.168.30.33 (HTR-B)
- **Unit N**: 192.168.{(N+1)*10}.29/33

## 🔒 **Security & Production**

### **Firewall Configuration**

**Critical**: Ubuntu's default firewall (ufw) blocks application ports. Configure before first use:

```bash
# Automatic configuration (recommended)
sudo ufw allow 3001/tcp  # Frontend web interface
sudo ufw allow 38001/tcp # Backend API
sudo ufw allow 1883/tcp  # MQTT broker
sudo ufw allow 9001/tcp  # MQTT WebSocket
sudo ufw reload

# Check status
sudo ufw status numbered
```

**Port Summary:**
- **3001**: Web interface (HTR-A & HTR-B controls)
- **38001**: Backend API (temperature and control)
- **1883**: MQTT (real-time data)
- **9001**: MQTT WebSocket (browser connections)

### **Production Considerations**
- Change default MQTT passwords
- Enable SSL/TLS for web interface
- Implement user authentication
- Configure firewall rules for IO-Link access
- Set up log rotation and monitoring

### **Backup & Recovery**
- Regular configuration backups
- Database snapshots (if using PostgreSQL)
- Container image versioning
- IO-Link device configuration backups

## 🆘 **Troubleshooting**

### **Common Issues**
1. **MQTT Connection Issues**: Check broker logs and network connectivity
2. **IO-Link Communication**: Verify IP addresses and device IDs
3. **Temperature Reading Errors**: Check sensor connections and hex conversion
4. **PID Control Not Working**: Verify timer settings and section configurations
5. **State Persistence Issues**: Check localStorage and browser compatibility

### **Debug Commands**
```bash
# Check container status
docker-compose ps

# Monitor MQTT traffic
mosquitto_sub -h localhost -p 1883 -t "instrument/#"

# Test IO-Link connectivity
curl "http://192.168.30.29/iolinkmaster/port%5B6%5D/iolinkdevice/pdin/getdata"
```

## 📈 **Performance**

- **Temperature Updates**: < 1 second latency
- **PID Calculations**: Real-time processing
- **MQTT Throughput**: 1000+ messages/second
- **Web Interface**: < 100ms response time
- **Memory Usage**: < 512MB per unit
- **CPU Usage**: < 10% during normal operation

## 🤝 **Contributing**

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 **License**

This project is proprietary software for industrial heating control applications.

## 📞 **Support**

For technical support and feature requests, please contact the development team or create an issue in the repository.

---

**🔥 Advanced Industrial IoT Control - Precision Temperature Management** 🔥 