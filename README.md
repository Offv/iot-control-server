# IoT Control Server

This project implements an IoT server for controlling and monitoring industrial devices:
- IO-Link master devices via MQTT
- Omron PLCs (RX/QX series) communication
- Web interface for monitoring and control

## Prerequisites
- Raspberry Pi 5 with Ubuntu Server 22.04
- Docker and Docker Compose installed
- Network access to IO-Link master and Omron PLCs

## Project Structure
```
.
├── docker-compose.yml
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── src/
├── frontend/
│   ├── Dockerfile
│   └── src/
└── config/
    └── mqtt_config.yml
```

## Setup Instructions

1. Clone this repository to your Raspberry Pi
2. Configure your device connections in `config/mqtt_config.yml`
3. Start the services:
```bash
docker compose up -d
```

## Components
- Backend: Python-based server handling MQTT and PLC communications
- Frontend: React-based web interface
- MQTT Broker: Mosquitto for IO-Link master communication
- Database: TimescaleDB for time-series data storage 