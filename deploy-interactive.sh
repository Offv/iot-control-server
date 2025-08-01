#!/bin/bash

# Interactive IoT Control Server Deployment Script
# This script prompts for IP configurations and sets up the system

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}================================${NC}"
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

# Function to get user input with validation
get_ip_input() {
    local prompt=$1
    local default=$2
    local ip
    
    while true; do
        read -p "$prompt [$default]: " ip
        ip=${ip:-$default}
        
        if validate_ip "$ip"; then
            echo "$ip"
            break
        else
            print_error "Invalid IP address: $ip"
        fi
    done
}

# Function to get number input with validation
get_number_input() {
    local prompt=$1
    local default=$2
    local min=$3
    local max=$4
    local num
    
    while true; do
        read -p "$prompt [$default]: " num
        num=${num:-$default}
        
        if [[ $num =~ ^[0-9]+$ ]] && [ $num -ge $min ] && [ $num -le $max ]; then
            echo "$num"
            break
        else
            print_error "Invalid number: $num (must be between $min and $max)"
        fi
    done
}

# Function to get yes/no input
get_yes_no() {
    local prompt=$1
    local default=${2:-"n"}
    local response
    
    while true; do
        read -p "$prompt (y/n) [$default]: " response
        response=${response:-$default}
        
        case $response in
            [Yy]* ) echo "y"; break;;
            [Nn]* ) echo "n"; break;;
            * ) print_error "Please answer y or n";;
        esac
    done
}

print_header "IoT Control Server - Interactive Deployment"
echo ""
print_status "This script will help you configure and deploy the IoT Control Server"
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker first."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    print_error "Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

print_status "Docker and Docker Compose are available"

# Get deployment type
echo ""
print_header "Deployment Configuration"
echo ""
echo "Choose deployment type:"
echo "1) Single Unit (Production)"
echo "2) Multi-Unit (Development)"
echo "3) Custom Configuration"

deployment_type=$(get_number_input "Enter choice" "1" "1" "3")

# Get network configuration
echo ""
print_header "Network Configuration"
echo ""

# Get host machine IP
host_ip=$(get_ip_input "Enter the IP address of this machine (where Docker is running)" "192.168.25.198")

# Get MQTT configuration (shared across all units)
echo ""
print_status "MQTT Configuration (shared across all units)"
mqtt_host=$(get_ip_input "Enter MQTT broker host IP" "$host_ip")
mqtt_port=$(get_number_input "Enter MQTT broker port" "1883" "1" "65535")
mqtt_ws_port=$(get_number_input "Enter MQTT WebSocket port" "9001" "1" "65535")

# Get database configuration
echo ""
print_status "Database Configuration"
db_host=$(get_ip_input "Enter database host IP" "$host_ip")
db_port=$(get_number_input "Enter database port" "5432" "1" "65535")

# Unit-specific configuration
units=()

if [ "$deployment_type" = "1" ]; then
    # Single unit
    echo ""
    print_header "Unit Configuration"
    echo ""
    
    unit_num=$(get_number_input "Enter unit number" "1" "1" "99")
    unit_name="unit$unit_num"
    
    # Get subnet for this unit
    subnet=$(get_number_input "Enter subnet number (e.g., 30 for 192.168.30.x)" "30" "1" "255")
    
    # Get IO-Link device IPs
    echo ""
    print_status "IO-Link Device Configuration"
    htr_a_ip=$(get_ip_input "Enter HTR-A IO-Link master IP" "192.168.$subnet.29")
    htr_b_ip=$(get_ip_input "Enter HTR-B IO-Link master IP" "192.168.$subnet.33")
    
    # Get device IDs
    htr_a_device_id=$(get_ip_input "Enter HTR-A device ID" "00-02-01-6D-55-8A")
    htr_b_device_id=$(get_ip_input "Enter HTR-B device ID" "00-02-01-6D-55-86")
    
    # Get port configuration
    echo ""
    print_status "Port Configuration"
    frontend_port=$(get_number_input "Enter frontend port" "3001" "1" "65535")
    backend_port=$(get_number_input "Enter backend port" "38001" "1" "65535")
    
    units+=("$unit_num|$unit_name|$subnet|$htr_a_ip|$htr_b_ip|$htr_a_device_id|$htr_b_device_id|$frontend_port|$backend_port")
    
elif [ "$deployment_type" = "2" ]; then
    # Multi-unit
    echo ""
    print_header "Multi-Unit Configuration"
    echo ""
    
    num_units=$(get_number_input "Enter number of units to deploy" "2" "1" "10")
    
    for ((i=1; i<=num_units; i++)); do
        echo ""
        print_status "Unit $i Configuration"
        
        unit_num=$(get_number_input "Enter unit number for unit $i" "$i" "1" "99")
        unit_name="unit$unit_num"
        
        # Get subnet for this unit
        subnet=$(get_number_input "Enter subnet number for unit $i (e.g., 30 for 192.168.30.x)" "$((20+i*10))" "1" "255")
        
        # Get IO-Link device IPs
        echo ""
        print_status "IO-Link Device Configuration for Unit $i"
        htr_a_ip=$(get_ip_input "Enter HTR-A IO-Link master IP for unit $i" "192.168.$subnet.29")
        htr_b_ip=$(get_ip_input "Enter HTR-B IO-Link master IP for unit $i" "192.168.$subnet.33")
        
        # Get device IDs
        htr_a_device_id=$(get_ip_input "Enter HTR-A device ID for unit $i" "00-02-01-6D-55-8A")
        htr_b_device_id=$(get_ip_input "Enter HTR-B device ID for unit $i" "00-02-01-6D-55-86")
        
        # Get port configuration
        echo ""
        print_status "Port Configuration for Unit $i"
        frontend_port=$(get_number_input "Enter frontend port for unit $i" "$((33000+unit_num))" "1" "65535")
        backend_port=$(get_number_input "Enter backend port for unit $i" "$((38000+unit_num))" "1" "65535")
        
        units+=("$unit_num|$unit_name|$subnet|$htr_a_ip|$htr_b_ip|$htr_a_device_id|$htr_b_device_id|$frontend_port|$backend_port")
    done
    
else
    # Custom configuration
    echo ""
    print_header "Custom Configuration"
    echo ""
    print_warning "You will need to manually configure the docker-compose.yml file"
    print_status "Please edit the docker-compose.yml file with your custom configuration"
fi

# Firewall configuration
echo ""
print_header "Firewall Configuration"
echo ""
configure_firewall=$(get_yes_no "Do you want to configure firewall rules automatically?" "y")

if [ "$configure_firewall" = "y" ]; then
    print_status "Configuring firewall rules..."
    
    # Check if ufw is available
    if command -v ufw &> /dev/null; then
        # Get all ports that need to be opened
        ports_to_open=("$mqtt_port" "$mqtt_ws_port" "$db_port")
        
        for unit_config in "${units[@]}"; do
            IFS='|' read -r unit_num unit_name subnet htr_a_ip htr_b_ip htr_a_device_id htr_b_device_id frontend_port backend_port <<< "$unit_config"
            ports_to_open+=("$frontend_port" "$backend_port")
        done
        
        # Remove duplicates
        ports_to_open=($(printf "%s\n" "${ports_to_open[@]}" | sort -u))
        
        for port in "${ports_to_open[@]}"; do
            print_status "Opening port $port"
            sudo ufw allow $port/tcp
        done
        
        print_status "Firewall rules configured"
    else
        print_warning "ufw not found. Please manually configure firewall rules for the following ports:"
        for port in "${ports_to_open[@]}"; do
            echo "  - Port $port"
        done
    fi
fi

# Generate configuration
echo ""
print_header "Generating Configuration"
echo ""

# Create environment file
env_file=".env"
cat > "$env_file" << EOF
# IoT Control Server Environment Configuration
# Generated on $(date)

# MQTT Configuration (Shared)
MQTT_HOST=$mqtt_host
MQTT_PORT=$mqtt_port
VITE_MQTT_WS_PORT=$mqtt_ws_port

# Database Configuration (Shared)
DATABASE_HOST=$db_host
DATABASE_PORT=$db_port
DATABASE_USER=iotuser
DATABASE_PASSWORD=iotpassword
DATABASE_NAME=iotdata

EOF

# Add unit-specific configurations
for unit_config in "${units[@]}"; do
    IFS='|' read -r unit_num unit_name subnet htr_a_ip htr_b_ip htr_a_device_id htr_b_device_id frontend_port backend_port <<< "$unit_config"
    
    cat >> "$env_file" << EOF
# Unit $unit_num Configuration
UNIT${unit_num}_NAME=$unit_name
UNIT${unit_num}_NUMBER=$unit_num
UNIT${unit_num}_SUBNET=$subnet
UNIT${unit_num}_HTR_A_IP=$htr_a_ip
UNIT${unit_num}_HTR_B_IP=$htr_b_ip
UNIT${unit_num}_HTR_A_DEVICE_ID=$htr_a_device_id
UNIT${unit_num}_HTR_B_DEVICE_ID=$htr_b_device_id
UNIT${unit_num}_FRONTEND_PORT=$frontend_port
UNIT${unit_num}_BACKEND_PORT=$backend_port

EOF
done

print_status "Environment file created: $env_file"

# Generate docker-compose configuration
if [ "$deployment_type" = "1" ]; then
    # Single unit - use existing docker-compose.yml
    print_status "Using existing docker-compose.yml for single unit deployment"
elif [ "$deployment_type" = "2" ]; then
    # Multi-unit - generate docker-compose.dev.yml
    print_status "Generating multi-unit docker-compose.dev.yml"
    
    # Read the first unit for template
    IFS='|' read -r unit_num unit_name subnet htr_a_ip htr_b_ip htr_a_device_id htr_b_device_id frontend_port backend_port <<< "${units[0]}"
    
    # Generate docker-compose.dev.yml
    cat > "docker-compose.dev.yml" << EOF
version: '3.8'

services:
  # MQTT Broker (shared between units)
  mqtt:
    image: eclipse-mosquitto:latest
    ports:
      - "${mqtt_port}:1883"
      - "${mqtt_ws_port}:9001"
    volumes:
      - ./mosquitto/config:/mosquitto/config
      - ./mosquitto/data:/mosquitto/data
      - ./mosquitto/log:/mosquitto/log

  # Database (shared between units)
  database:
    image: postgres:14
    environment:
      - POSTGRES_USER=iotuser
      - POSTGRES_PASSWORD=iotpassword
      - POSTGRES_DB=iotdata
    ports:
      - "${db_port}:5432"
    volumes:
      - iot-db-data:/var/lib/postgresql/data

EOF

    # Add services for each unit
    for unit_config in "${units[@]}"; do
        IFS='|' read -r unit_num unit_name subnet htr_a_ip htr_b_ip htr_a_device_id htr_b_device_id frontend_port backend_port <<< "$unit_config"
        
        cat >> "docker-compose.dev.yml" << EOF
  # Unit $unit_num Services
  backend-$unit_name:
    build:
      context: ./backend
      dockerfile: Dockerfile
    environment:
      - MQTT_HOST=mqtt
      - MQTT_PORT=1883
      - UNIT_NAME=$unit_name
      - UNIT_NUMBER=$unit_num
      - UNIT_DOMAIN=${unit_name}htr.system
      - UNIT_SUBNET=$subnet
      - HTR_A_IP=$htr_a_ip
      - HTR_A_DEVICE_ID=$htr_a_device_id
      - HTR_A_TEMP_PORT=6
      - HTR_A_TEMP_TOPIC=instrument/$unit_name/htr_a/temperature
      - HTR_B_IP=$htr_b_ip
      - HTR_B_DEVICE_ID=$htr_b_device_id
      - HTR_B_TEMP_PORT=6
      - HTR_B_TEMP_TOPIC=instrument/$unit_name/htr_a/temperature
      - DATABASE_URL=postgresql://iotuser:iotpassword@database:5432/iotdata
      - LOG_LEVEL=INFO
    volumes:
      - ./config:/app/config
    depends_on:
      - mqtt
      - database
    ports:
      - "${backend_port}:8000"

  frontend-$unit_name:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    environment:
      - VITE_MQTT_HOST=\${MQTT_HOST:-localhost}
      - VITE_MQTT_PORT=1883
      - VITE_MQTT_WS_PORT=$mqtt_ws_port
      - VITE_UNIT_NAME=$unit_name
      - VITE_UNIT_NUMBER=$unit_num
      - VITE_UNIT_DOMAIN=${unit_name}htr.system
      - VITE_UNIT_SUBNET=$subnet
      - VITE_HTR_A_IP=$htr_a_ip
      - VITE_HTR_A_DEVICE_ID=$htr_a_device_id
      - VITE_HTR_A_TOPIC=instrument/$unit_name/htr_a/temperature
      - VITE_HTR_B_IP=$htr_b_ip
      - VITE_HTR_B_DEVICE_ID=$htr_b_device_id
      - VITE_HTR_B_TOPIC=instrument/$unit_name/htr_a/temperature
      - VITE_API_BASE_URL=http://backend-$unit_name:8000
    ports:
      - "${frontend_port}:3000"
    depends_on:
      - mqtt
      - backend-$unit_name

EOF
    done

    cat >> "docker-compose.dev.yml" << EOF
volumes:
  iot-db-data:
EOF

    print_status "Multi-unit docker-compose.dev.yml generated"
fi

# Deployment
echo ""
print_header "Deployment"
echo ""

deploy_now=$(get_yes_no "Do you want to deploy the system now?" "y")

if [ "$deploy_now" = "y" ]; then
    print_status "Starting deployment..."
    
    # Stop any existing containers
    print_status "Stopping existing containers..."
    docker-compose down 2>/dev/null || true
    
    if [ "$deployment_type" = "2" ]; then
        docker-compose -f docker-compose.dev.yml down 2>/dev/null || true
    fi
    
    # Build and start containers
    print_status "Building and starting containers..."
    
    if [ "$deployment_type" = "1" ]; then
        docker-compose up -d --build
    else
        docker-compose -f docker-compose.dev.yml up -d --build
    fi
    
    # Wait for containers to start
    print_status "Waiting for containers to start..."
    sleep 10
    
    # Check container status
    print_status "Checking container status..."
    if [ "$deployment_type" = "1" ]; then
        docker-compose ps
    else
        docker-compose -f docker-compose.dev.yml ps
    fi
    
    echo ""
    print_header "Deployment Complete!"
    echo ""
    print_status "System is now running. Access points:"
    echo ""
    
    for unit_config in "${units[@]}"; do
        IFS='|' read -r unit_num unit_name subnet htr_a_ip htr_b_ip htr_a_device_id htr_b_device_id frontend_port backend_port <<< "$unit_config"
        echo "  Unit $unit_num ($unit_name):"
        echo "    Frontend: http://$host_ip:$frontend_port"
        echo "    Backend API: http://$host_ip:$backend_port"
        echo "    IO-Link A: $htr_a_ip"
        echo "    IO-Link B: $htr_b_ip"
        echo ""
    done
    
    echo "  MQTT Broker: $mqtt_host:$mqtt_port"
    echo "  MQTT WebSocket: $mqtt_host:$mqtt_ws_port"
    echo "  Database: $db_host:$db_port"
    echo ""
    
    # Health check
    print_status "Performing health check..."
    sleep 5
    
    for unit_config in "${units[@]}"; do
        IFS='|' read -r unit_num unit_name subnet htr_a_ip htr_b_ip htr_a_device_id htr_b_device_id frontend_port backend_port <<< "$unit_config"
        
        echo ""
        print_status "Testing Unit $unit_num..."
        
        # Test frontend
        if curl -s "http://$host_ip:$frontend_port" > /dev/null; then
            print_status "✓ Frontend is accessible"
        else
            print_warning "✗ Frontend may not be ready yet"
        fi
        
        # Test backend
        if curl -s "http://$host_ip:$backend_port/api/status" > /dev/null; then
            print_status "✓ Backend API is accessible"
        else
            print_warning "✗ Backend API may not be ready yet"
        fi
        
        # Test IO-Link connectivity
        if curl -s "http://$htr_a_ip/iolinkmaster/port%5B6%5D/iolinkdevice/pdin/getdata" > /dev/null; then
            print_status "✓ IO-Link A is accessible"
        else
            print_warning "✗ IO-Link A may not be accessible"
        fi
    done
    
    echo ""
    print_status "Deployment completed successfully!"
    print_status "Check the logs with: docker-compose logs -f"
    
else
    print_status "Configuration saved. Run the following command to deploy:"
    echo ""
    if [ "$deployment_type" = "1" ]; then
        echo "  docker-compose up -d --build"
    else
        echo "  docker-compose -f docker-compose.dev.yml up -d --build"
    fi
    echo ""
fi

print_header "Deployment Script Complete" 