# IoT Dual Heater Control System - Installation Guide

## 🎯 Overview

This guide explains how to install dual heater control units with **automatic IO-Link device ID discovery** and **shared temperature sensing**. Each unit controls two heaters (HTR-A and HTR-B) that share a single temperature sensor but operate independently with sophisticated PID control.

## 🚀 Quick Start

### 1. Install Dependencies

```bash
# Install Python dependencies for device discovery
pip3 install -r requirements-discovery.txt
```

### 2. Start Development Environment

```bash
# Start the isolated Docker environment
./dev-start.sh
```

### 3. Install Units Interactively

```bash
# Install Unit 1
./install-unit-interactive.sh

# Install Unit 2
./install-unit-interactive.sh
```

## 🔧 Interactive Installation Process

### What the Installation Script Does:

1. **Prompts for Unit Number** (1-9)
2. **Calculates Subnet** automatically (Unit 1 = 192.168.20.x, Unit 2 = 192.168.30.x, etc.)
3. **Tests Network Connectivity** to IO-Link masters
4. **Discovers Device IDs** automatically from IO-Link masters
5. **Validates Input** (IP addresses, device ID format)
6. **Generates Configuration** files for the unit with shared temperature setup
7. **Provides Access URLs** for the new unit

### Example Installation Session:

```bash
🔧 IoT Dual Heater Control System - Interactive Unit Installation
===============================================================
[INPUT] Enter the unit number (1-9): 1
[SUCCESS] Unit number: 1
[INFO] Unit 1 will use subnet: 192.168.20.x

=== HTR-A Configuration ===
[INPUT] Enter IP address for HTR-A (IO-Link A) [default: 192.168.20.29]: 
[INFO] Testing connection to HTR-A at 192.168.20.29...
[SUCCESS] Network connectivity to 192.168.20.29 is OK
[INFO] Using automated discovery tool...
[INFO] Running automated device ID discovery...
✅ Device ID automatically discovered: 00-02-01-6D-55-8A
[INPUT] Use this device ID? (Y/n): Y

=== HTR-B Configuration ===
[INPUT] Enter IP address for HTR-B (IO-Link B) [default: 192.168.20.33]: 
[INFO] Testing connection to HTR-B at 192.168.20.33...
[SUCCESS] Network connectivity to 192.168.20.33 is OK
[INFO] Using automated discovery tool...
[INFO] Running automated device ID discovery...
✅ Device ID automatically discovered: 00-02-01-6D-55-86
[INPUT] Use this device ID? (Y/n): Y

=== Shared Temperature Configuration ===
[INFO] Both HTR-A and HTR-B will share temperature sensor from HTR-A
[INFO] Temperature Topic: instrument/unit1/htr_a/temperature
[INFO] Shared Setpoint: Unified temperature control for both heaters

=== Installation Summary ===
Unit Number: 1
Subnet: 192.168.20.x
HTR-A: 192.168.20.29 (Device ID: 00-02-01-6D-55-8A)
HTR-B: 192.168.20.33 (Device ID: 00-02-01-6D-55-86)
Shared Temperature: 192.168.20.29:port[6]
Domain: unit1htr.system
Max Temperature: 750°F
Timer Range: 5-120 seconds

[INPUT] Proceed with installation? (y/N): y
[INFO] Generating configuration for Unit 1...
[SUCCESS] Unit 1 configuration generated!
[INFO] Files created:
  - docker-compose.unit1.yml
  - config/unit1_config.yml
```

## 🔍 IO-Link Device ID Discovery

### Automatic Discovery

The system attempts to automatically discover device IDs from common IO-Link master web interfaces:

- **IFM**: `http://<ip>/iolink/deviceinfo`
- **Siemens**: `http://<ip>/api/iolink`
- **Phoenix Contact**: `http://<ip>/api/iolink`
- **Beckhoff**: `http://<ip>/api/iolink`
- **Generic**: Searches HTML content for device ID patterns

### Manual Discovery

If automatic discovery fails, you can manually get the device ID:

1. **Connect to IO-Link Master Web Interface**:
   ```
   http://<ip_address>
   ```

2. **Navigate to Device Information**:
   - Look for "Device Information" or "Connected Devices"
   - Find "Device ID" or "IO-Link Device ID"
   - Copy the ID in format: `XX-XX-XX-XX-XX-XX`

3. **Common Locations**:
   - **IFM**: Device Info → IO-Link → Device ID
   - **Siemens**: Diagnostics → IO-Link → Device Information
   - **Phoenix Contact**: IO-Link → Device Status → Device ID
   - **Beckhoff**: IO-Link → Device Information → Device ID

## 📁 Generated Files

### Unit Configuration Files

For each unit, the installation creates:

1. **`docker-compose.unit<N>.yml`** - Unit-specific Docker services
2. **`config/unit<N>_config.yml`** - Unit configuration with shared temperature

### Example Unit Configuration

```yaml
# Unit 1 Configuration
unit:
  name: unit1
  number: 1
  domain: unit1htr.system
  subnet: 20
  max_temperature: 750  # Updated temperature limit

htr_a:
  ip: 192.168.20.29
  device_id: 00-02-01-6D-55-8A
  temp_port: 6
  temp_topic: instrument/unit1/htr_a/temperature
  sections: [1, 2, 3, 4]  # IO-Link ports for heater sections

htr_b:
  ip: 192.168.20.33
  device_id: 00-02-01-6D-55-86
  temp_port: 6  # Shares temperature with HTR-A
  temp_topic: instrument/unit1/htr_a/temperature  # Shared temperature topic
  sections: [1, 2, 3, 4]  # IO-Link ports for heater sections

shared_config:
  setpoint_key: unit1_shared_setpoint  # Unified setpoint storage
  timer_range: [5, 120]  # Timer configuration range in seconds
  pid_defaults:
    kp: 2.0
    ki: 0.1
    kd: 0.05
```

## 🌐 Network Architecture

### Updated Subnet Allocation

- **Unit 1**: 192.168.20.x (HTR-A: 192.168.20.29, HTR-B: 192.168.20.33)
- **Unit 2**: 192.168.30.x (HTR-A: 192.168.30.29, HTR-B: 192.168.30.33)
- **Unit 3**: 192.168.40.x (HTR-A: 192.168.40.29, HTR-B: 192.168.40.33)
- **Unit 4**: 192.168.50.x (HTR-A: 192.168.50.29, HTR-B: 192.168.50.33)
- **...and so on**

### Domain Names

- **Unit 1**: `unit1htr.system`
- **Unit 2**: `unit2htr.system`
- **Unit 3**: `unit3htr.system`
- **...and so on**

### Shared Temperature Configuration

Each unit uses **shared temperature sensing**:
- Both HTR-A and HTR-B read from HTR-A's temperature sensor
- Single MQTT topic: `instrument/unit{N}/htr_a/temperature`
- Unified setpoint controls both heaters
- Independent section control for each heater

## 🚀 Deploying Units

### Method 1: Using Docker Compose Override

```bash
# Deploy Unit 1
docker-compose -f docker-compose.dev.yml -f docker-compose.unit1.yml up -d

# Deploy Unit 2
docker-compose -f docker-compose.dev.yml -f docker-compose.unit2.yml up -d

# Deploy both units
docker-compose -f docker-compose.dev.yml -f docker-compose.unit1.yml -f docker-compose.unit2.yml up -d
```

### Method 2: Production Single Unit

```bash
# Single unit production deployment
docker-compose up -d
```

## 🔗 Access URLs

After installation, each unit is accessible at:

### Unit 1
- **Dual Control Interface**: http://localhost (or http://unit1htr.system)
- **Backend API**: http://localhost/api
- **Direct Backend**: http://localhost:38001
- **Direct Frontend**: http://localhost:33001

### Unit 2
- **Dual Control Interface**: http://unit2htr.system
- **Backend API**: http://unit2htr.system/api
- **Direct Backend**: http://localhost:38002
- **Direct Frontend**: http://localhost:33002

## 🎛️ Advanced Features

### PID Control Configuration

Each unit supports advanced PID control with:

```yaml
pid_control:
  stepped_output: true
  section_protection: true  # Section 0 never removed
  timer_based_logic: true
  continuous_monitoring: true
  
add_logic:
  trigger: "PID >= 100% for timer duration"
  sequence: "0 → 1 → 2 → 3"
  timer_reset: "On PID change during countdown"

remove_logic:
  trigger: "PID <= 0% for timer duration"
  sequence: "3 → 2 → 1 → 0"
  protection: "Section 0 always protected"
```

### State Persistence

All critical settings are automatically saved:

```yaml
persistent_settings:
  - auto_manual_mode
  - setpoint_value
  - pid_parameters
  - section_states
  - timer_configurations
  - control_mode
```

### Timer Configuration

Individual timer settings per unit:

```yaml
timer_settings:
  unit1htratime: 15  # HTR-A timer in seconds
  unit1htrbtime: 15  # HTR-B timer in seconds
  range: [5, 120]    # Configurable range
  reset_on_pid_change: true
```

## 🛠️ Troubleshooting

### Device Discovery Issues

1. **Network Connectivity**:
   ```bash
   # Test connectivity with full IP addresses
   ping 192.168.20.29
   ping 192.168.20.33
   ```

2. **Web Interface Access**:
   ```bash
   # Try accessing web interface
   curl "http://192.168.20.29"
   ```

3. **Manual Device ID Discovery**:
   ```bash
   # Use the discovery tool manually
   python3 iolink-discovery.py 192.168.20.29
   ```

### Common Issues

1. **"Cannot reach the device"**:
   - Check device power
   - Verify network cable connection
   - Confirm full IP address format (192.168.x.x)
   - Ensure device is on the correct subnet

2. **"Shared Temperature Not Working"**:
   - Verify HTR-A temperature sensor is connected to port 6
   - Check MQTT topic configuration
   - Confirm both heaters are subscribing to the same temperature topic

3. **"State Persistence Not Working"**:
   - Check browser localStorage support
   - Verify unique storage keys for each unit
   - Clear browser cache if needed

4. **"Timer Settings Not Saving"**:
   - Confirm timer range is 5-120 seconds
   - Check individual unit timer storage keys
   - Verify PID tuning panel timer input

### Advanced Debugging

```bash
# View all logs
docker-compose -f docker-compose.dev.yml logs -f

# View specific unit logs
docker-compose -f docker-compose.dev.yml logs -f backend-unit1
docker-compose -f docker-compose.dev.yml logs -f backend-unit2

# Monitor MQTT traffic
docker exec -it iot-mosquitto mosquitto_sub -t "instrument/#"

# Test shared temperature
curl "http://192.168.20.29/iolinkmaster/port%5B6%5D/iolinkdevice/pdin/getdata"

# Restart specific units
docker-compose -f docker-compose.dev.yml restart backend-unit1 frontend-unit1
docker-compose -f docker-compose.dev.yml restart backend-unit2 frontend-unit2

# Stop environment
./dev-stop.sh
```

## 🔄 Adding More Units

To add additional units:

1. **Run the installation script**:
   ```bash
   ./install-unit-interactive.sh
   ```

2. **Follow the prompts** for the new unit number

3. **Deploy the new unit**:
   ```bash
   docker-compose -f docker-compose.dev.yml -f docker-compose.unit<N>.yml up -d
   ```

4. **Update nginx configuration** to include the new unit domain

## 🎯 Benefits of This System

1. **✅ Shared Temperature Sensing** - Unified temperature reading for both heaters
2. **✅ Automatic Device ID Discovery** - No more manual copying
3. **✅ Network Validation** - Tests connectivity before installation
4. **✅ Input Validation** - Ensures correct formats and IP addresses
5. **✅ State Persistence** - All settings survive page refreshes
6. **✅ Advanced PID Control** - Sophisticated section management
7. **✅ Scalable Architecture** - Easy to add more units
8. **✅ Timer Flexibility** - Individual timer settings per unit
9. **✅ Domain-based Access** - Clean URLs for each unit
10. **✅ Real-time Updates** - Sub-second temperature monitoring

## 📋 Pre-Installation Checklist

- [ ] Docker and Docker Compose installed
- [ ] Network connectivity to IO-Link masters
- [ ] Correct subnet configuration (192.168.x.x)
- [ ] IO-Link devices powered and connected
- [ ] Temperature sensor connected to port 6
- [ ] Heater sections connected to ports 1-4
- [ ] Web browser with localStorage support

This installation system ensures that each unit gets the correct device IDs from its actual IO-Link masters, implements shared temperature sensing, and provides all the advanced control features for precise industrial heating management! 