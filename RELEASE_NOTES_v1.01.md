# IoT Control Server - Version 1.01 Release Notes

## Release Date: August 1, 2025

### 🎉 Version 1.01 - Stable Release

This version represents a major milestone with a complete system overhaul, MQTT integration, and critical bug fixes that resolve the persistent communication issues.

## 🚀 Major Features

### MQTT Integration & Real-time Communication
- **Centralized MQTT Service**: Implemented a robust MQTT client service for real-time data communication
- **Temperature Publishing**: Backend now publishes temperature data to multiple MQTT topics
- **Connection Management**: Proper MQTT connection handling with startup event timing
- **Topic Structure**: Organized MQTT topics for different data types and units

### Dual Heater Control System
- **HTR-A & HTR-B Control**: Complete dual heater management interface
- **Shared Temperature Reading**: Both heaters read from the same temperature sensor
- **Unified Setpoint Control**: Single setpoint controls both heaters
- **Section Management**: Individual heater section control with protection logic

### Advanced PID Control
- **Stepped Output System**: Variable step sizes based on temperature changes and acceleration
- **Timer-based Logic**: 15-second timers for adding/removing heater sections
- **Continuous Monitoring**: Independent timer management with PID change resets
- **Section Protection**: Section 0 always protected, never removed by timer

### State Persistence
- **Comprehensive State Saving**: All UI parameters persist across page refreshes
- **Local Storage Integration**: Real-time synchronization using StorageEvent listeners
- **Timer Size Control**: Individual timer settings for each heater unit
- **Auto/Manual Mode Persistence**: Toggle states maintained across sessions

## 🔧 Technical Improvements

### Docker & Deployment
- **Fresh Docker Installation**: Complete Docker reinstallation to resolve persistent issues
- **Interactive Deployment Scripts**: Semi-automatic deployment with IP configuration
- **Cache-busting Headers**: Nginx configuration prevents browser caching issues
- **Multi-unit Support**: Support for multiple units with different configurations

### Backend Enhancements
- **Simplified IP Construction**: Direct IP usage eliminates parsing errors
- **Error Handling**: Exponential backoff and comprehensive error logging
- **IO-Link Communication**: Robust HTTP client for sensor data polling
- **Database Integration**: PostgreSQL for data logging and health monitoring

### Frontend Improvements
- **React.js Modern UI**: Clean, responsive interface with Tailwind CSS
- **Real-time Updates**: Live temperature and status updates via MQTT
- **Collapsible Debug Log**: Operator-friendly interface with hidden debug information
- **TypeScript Integration**: Type-safe development with proper error handling

## 🐛 Critical Bug Fixes

### MQTT Connection Issues
- **Fixed Docker Networking Timing**: Moved MQTT connection to startup event
- **Resolved Connection Failures**: Eliminated `[Errno -3] Temporary failure in name resolution`
- **Environment Variable Alignment**: Corrected MQTT_HOST vs MQTT_BROKER_HOST mismatch

### Frontend Communication
- **Fixed API URL Construction**: Resolved dynamic URL generation issues
- **Browser Caching Issues**: Implemented cache-busting headers
- **Topic Subscription Mismatch**: Corrected MQTT topic subscription alignment

### Docker Build Issues
- **ContainerConfig Errors**: Resolved through complete Docker reinstallation
- **Code Deployment Problems**: Fixed persistent file synchronization issues
- **Build Cache Issues**: Implemented proper cache invalidation

## 📋 System Requirements

### Hardware
- Raspberry Pi 5 (recommended) or compatible ARM64 device
- Minimum 4GB RAM
- 32GB+ storage
- Network connectivity to IO-Link devices

### Software
- Ubuntu 24.04 LTS (Noble Numbat)
- Docker 28.3.3+
- Docker Compose 2.39.1+
- Git for version control

### Network Configuration
- IO-Link devices on 192.168.30.x subnet
- Frontend accessible on port 33002
- Backend API on port 38002
- MQTT broker on port 1883 (internal), 9001 (WebSocket)

## 🚀 Installation

### Quick Start
```bash
# Clone the repository
git clone https://github.com/Offv/iot-control-server.git
cd iot-control-server

# Interactive installation
./install-unit-interactive.sh

# Or manual installation
docker compose up -d --build
```

### Configuration
- Update `docker-compose.yml` with your network settings
- Configure IO-Link device IPs in environment variables
- Set unit-specific parameters (UNIT_NAME, ports, etc.)

## 🔍 Troubleshooting

### Common Issues
1. **MQTT Connection Failures**: Check Docker networking and MQTT broker status
2. **Temperature Not Updating**: Verify IO-Link device connectivity and port configuration
3. **Frontend Not Loading**: Clear browser cache and check port accessibility
4. **Docker Build Issues**: Use `docker system prune -af --volumes` for complete cleanup

### Diagnostic Tools
- `troubleshoot-communication.sh`: Automated communication diagnostics
- `docker compose logs`: Container-specific logging
- `mosquitto_sub`: MQTT message monitoring

## 📚 Documentation

- `README.md`: Main project documentation
- `INSTALLATION_GUIDE.md`: Detailed installation instructions
- `README-DEV.md`: Development setup and guidelines
- `WORKING_SYSTEM_BACKUP_NOTES.md`: Production system configuration

## 🔄 Migration from Previous Versions

### Breaking Changes
- MQTT topic structure has been reorganized
- Environment variable names updated for consistency
- Docker Compose service names changed for multi-unit support

### Migration Steps
1. Backup existing configuration
2. Update environment variables to match new naming
3. Rebuild containers with `--build` flag
4. Verify MQTT topic subscriptions

## 🎯 What's Working in Production

✅ **MQTT Communication**: Real-time temperature publishing and subscription  
✅ **Dual Heater Control**: Complete HTR-A and HTR-B management  
✅ **PID Control Logic**: Advanced stepped output with timer management  
✅ **State Persistence**: All UI parameters maintained across sessions  
✅ **Docker Deployment**: Stable container orchestration  
✅ **IO-Link Integration**: Reliable sensor data polling  
✅ **Frontend Interface**: Responsive, real-time UI  
✅ **Error Handling**: Comprehensive logging and recovery  

## 🚧 Known Limitations

- Node.js version compatibility warnings (React Router requires Node 20+)
- Single temperature sensor shared between both heaters
- Manual firewall configuration required for production deployment

## 🔮 Future Enhancements

- Multi-sensor support for independent temperature readings
- Advanced analytics and trend analysis
- Mobile-responsive interface improvements
- Automated backup and recovery systems
- Enhanced security features

---

**Version 1.01 represents a stable, production-ready release with comprehensive MQTT integration, dual heater control, and robust error handling. This version resolves the persistent communication issues and provides a solid foundation for future enhancements.** 