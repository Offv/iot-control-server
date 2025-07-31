# IoT Control System - Interactive Installation Guide

## 🎯 Overview

This guide explains how to install units with **automatic IO-Link device ID discovery** during the installation process. Each unit can have different IO-Link devices with unique device IDs, and this system helps you get the correct IDs automatically.

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
2. **Calculates Subnet** automatically (Unit 1 = 20.x.x.x, Unit 2 = 30.x.x.x, etc.)
3. **Tests Network Connectivity** to IO-Link masters
4. **Discovers Device IDs** automatically from IO-Link masters
5. **Validates Input** (IP addresses, device ID format)
6. **Generates Configuration** files for the unit
7. **Provides Access URLs** for the new unit

### Example Installation Session:

```bash
🔧 IoT Control System - Interactive Unit Installation
=====================================================
[INPUT] Enter the unit number (1-9): 1
[SUCCESS] Unit number: 1
[INFO] Unit 1 will use subnet: 20.x.x.x

=== HTR-A Configuration ===
[INPUT] Enter IP address for HTR-A (IO-Link A) [default: 20.29]: 192.168.1.29
[INFO] Testing connection to HTR-A at 192.168.1.29...
[SUCCESS] Network connectivity to 192.168.1.29 is OK
[INFO] Using automated discovery tool...
[INFO] Running automated device ID discovery...
✅ Device ID automatically discovered: 00-02-01-6D-55-8A
[INPUT] Use this device ID? (Y/n): Y

=== HTR-B Configuration ===
[INPUT] Enter IP address for HTR-B (IO-Link B) [default: 20.33]: 192.168.1.33
[INFO] Testing connection to HTR-B at 192.168.1.33...
[SUCCESS] Network connectivity to 192.168.1.33 is OK
[INFO] Using automated discovery tool...
[INFO] Running automated device ID discovery...
✅ Device ID automatically discovered: 00-02-01-6D-55-86
[INPUT] Use this device ID? (Y/n): Y

=== Installation Summary ===
Unit Number: 1
Subnet: 20.x.x.x
HTR-A: 192.168.1.29 (Device ID: 00-02-01-6D-55-8A)
HTR-B: 192.168.1.33 (Device ID: 00-02-01-6D-55-86)
Domain: unit1htr.system

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
2. **`config/unit<N>_config.yml`** - Unit configuration

### Example Unit Configuration

```yaml
# Unit 1 Configuration
unit:
  name: unit1
  number: 1
  domain: unit1htr.system
  subnet: 20

htr_a:
  ip: 192.168.1.29
  device_id: 00-02-01-6D-55-8A
  temp_port: 6
  temp_topic: instrument/unit1/htr_a/temperature

htr_b:
  ip: 192.168.1.33
  device_id: 00-02-01-6D-55-86
  temp_port: 6
  temp_topic: instrument/unit1/htr_b/temperature
```

## 🌐 Network Architecture

### Subnet Allocation

- **Unit 1**: 20.x.x.x (HTR-A: 20.29, HTR-B: 20.33)
- **Unit 2**: 30.x.x.x (HTR-A: 30.29, HTR-B: 30.33)
- **Unit 3**: 40.x.x.x (HTR-A: 40.29, HTR-B: 40.33)
- **Unit 4**: 50.x.x.x (HTR-A: 50.29, HTR-B: 50.33)
- **...and so on**

### Domain Names

- **Unit 1**: `unit1htr.system`
- **Unit 2**: `unit2htr.system`
- **Unit 3**: `unit3htr.system`
- **...and so on**

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

### Method 2: Add to Main docker-compose.dev.yml

Copy the services from `docker-compose.unit<N>.yml` to the main `docker-compose.dev.yml` file.

## 🔗 Access URLs

After installation, each unit is accessible at:

### Unit 1
- **Frontend**: http://localhost (or http://unit1htr.system)
- **Backend API**: http://localhost/api
- **Direct Backend**: http://localhost:38001
- **Direct Frontend**: http://localhost:33001

### Unit 2
- **Frontend**: http://unit2htr.system
- **Backend API**: http://unit2htr.system/api
- **Direct Backend**: http://localhost:38002
- **Direct Frontend**: http://localhost:33002

## 🛠️ Troubleshooting

### Device Discovery Issues

1. **Network Connectivity**:
   ```bash
   # Test connectivity
   ping <io-link-ip>
   ```

2. **Web Interface Access**:
   ```bash
   # Try accessing web interface
   curl http://<io-link-ip>
   ```

3. **Manual Device ID Discovery**:
   ```bash
   # Use the discovery tool manually
   python3 iolink-discovery.py <ip_address>
   ```

### Common Issues

1. **"Cannot reach the device"**:
   - Check device power
   - Verify network cable connection
   - Confirm IP address is correct
   - Ensure device is on the same network

2. **"Invalid device ID format"**:
   - Use format: `XX-XX-XX-XX-XX-XX`
   - Example: `00-02-01-6D-55-8A`
   - Copy exactly from IO-Link master interface

3. **"Automated discovery failed"**:
   - Check if Python3 and requests are installed
   - Try manual discovery
   - Verify IO-Link master web interface is accessible

## 📋 Development Commands

```bash
# View all logs
docker-compose -f docker-compose.dev.yml logs -f

# View specific unit logs
docker-compose -f docker-compose.dev.yml logs -f backend-unit1
docker-compose -f docker-compose.dev.yml logs -f backend-unit2

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

4. **Update nginx configuration** to include the new unit

## 🎯 Benefits of This Approach

1. **✅ Automatic Device ID Discovery** - No more manual copying
2. **✅ Network Validation** - Tests connectivity before installation
3. **✅ Input Validation** - Ensures correct formats
4. **✅ Isolated Environment** - No impact on your Mac
5. **✅ Scalable** - Easy to add more units
6. **✅ Real-time Configuration** - Live updates during development
7. **✅ Domain-based Access** - Clean URLs for each unit

This system ensures that each unit gets the correct device IDs from its actual IO-Link masters, preventing configuration errors and ensuring accurate data collection! 