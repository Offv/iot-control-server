#!/bin/bash

# IoT Control System - Interactive Unit Installation
# Discovers IO-Link device IDs and configures units dynamically

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_input() {
    echo -e "${CYAN}[INPUT]${NC} $1"
}

# Function to validate IP address
validate_ip() {
    local ip=$1
    if [[ $ip =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
        IFS='.' read -r -a ip_parts <<< "$ip"
        for part in "${ip_parts[@]}"; do
            if [[ $part -lt 0 || $part -gt 255 ]]; then
                return 1
            fi
        done
        return 0
    else
        return 1
    fi
}

# Function to validate device ID format
validate_device_id() {
    local device_id=$1
    # IO-Link device ID format: XX-XX-XX-XX-XX-XX (hexadecimal)
    if [[ $device_id =~ ^[0-9A-Fa-f]{2}-[0-9A-Fa-f]{2}-[0-9A-Fa-f]{2}-[0-9A-Fa-f]{2}-[0-9A-Fa-f]{2}-[0-9A-Fa-f]{2}$ ]]; then
        return 0
    else
        return 1
    fi
}

# Function to discover IO-Link device ID
discover_device_id() {
    local ip=$1
    local device_name=$2
    
    print_status "Attempting to discover IO-Link device ID from $device_name at $ip..."
    
    # Check if discovery tool exists
    if [[ -f "iolink-discovery.py" ]]; then
        print_status "Using automated discovery tool..."
        
        # Try automated discovery first
        if command -v python3 &> /dev/null; then
            print_status "Running automated device ID discovery..."
            discovered_id=$(python3 iolink-discovery.py "$ip" 2>/dev/null)
            
            if [[ -n "$discovered_id" ]]; then
                print_success "✅ Device ID automatically discovered: $discovered_id"
                print_input "Use this device ID? (Y/n):"
                read -r use_discovered
                
                if [[ -z "$use_discovered" || "$use_discovered" =~ ^[Yy]$ ]]; then
                    echo "$discovered_id"
                    return 0
                fi
            else
                print_warning "❌ Automated discovery failed"
            fi
        else
            print_warning "Python3 not available, skipping automated discovery"
        fi
    fi
    
    # Fallback to manual entry
    print_warning "Please connect to the IO-Link master at $ip and get the device ID."
    print_status "You can usually find this in the IO-Link master's web interface under 'Device Information' or 'Connected Devices'."
    print_status "Common locations:"
    echo "  - IFM: http://$ip/iolink/deviceinfo"
    echo "  - Siemens: http://$ip/api/iolink"
    echo "  - Phoenix Contact: http://$ip/api/iolink"
    echo "  - Beckhoff: http://$ip/api/iolink"
    
    while true; do
        print_input "Enter the device ID for $device_name ($ip) in format XX-XX-XX-XX-XX-XX:"
        read -r device_id
        
        if validate_device_id "$device_id"; then
            print_success "Valid device ID format: $device_id"
            echo "$device_id"
            return 0
        else
            print_error "Invalid device ID format. Please use format: XX-XX-XX-XX-XX-XX"
            print_status "Example: 00-02-01-6D-55-8A"
        fi
    done
}

# Function to test IO-Link connection
test_iolink_connection() {
    local ip=$1
    local device_name=$2
    
    print_status "Testing connection to $device_name at $ip..."
    
    # Try to ping the device
    if ping -c 1 -W 2 "$ip" &> /dev/null; then
        print_success "Network connectivity to $ip is OK"
        return 0
    else
        print_warning "Cannot ping $ip. Please check:"
        echo "  1. Device is powered on"
        echo "  2. Network cable is connected"
        echo "  3. IP address is correct"
        echo "  4. Device is on the same network"
        return 1
    fi
}

# Function to generate unit configuration
generate_unit_config() {
    local unit_number=$1
    local htr_a_ip=$2
    local htr_a_device_id=$3
    local htr_b_ip=$4
    local htr_b_device_id=$5
    
    # Get the current server IP automatically
    local server_ip=$(hostname -I | awk '{print $1}' | head -1)
    if [[ -z "$server_ip" ]]; then
        server_ip="localhost"
    fi
    
    local subnet=$((20 + (unit_number - 1) * 10))
    local unit_name="unit${unit_number}"
    local unit_domain="${unit_name}htr.system"
    
    print_status "Generating configuration for Unit $unit_number..."
    
    # Create unit-specific docker-compose override
    cat > "docker-compose.unit${unit_number}.yml" << EOF
version: '3.8'

services:
  # Unit ${unit_number} Backend
  backend-${unit_name}:
    build:
      context: ./backend
      dockerfile: Dockerfile.dev
    container_name: iot-backend-${unit_name}-dev
    environment:
      - MQTT_HOST=mqtt
      - MQTT_PORT=1883
      - UNIT_NAME=${unit_name}
      - UNIT_NUMBER=${unit_number}
      - UNIT_DOMAIN=${unit_domain}
      - UNIT_SUBNET=${subnet}
      - HTR_A_IP=${htr_a_ip}
      - HTR_A_DEVICE_ID=${htr_a_device_id}
      - HTR_A_TEMP_PORT=6
      - HTR_A_TEMP_TOPIC=instrument/${unit_name}/htr_a/temperature
      - HTR_B_IP=${htr_b_ip}
      - HTR_B_DEVICE_ID=${htr_b_device_id}
      - HTR_B_TEMP_PORT=6
      - HTR_B_TEMP_TOPIC=instrument/${unit_name}/htr_b/temperature
      - DATABASE_URL=postgresql://iotuser:iotpassword@database:5432/iotdata
      - LOG_LEVEL=DEBUG
    ports:
      - "38${unit_number}01:8000"
    volumes:
      - ./backend/src:/app/src
      - ./config:/app/config
    depends_on:
      - mqtt
      - database
    networks:
      - iot-network

  # Unit ${unit_number} Frontend
  frontend-${unit_name}:
    build:
      context: ./frontend
      dockerfile: Dockerfile.dev
    container_name: iot-frontend-${unit_name}-dev
    environment:
      - VITE_MQTT_HOST=mqtt
      - VITE_MQTT_PORT=1883
      - VITE_MQTT_WS_PORT=9001
      - VITE_UNIT_NAME=${unit_name}
      - VITE_UNIT_NUMBER=${unit_number}
      - VITE_UNIT_DOMAIN=${unit_domain}
      - VITE_UNIT_SUBNET=${subnet}
      - VITE_HTR_A_IP=${htr_a_ip}
      - VITE_HTR_A_DEVICE_ID=${htr_a_device_id}
      - VITE_HTR_A_TOPIC=instrument/${unit_name}/htr_a/temperature
      - VITE_HTR_B_IP=${htr_b_ip}
      - VITE_HTR_B_DEVICE_ID=${htr_b_device_id}
      - VITE_HTR_B_TOPIC=instrument/${unit_name}/htr_b/temperature
      - VITE_API_BASE_URL=http://backend-${unit_name}:8000
      - NODE_ENV=development
    ports:
      - "33${unit_number}01:3000"
    volumes:
      - ./frontend/src:/app/src
      - ./frontend/public:/app/public
    depends_on:
      - mqtt
      - backend-${unit_name}
    networks:
      - iot-network
EOF

    # Create unit configuration file
    cat > "config/unit${unit_number}_config.yml" << EOF
# Unit ${unit_number} Configuration
unit:
  name: ${unit_name}
  number: ${unit_number}
  domain: ${unit_domain}
  subnet: ${subnet}

htr_a:
  ip: ${htr_a_ip}
  device_id: ${htr_a_device_id}
  temp_port: 6
  temp_topic: instrument/${unit_name}/htr_a/temperature

htr_b:
  ip: ${htr_b_ip}
  device_id: ${htr_b_device_id}
  temp_port: 6
  temp_topic: instrument/${unit_name}/htr_b/temperature

mqtt:
  host: mqtt
  port: 1883
  ws_port: 9001

database:
  url: postgresql://iotuser:iotpassword@database:5432/iotdata
EOF

    print_success "Unit $unit_number configuration generated!"
    print_status "Files created:"
    echo "  - docker-compose.unit${unit_number}.yml"
    echo "  - config/unit${unit_number}_config.yml"
}

# Main installation process
echo "🔧 IoT Control System - Interactive Unit Installation"
echo "====================================================="

# Get unit number
while true; do
    print_input "Enter the unit number (1-9):"
    read -r unit_number
    
    if [[ $unit_number =~ ^[1-9]$ ]]; then
        print_success "Unit number: $unit_number"
        break
    else
        print_error "Please enter a number between 1 and 9"
    fi
done

# Calculate subnet based on unit number
subnet=$((20 + (unit_number - 1) * 10))
print_status "Unit $unit_number will use subnet: $subnet.x.x.x"

# Get HTR-A configuration
print_status ""
print_status "=== HTR-A Configuration ==="
print_input "Enter IP address for HTR-A (IO-Link A) [default: $subnet.29]:"
read -r htr_a_ip
htr_a_ip=${htr_a_ip:-"$subnet.29"}

if ! validate_ip "$htr_a_ip"; then
    print_error "Invalid IP address: $htr_a_ip"
    exit 1
fi

# Test HTR-A connection
if test_iolink_connection "$htr_a_ip" "HTR-A"; then
    htr_a_device_id=$(discover_device_id "$htr_a_ip" "HTR-A")
else
    print_warning "Skipping connection test for HTR-A"
    htr_a_device_id=$(discover_device_id "$htr_a_ip" "HTR-A")
fi

# Get HTR-B configuration
print_status ""
print_status "=== HTR-B Configuration ==="
print_input "Enter IP address for HTR-B (IO-Link B) [default: $subnet.33]:"
read -r htr_b_ip
htr_b_ip=${htr_b_ip:-"$subnet.33"}

if ! validate_ip "$htr_b_ip"; then
    print_error "Invalid IP address: $htr_b_ip"
    exit 1
fi

# Test HTR-B connection
if test_iolink_connection "$htr_b_ip" "HTR-B"; then
    htr_b_device_id=$(discover_device_id "$htr_b_ip" "HTR-B")
else
    print_warning "Skipping connection test for HTR-B"
    htr_b_device_id=$(discover_device_id "$htr_b_ip" "HTR-B")
fi

# Summary
print_status ""
print_status "=== Installation Summary ==="
echo "Unit Number: $unit_number"
echo "Subnet: $subnet.x.x.x"
echo "HTR-A: $htr_a_ip (Device ID: $htr_a_device_id)"
echo "HTR-B: $htr_b_ip (Device ID: $htr_b_device_id)"
echo "Domain: unit${unit_number}htr.system"

# Confirm installation
print_input ""
print_input "Proceed with installation? (y/N):"
read -r confirm

if [[ $confirm =~ ^[Yy]$ ]]; then
    # Create config directory if it doesn't exist
    mkdir -p config
    
    # Generate configuration
    generate_unit_config "$unit_number" "$htr_a_ip" "$htr_a_device_id" "$htr_b_ip" "$htr_b_device_id"
    
    print_success ""
    print_success "Unit $unit_number installation completed!"
    print_status ""
    print_status "Next steps:"
    echo "1. Add the unit to your main docker-compose.dev.yml:"
    echo "   docker-compose -f docker-compose.dev.yml -f docker-compose.unit${unit_number}.yml up -d"
    echo ""
    echo "2. Update nginx configuration to include the new unit"
    echo ""
    echo "3. Start the environment: ./dev-start.sh"
    echo ""
    print_status "Access URLs:"
    echo "  Frontend: http://${unit_domain}"
    echo "  Backend API: http://${unit_domain}/api"
    echo "  Direct Frontend: http://${server_ip}:33${unit_number}01"
    echo "  Direct Backend: http://${server_ip}:38${unit_number}01"
    echo "  MQTT WebSocket: ws://${unit_domain}:39001"
    echo ""
    print_status "Network Information:"
    echo "  Server IP: ${server_ip}"
    echo "  Unit Domain: ${unit_domain}"
    echo "  Unit Number: ${unit_number} (Subnet: ${subnet}.x.x.x)"
    echo "  HTR-A: ${htr_a_ip} (Subnet ${subnet}.29)"
    echo "  HTR-B: ${htr_b_ip} (Subnet ${subnet}.33)"
    echo ""
    print_status "Hierarchy:"
    echo "  Unit ${unit_number} = Subnet ${subnet}.x.x.x"
    echo "  ├── HTR-A: ${subnet}.29"
    echo "  └── HTR-B: ${subnet}.33"
else
    print_warning "Installation cancelled"
    exit 0
fi 