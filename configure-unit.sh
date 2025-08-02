#!/bin/bash

# Unit Configuration Script for IoT Control Server v1.02
# Assigns discovered devices to units and generates configuration

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="$SCRIPT_DIR/configure-unit.log"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
    echo "$(date '+%Y-%m-%d %H:%M:%S') [INFO] $1" >> "$LOG_FILE"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
    echo "$(date '+%Y-%m-%d %H:%M:%S') [SUCCESS] $1" >> "$LOG_FILE"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
    echo "$(date '+%Y-%m-%d %H:%M:%S') [WARNING] $1" >> "$LOG_FILE"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
    echo "$(date '+%Y-%m-%d %H:%M:%S') [ERROR] $1" >> "$LOG_FILE"
}

# Function to show help
show_help() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --unit=NUMBER        Unit number to configure"
    echo "  --subnet=NUMBER      Subnet for the unit (e.g., 20, 30)"
    echo "  --host-ip=IP         Host IP address for the unit"
    echo "  --frontend-port=PORT Frontend port (default: 33000 + unit)"
    echo "  --backend-port=PORT  Backend port (default: 38000 + unit)"
    echo "  --mqtt-port=PORT     MQTT port (default: 1883)"
    echo "  --help               Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 --unit=1 --subnet=20 --host-ip=192.168.20.100"
    echo "  $0 --unit=2 --subnet=30 --host-ip=192.168.30.100"
}

# Function to get discovered devices for a unit
get_unit_devices() {
    local unit_number=$1
    
    if [[ ! -f "discovered_devices.json" ]]; then
        print_error "No discovered devices found. Run discovery first."
        exit 1
    fi
    
    # Filter devices for the specified unit
    jq -r ".[] | select(.unit_number == $unit_number)" discovered_devices.json
}

# Function to generate Docker Compose configuration
generate_docker_compose() {
    local unit_number=$1
    local subnet=$2
    local host_ip=$3
    local frontend_port=$4
    local backend_port=$5
    local mqtt_port=$6
    
    print_status "Generating Docker Compose configuration for Unit $unit_number..."
    
    # Get devices for this unit
    local devices=$(get_unit_devices "$unit_number")
    local heater_a_ip=""
    local heater_b_ip=""
    local temperature_ip=""
    
    # Extract device IPs
    while IFS= read -r device; do
        if [[ -n "$device" ]]; then
            local heater_type=$(echo "$device" | jq -r '.heater_type')
            local ip=$(echo "$device" | jq -r '.ip_address')
            
            case $heater_type in
                "A")
                    heater_a_ip=$ip
                    ;;
                "B")
                    heater_b_ip=$ip
                    ;;
                "T")
                    temperature_ip=$ip
                    ;;
            esac
        fi
    done <<< "$devices"
    
    # Generate Docker Compose file
    cat > "docker-compose-unit$unit_number.yml" << EOF
version: '3.8'

services:
  # MQTT Broker
  mqtt-unit$unit_number:
    image: eclipse-mosquitto:latest
    container_name: mqtt-unit$unit_number
    restart: unless-stopped
    ports:
      - "$mqtt_port:1883"
      - "$((mqtt_port + 1)):9001"
    volumes:
      - ./mosquitto/config:/mosquitto/config
      - ./mosquitto/data:/mosquitto/data
      - ./mosquitto/log:/mosquitto/log
    networks:
      - iot-network-unit$unit_number

  # PostgreSQL Database
  postgres-unit$unit_number:
    image: postgres:13
    container_name: postgres-unit$unit_number
    restart: unless-stopped
    environment:
      POSTGRES_DB: iot_control_v102
      POSTGRES_USER: iot_user
      POSTGRES_PASSWORD: iot_password
    ports:
      - "$((backend_port + 1)):5432"
    volumes:
      - postgres_data_unit$unit_number:/var/lib/postgresql/data
    networks:
      - iot-network-unit$unit_number

  # Backend API
  backend-unit$unit_number:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: backend-unit$unit_number
    restart: unless-stopped
    environment:
      - UNIT_NUMBER=$unit_number
      - UNIT_SUBNET=$subnet
      - HTR_A_IP=${heater_a_ip:-192.168.$subnet.29}
      - HTR_B_IP=${heater_b_ip:-192.168.$subnet.30}
      - TEMPERATURE_IP=${temperature_ip:-192.168.$subnet.29}
      - MQTT_HOST=mqtt-unit$unit_number
      - MQTT_PORT=1883
      - DATABASE_URL=postgresql://iot_user:iot_password@postgres-unit$unit_number:5432/iot_control_v102
      - VITE_UNIT_NAME=unit$unit_number
    ports:
      - "$backend_port:8000"
    depends_on:
      - mqtt-unit$unit_number
      - postgres-unit$unit_number
    networks:
      - iot-network-unit$unit_number
    volumes:
      - ./config:/app/config:ro

  # Frontend
  frontend-unit$unit_number:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: frontend-unit$unit_number
    restart: unless-stopped
    environment:
      - VITE_API_BASE_URL=http://backend-unit$unit_number:8000
      - VITE_UNIT_NAME=unit$unit_number
      - VITE_MQTT_HOST=mqtt-unit$unit_number
      - VITE_MQTT_PORT=1883
      - VITE_MQTT_WS_PORT=9001
    ports:
      - "$frontend_port:3000"
    depends_on:
      - backend-unit$unit_number
    networks:
      - iot-network-unit$unit_number

networks:
  iot-network-unit$unit_number:
    driver: bridge

volumes:
  postgres_data_unit$unit_number:
    driver: local
EOF
    
    print_success "Docker Compose configuration generated: docker-compose-unit$unit_number.yml"
}

# Function to generate configuration files
generate_config_files() {
    local unit_number=$1
    local subnet=$2
    
    print_status "Generating configuration files for Unit $unit_number..."
    
    # Create config directory if it doesn't exist
    mkdir -p "config/unit$unit_number"
    
    # Generate IO-Link configuration
    cat > "config/unit$unit_number/iolink_config.yml" << EOF
# IO-Link Configuration for Unit $unit_number
unit:
  number: $unit_number
  subnet: $subnet

# Temperature Sensor Configuration
temperature_sensor:
  master_ip: "192.168.$subnet.29"
  port: 6
  mqtt_topic: "instrument/unit$unit_number/htr_a/temperature"
  unit: "fahrenheit"
  range: [32, 750]

# Heater Sections Configuration
htr_sections:
  master_ip: "192.168.$subnet.29"
  master_ip_b: "192.168.$subnet.30"
  ports: [1, 2, 3, 4]
  section_protection: true  # Section 0 (Port 1) never turns off

# MQTT Configuration
mqtt:
  broker_host: "mqtt-unit$unit_number"
  broker_port: 1883
  websocket_port: 9001
  topics:
    temperature: "instrument/unit$unit_number/+/temperature"
    status: "instrument/unit$unit_number/+/status"
    command: "instrument/unit$unit_number/+/command"
EOF
    
    # Generate MQTT configuration
    cat > "mosquitto/config/mosquitto-unit$unit_number.conf" << EOF
# MQTT Configuration for Unit $unit_number
listener 1883
allow_anonymous true

# WebSocket support
listener 9001
protocol websockets
allow_anonymous true

# Logging
log_dest file /mosquitto/log/mosquitto-unit$unit_number.log
log_dest stdout
log_type all
log_timestamp true

# Persistence
persistence true
persistence_location /mosquitto/data/
autosave_interval 1800

# Security (basic)
password_file /mosquitto/config/passwords
EOF
    
    print_success "Configuration files generated for Unit $unit_number"
}

# Function to update database
update_database() {
    local unit_number=$1
    local subnet=$2
    local host_ip=$3
    local frontend_port=$4
    local backend_port=$5
    local mqtt_port=$6
    
    print_status "Updating database for Unit $unit_number..."
    
    # Check if PostgreSQL container is running
    if ! docker ps --format "{{.Names}}" | grep -q "iot-postgres-v102"; then
        print_error "PostgreSQL container not running. Start installation first."
        exit 1
    fi
    
    # Insert unit configuration
    docker exec iot-postgres-v102 psql -U iot_user -d iot_control_v102 << EOF
INSERT INTO unit_config (unit_number, subnet, host_ip, mqtt_port, frontend_port, backend_port, unit_name)
VALUES ($unit_number, $subnet, '$host_ip', $mqtt_port, $frontend_port, $backend_port, 'Unit $unit_number')
ON CONFLICT (unit_number) DO UPDATE SET
    subnet = EXCLUDED.subnet,
    host_ip = EXCLUDED.host_ip,
    mqtt_port = EXCLUDED.mqtt_port,
    frontend_port = EXCLUDED.frontend_port,
    backend_port = EXCLUDED.backend_port,
    updated_at = NOW();
EOF
    
    # Get devices for this unit and update heater configuration
    local devices=$(get_unit_devices "$unit_number")
    
    while IFS= read -r device; do
        if [[ -n "$device" ]]; then
            local mac=$(echo "$device" | jq -r '.mac_address')
            local ip=$(echo "$device" | jq -r '.ip_address')
            local heater_type=$(echo "$device" | jq -r '.heater_type')
            local device_name=$(echo "$device" | jq -r '.device_name // empty')
            
            if [[ "$heater_type" != "T" ]]; then  # Skip temperature sensors
                docker exec iot-postgres-v102 psql -U iot_user -d iot_control_v102 << EOF
INSERT INTO heater_config (unit_number, heater_type, device_mac, device_ip, mqtt_topic)
VALUES ($unit_number, '$heater_type', '$mac', '$ip', 'instrument/unit$unit_number/htr_${heater_type,,}')
ON CONFLICT (unit_number, heater_type) DO UPDATE SET
    device_mac = EXCLUDED.device_mac,
    device_ip = EXCLUDED.device_ip,
    updated_at = NOW();
EOF
            fi
        fi
    done <<< "$devices"
    
    print_success "Database updated for Unit $unit_number"
}

# Function to start unit services
start_unit_services() {
    local unit_number=$1
    
    print_status "Starting services for Unit $unit_number..."
    
    # Start Docker Compose services
    docker-compose -f "docker-compose-unit$unit_number.yml" up -d
    
    # Wait for services to start
    sleep 10
    
    # Check service status
    if docker-compose -f "docker-compose-unit$unit_number.yml" ps | grep -q "Up"; then
        print_success "Unit $unit_number services started successfully"
    else
        print_warning "Some services may not have started properly"
    fi
}

# Main configuration function
main() {
    # Parse command line arguments
    UNIT_NUMBER=""
    SUBNET=""
    HOST_IP=""
    FRONTEND_PORT=""
    BACKEND_PORT=""
    MQTT_PORT="1883"
    
    for arg in "$@"; do
        case $arg in
            --unit=*)
                UNIT_NUMBER="${arg#*=}"
                shift
                ;;
            --subnet=*)
                SUBNET="${arg#*=}"
                shift
                ;;
            --host-ip=*)
                HOST_IP="${arg#*=}"
                shift
                ;;
            --frontend-port=*)
                FRONTEND_PORT="${arg#*=}"
                shift
                ;;
            --backend-port=*)
                BACKEND_PORT="${arg#*=}"
                shift
                ;;
            --mqtt-port=*)
                MQTT_PORT="${arg#*=}"
                shift
                ;;
            --help)
                show_help
                exit 0
                ;;
            *)
                print_error "Unknown option: $arg"
                show_help
                exit 1
                ;;
        esac
    done
    
    # Validate required parameters
    if [[ -z "$UNIT_NUMBER" ]]; then
        print_error "Unit number is required. Use --unit=NUMBER"
        show_help
        exit 1
    fi
    
    if [[ -z "$SUBNET" ]]; then
        print_error "Subnet is required. Use --subnet=NUMBER"
        show_help
        exit 1
    fi
    
    if [[ -z "$HOST_IP" ]]; then
        HOST_IP="192.168.$SUBNET.100"
        print_warning "Host IP not specified. Using default: $HOST_IP"
    fi
    
    # Set default ports if not specified
    if [[ -z "$FRONTEND_PORT" ]]; then
        FRONTEND_PORT=$((33000 + UNIT_NUMBER))
    fi
    
    if [[ -z "$BACKEND_PORT" ]]; then
        BACKEND_PORT=$((38000 + UNIT_NUMBER))
    fi
    
    # Initialize log file
    echo "Unit Configuration Log" > "$LOG_FILE"
    echo "Started at: $(date)" >> "$LOG_FILE"
    echo "Unit: $UNIT_NUMBER" >> "$LOG_FILE"
    
    print_status "Configuring Unit $UNIT_NUMBER..."
    print_status "Subnet: 192.168.$SUBNET.x"
    print_status "Host IP: $HOST_IP"
    print_status "Frontend Port: $FRONTEND_PORT"
    print_status "Backend Port: $BACKEND_PORT"
    print_status "MQTT Port: $MQTT_PORT"
    
    # Generate configuration files
    generate_config_files "$UNIT_NUMBER" "$SUBNET"
    
    # Generate Docker Compose configuration
    generate_docker_compose "$UNIT_NUMBER" "$SUBNET" "$HOST_IP" "$FRONTEND_PORT" "$BACKEND_PORT" "$MQTT_PORT"
    
    # Update database
    update_database "$UNIT_NUMBER" "$SUBNET" "$HOST_IP" "$FRONTEND_PORT" "$BACKEND_PORT" "$MQTT_PORT"
    
    # Start services
    start_unit_services "$UNIT_NUMBER"
    
    print_success "Unit $UNIT_NUMBER configuration completed!"
    echo ""
    echo -e "${GREEN}Unit $UNIT_NUMBER is now configured:${NC}"
    echo "• Frontend: http://$HOST_IP:$FRONTEND_PORT"
    echo "• Backend API: http://$HOST_IP:$BACKEND_PORT"
    echo "• MQTT Broker: $HOST_IP:$MQTT_PORT"
    echo "• Configuration: config/unit$UNIT_NUMBER/"
    echo "• Docker Compose: docker-compose-unit$UNIT_NUMBER.yml"
}

# Run main function with all arguments
main "$@" 