# IoT Control Server v1.02
## Discovery-Based Multi-Unit Installation System

### 📅 **Release Date**: August 1, 2025
### 🏷️ **Version**: v1.02
### 🎯 **Branch**: `v1.02-installation-fixes`

---

## 🚀 **What's New in v1.02**

### **Discovery-Based Installation** 🔍
- **Automatic Device Discovery**: Scan network for IO-Link devices
- **MAC Address Validation**: User-confirmed device identification
- **Multi-Unit Support**: Install unlimited units and heaters
- **Scalable Architecture**: Add devices one by one

### **Enhanced Reliability** 🛡️
- **Database Storage**: Persistent device registry
- **MAC-Based Commands**: Reliable device identification
- **Auto-Start System**: Proper systemd service integration
- **Error Handling**: Robust installation process

### **Improved Usability** 🎯
- **Interactive Installation**: Clear user prompts
- **Progress Tracking**: Real-time installation status
- **Configuration Management**: Easy device assignment
- **Troubleshooting Tools**: Built-in diagnostics

---

## 🏗️ **System Architecture**

### **Discovery Flow**
```
Network Scan → Device Detection → MAC Extraction → User Validation → Unit Assignment → Database Storage
```

### **Multi-Unit Structure**
```
Unit 1 (192.168.20.x)
├── HTR-A (MAC: AA:BB:CC:DD:EE:01)
│   ├── Port 1: Section 1 (Protected)
│   ├── Port 2: Section 2
│   ├── Port 3: Section 3
│   └── Port 4: Section 4
├── HTR-B (MAC: AA:BB:CC:DD:EE:02)
│   ├── Port 1: Section 1 (Protected)
│   ├── Port 2: Section 2
│   ├── Port 3: Section 3
│   └── Port 4: Section 4
└── Temperature Sensor (Port 6)

Unit 2 (192.168.21.x)
├── HTR-A (MAC: AA:BB:CC:DD:EE:03)
├── HTR-B (MAC: AA:BB:CC:DD:EE:04)
└── Temperature Sensor (Port 6)

Unit N (192.168.N.x)
├── HTR-A (MAC: AA:BB:CC:DD:EE:XX)
├── HTR-B (MAC: AA:BB:CC:DD:EE:YY)
└── Temperature Sensor (Port 6)
```

---

## 📋 **Installation Guide**

### **Prerequisites**
- Linux system (Ubuntu 20.04+ recommended)
- Python 3.8+
- Docker and Docker Compose
- Network access to IO-Link devices
- Root or sudo access

### **Quick Installation**

#### **Step 1: Clone Repository**
```bash
git clone https://github.com/your-repo/iot-control-server.git
cd iot-control-server
git checkout v1.02-installation-fixes
```

#### **Step 2: Run Discovery Installation**
```bash
# Full discovery-based installation
./install-v1.02.sh --mode=discovery --backup

# Or step by step
./install-v1.02.sh --no-discovery  # Skip discovery
./install-v1.02.sh --no-auto-start # Skip auto-start
./install-v1.02.sh --no-firewall   # Skip firewall
```

#### **Step 3: Configure Units**
```bash
# Configure Unit 1
./configure-unit.sh --unit=1 --subnet=20 --host-ip=192.168.20.100

# Configure Unit 2
./configure-unit.sh --unit=2 --subnet=30 --host-ip=192.168.30.100

# Configure additional units as needed
./configure-unit.sh --unit=3 --subnet=25 --host-ip=192.168.25.100
```

### **Manual Installation**

#### **Step 1: System Check**
```bash
# Check system requirements
./install-v1.02.sh --help
```

#### **Step 2: Device Discovery**
```bash
# Run discovery script
python3 iolink-discovery-v2.py
```

#### **Step 3: Review Discovered Devices**
```bash
# View discovered devices
cat discovered_devices.json
```

#### **Step 4: Configure Units**
```bash
# Configure each unit based on discovered devices
./configure-unit.sh --unit=1 --subnet=20 --host-ip=192.168.20.100
```

---

## 🔧 **Configuration**

### **Device Discovery**
The discovery system automatically:
- Scans common subnets (192.168.20.x, 192.168.21.x, etc.)
- Detects IO-Link devices
- Extracts MAC addresses
- Validates with user confirmation
- Assigns to units

### **Unit Configuration**
Each unit gets:
- Dedicated Docker Compose configuration
- Isolated network
- Unique ports
- Database schema
- MQTT topics

### **Port Mapping**
- **Port 1-4**: Heater sections (Port 1 protected)
- **Port 5**: PID output control
- **Port 6**: Temperature sensor

### **MQTT Topics**
```
instrument/unit{N}/htr_{type}/temperature
instrument/unit{N}/htr_{type}/status
instrument/unit{N}/htr_{type}/command
```

---

## 🗄️ **Database Schema**

### **Device Registry**
```sql
CREATE TABLE device_registry (
    id SERIAL PRIMARY KEY,
    mac_address VARCHAR(17) UNIQUE,
    ip_address VARCHAR(15),
    subnet INTEGER,
    unit_number INTEGER,
    heater_type VARCHAR(10),
    device_name VARCHAR(100),
    is_validated BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### **Unit Configuration**
```sql
CREATE TABLE unit_config (
    id SERIAL PRIMARY KEY,
    unit_number INTEGER UNIQUE,
    subnet INTEGER,
    host_ip VARCHAR(15),
    mqtt_port INTEGER DEFAULT 1883,
    frontend_port INTEGER,
    backend_port INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### **Heater Configuration**
```sql
CREATE TABLE heater_config (
    id SERIAL PRIMARY KEY,
    unit_number INTEGER,
    heater_type VARCHAR(10),
    device_mac VARCHAR(17),
    device_ip VARCHAR(15),
    max_temperature INTEGER DEFAULT 750,
    timer_duration INTEGER DEFAULT 15,
    mqtt_topic VARCHAR(200),
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 🚀 **Usage**

### **Starting Services**
```bash
# Start all units
docker-compose -f docker-compose-unit1.yml up -d
docker-compose -f docker-compose-unit2.yml up -d

# Or start specific unit
docker-compose -f docker-compose-unit1.yml up -d
```

### **Accessing Interfaces**
```
Unit 1: http://192.168.20.100:33001
Unit 2: http://192.168.30.100:33002
Unit N: http://192.168.N.100:3300N
```

### **Managing Devices**
```bash
# View all devices
docker exec iot-postgres-v102 psql -U iot_user -d iot_control_v102 -c "SELECT * FROM active_devices;"

# View unit summary
docker exec iot-postgres-v102 psql -U iot_user -d iot_control_v102 -c "SELECT * FROM unit_summary;"

# View heater summary
docker exec iot-postgres-v102 psql -U iot_user -d iot_control_v102 -c "SELECT * FROM heater_summary;"
```

---

## 🔍 **Troubleshooting**

### **Discovery Issues**
```bash
# Check discovery log
cat discovery.log

# Run discovery manually
python3 iolink-discovery-v2.py

# Check network connectivity
ping 192.168.20.29
```

### **Service Issues**
```bash
# Check service status
docker-compose -f docker-compose-unit1.yml ps

# View service logs
docker-compose -f docker-compose-unit1.yml logs

# Restart services
docker-compose -f docker-compose-unit1.yml restart
```

### **Database Issues**
```bash
# Check database connection
docker exec iot-postgres-v102 pg_isready -U iot_user -d iot_control_v102

# View database logs
docker logs iot-postgres-v102

# Reset database (WARNING: Data loss)
docker-compose -f docker-compose-unit1.yml down
docker volume rm iot-control-server_postgres_data_unit1
```

### **Network Issues**
```bash
# Check firewall
sudo ufw status

# Check ports
ss -tlnp | grep :33001
ss -tlnp | grep :38001

# Test connectivity
curl http://localhost:38001/health
```

---

## 📊 **Monitoring**

### **Service Health**
```bash
# Check all services
./scripts/check-status.sh

# Monitor logs
docker-compose -f docker-compose-unit1.yml logs -f
```

### **Device Status**
```bash
# Check device connectivity
./scripts/check-devices.sh

# Monitor MQTT messages
mosquitto_sub -h localhost -p 1883 -t "instrument/+/+/temperature"
```

### **Performance Monitoring**
```bash
# Check resource usage
docker stats

# Monitor database performance
docker exec iot-postgres-v102 psql -U iot_user -d iot_control_v102 -c "SELECT * FROM pg_stat_activity;"
```

---

## 🔄 **Updates and Maintenance**

### **Updating Installation**
```bash
# Pull latest changes
git pull origin v1.02-installation-fixes

# Update services
docker-compose -f docker-compose-unit1.yml down
docker-compose -f docker-compose-unit1.yml up -d --build
```

### **Adding New Units**
```bash
# Discover new devices
python3 iolink-discovery-v2.py

# Configure new unit
./configure-unit.sh --unit=3 --subnet=25 --host-ip=192.168.25.100
```

### **Backup and Restore**
```bash
# Create backup
./scripts/backup-system.sh

# Restore from backup
./scripts/restore-system.sh backup-file.tar.gz
```

---

## 📚 **Documentation**

### **Scripts**
- `install-v1.02.sh` - Main installation script
- `iolink-discovery-v2.py` - Device discovery script
- `configure-unit.sh` - Unit configuration script
- `database-schema-v1.02.sql` - Database schema

### **Configuration Files**
- `docker-compose-unit{N}.yml` - Unit-specific Docker Compose
- `config/unit{N}/iolink_config.yml` - IO-Link configuration
- `mosquitto/config/mosquitto-unit{N}.conf` - MQTT configuration

### **Logs and Data**
- `discovery.log` - Discovery process logs
- `discovered_devices.json` - Discovered device data
- `install-v1.02.log` - Installation logs
- `configure-unit.log` - Unit configuration logs

---

## 🆘 **Support**

### **Common Issues**
1. **Discovery fails**: Check network connectivity and firewall
2. **Services won't start**: Check Docker and port availability
3. **Database errors**: Check PostgreSQL container status
4. **MQTT issues**: Check MQTT broker configuration

### **Getting Help**
- Check logs: `cat *.log`
- Review configuration: `cat config/*/*.yml`
- Test connectivity: `ping` and `curl` commands
- Check service status: `docker ps`

### **Reporting Issues**
- Include log files
- Provide system information
- Describe steps to reproduce
- Include error messages

---

## 📄 **License**

This project is licensed under the MIT License - see the LICENSE file for details.

---

## 🎉 **Acknowledgments**

- IO-Link community for protocol documentation
- Docker team for containerization platform
- FastAPI team for backend framework
- React team for frontend framework

---

**Status**: 🟢 **READY FOR PRODUCTION** 