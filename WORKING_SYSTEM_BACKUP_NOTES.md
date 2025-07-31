# WORKING SYSTEM BACKUP - Real Instrument Configuration
**Date**: July 19, 2025  
**System**: iot-control-server3  
**Status**: ✅ PRODUCTION READY with Real Instruments

## 🎯 System Overview
This is the **WORKING PRODUCTION SYSTEM** with real instrument integration, NOT simulation.
All configurations are tested and functional with actual IO-Link devices.

## 🔧 Real Instrument Configuration

### IO-Link Master Setup
- **Primary IO-Link Master IP**: `192.168.30.29`
- **Temperature Sensor Port**: 6 (`port[6]/iolinkdevice/pdin`)
- **Device IDs**:
  - HTR-A: `00-02-01-6D-55-8A`
  - HTR-B: `00-02-01-6D-55-86`
- **Max Temperatures**:
  - HTR-A: 1200°F
  - HTR-B: 800°F

### Real Data Flow
```
IO-Link Master (192.168.30.29) 
  ↓ Port 6 Temperature Sensor
  ↓ Hex Data: 031B (real sensor data)
  ↓ Backend Conversion: 031B → 795 → 79.5°F
  ↓ MQTT Topics: instruments_ti, instrument/htr_a
  ↓ Frontend Real-time Display
```

## 📁 Critical Files & Configurations

### 1. Backend Configuration
**File**: `backend/src/main.py`
- Real HTTP polling from IO-Link master every 1 second
- URL: `http://192.168.30.29/iolinkmaster/port%5B6%5D/iolinkdevice/pdin/getdata`
- Hex to Fahrenheit conversion: `decimal_value / 10.0`
- MQTT publishing to real topics

### 2. IO-Link Configuration
**File**: `config/iolink_config.yml`
```yaml
devices:
  temperature_sensor:
    master_ip: "192.168.30.29"
    port: 6
    mqtt_topic: "iolink/#"
    data_type: "temperature"
    unit: "celsius"
    update_rate: 1000
    scaling_factor: 0.1
```

### 3. Frontend Configuration
**File**: `frontend/src/pages/HtrDeviceDetail.tsx`
- MQTT WebSocket: `ws://192.168.2.107:9001`
- Real temperature subscription: `instrument/htr_a`
- IO-Link port mapping for 4 heater sections
- PID control system with real feedback

### 4. MQTT Configuration
**Topics**:
- `instruments_ti` - Processed temperature data
- `instrument/htr_a` - Raw hex temperature data
- `iolink/#` - IO-Link debug data

**WebSocket Port**: 9001

### 5. Docker Configuration
**File**: `docker-compose.yml`
- MQTT Broker: eclipse-mosquitto:2.0
- Backend: Python FastAPI with real IO-Link integration
- Frontend: React + Tailwind CSS v3.3.0 + MUI
- Database: TimescaleDB for time-series data
- Test Publisher: Disabled (to avoid conflicts with real data)

## 🏗️ Architecture Components

### Services Running
1. **mqtt-broker** (eclipse-mosquitto:2.0)
   - Ports: 1883 (MQTT), 9001 (WebSocket)
   
2. **backend** (Python FastAPI)
   - Port: 8000
   - Real IO-Link polling every 1 second
   - MQTT client for publishing temperature data
   
3. **frontend** (React + Nginx)
   - Port: 3000
   - Tailwind CSS v3.3.0 + Material-UI
   - Real-time MQTT WebSocket connection
   
4. **timescaledb** (PostgreSQL + TimescaleDB)
   - Port: 5432
   - Time-series data storage
   
5. **mqtt-test-publisher** (Disabled)
   - Disabled to avoid conflicts with real sensor data

### Dependencies
**Frontend** (`frontend/package.json`):
- React 19.1.0
- Tailwind CSS 3.3.0
- Material-UI 7.1.0
- MQTT.js 5.13.1
- React Router DOM 7.6.1

**Backend** (`backend/requirements.txt`):
- FastAPI
- paho-mqtt
- pycomm3 (for PLC communication)
- aiohttp (for IO-Link HTTP requests)
- PyYAML

## 🔄 Real Data Processing

### Temperature Conversion
```python
# Real hex data from IO-Link sensor
hex_value = "031B"  # From port 6
decimal_value = int(hex_value, 16)  # 795
temp_f = decimal_value / 10.0  # 79.5°F
```

### MQTT Message Format
```json
{
  "code": "event",
  "cid": 123,
  "adr": "/instruments_ti",
  "data": {
    "eventno": "1234567890",
    "srcurl": "00-02-01-6D-55-8A/timer[1]/counter/datachanged",
    "payload": {
      "/processdatamaster/temperature": {
        "code": 200,
        "data": 79.5
      }
    }
  }
}
```

## 🎛️ Heater Control System

### IO-Link Port Mapping
- **Section 1**: `port[1]/iolinkdevice/pdout`
- **Section 2**: `port[2]/iolinkdevice/pdout`
- **Section 3**: `port[3]/iolinkdevice/pdout`
- **Section 4**: `port[4]/iolinkdevice/pdout`
- **PID Pulse**: `port[5]/iolinkdevice/pdout`
- **Temperature Sensor**: `port[6]/iolinkdevice/pdin`

### Control Features
- 4 independent heater sections
- PID control with configurable Kp, Ki, Kd
- Auto/Manual mode switching
- Temperature trend tracking (rising/falling/stable)
- Section change timing (15 seconds)
- Pulse modulation for fine control

## 🔌 API Endpoints

### Backend API
- `GET /api/status` - System status
- `GET /api/temperature` - Current temperature reading
- `POST /api/iolink/port/{port_num}/setdata` - Control IO-Link outputs
- `POST /api/plc/connect` - PLC connection
- `GET /api/plc/{ip_address}/tags` - Read PLC tags
- `POST /api/plc/{ip_address}/write` - Write PLC tags
- `WebSocket /ws` - Real-time updates

## 🚨 Critical Notes

### 1. Real Instrument Dependencies
- IO-Link Master must be accessible at `192.168.30.29`
- Temperature sensor must be connected to port 6
- Device IDs are hardware-specific and cannot be changed

### 2. Network Configuration
- MQTT WebSocket must be accessible on port 9001
- Backend must have network access to IO-Link master
- Frontend must connect to MQTT broker via WebSocket

### 3. Data Processing
- Temperature conversion is hardware-specific (hex → decimal → Fahrenheit)
- Polling rate is 1 second (critical for real-time control)
- MQTT QoS level 1 for reliable message delivery

### 4. Frontend Features
- Real-time temperature display in top-right corner
- Heater control interface with 4 sections
- PID parameter configuration
- Auto/Manual mode switching
- Temperature trend visualization
- Debug logging for troubleshooting

## 📋 Migration Checklist for Kubernetes

When upgrading to Kubernetes, ensure these configurations are preserved:

- [ ] IO-Link master IP addresses
- [ ] Device IDs and port mappings
- [ ] MQTT topic structure
- [ ] Temperature conversion logic
- [ ] Polling intervals
- [ ] API endpoint structure
- [ ] Frontend MQTT WebSocket connection
- [ ] Database schema for time-series data
- [ ] Heater control logic
- [ ] PID control parameters

## 🔒 Security Considerations

- IO-Link master is on internal network (192.168.30.x)
- MQTT broker should be secured in production
- Database credentials should be managed via secrets
- API endpoints should have proper authentication

## 📞 Troubleshooting

### Common Issues
1. **Temperature not updating**: Check IO-Link master connectivity
2. **MQTT connection failed**: Verify WebSocket port 9001
3. **Heater sections not responding**: Check IO-Link port configuration
4. **Database connection errors**: Verify TimescaleDB credentials

### Debug Information
- Backend logs show real temperature conversions
- Frontend debug panel shows MQTT connection status
- IO-Link configuration is loaded from YAML file
- All real sensor data is logged with timestamps

---
**⚠️ IMPORTANT**: This system is PRODUCTION READY with REAL INSTRUMENTS.
Do not modify without thorough testing. All configurations are hardware-specific. 