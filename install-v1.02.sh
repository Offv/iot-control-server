#!/bin/bash

# IoT Control Server v1.02 Installation Script
# Discovery-based installation for multiple units and heaters

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="$SCRIPT_DIR/install-v1.02.log"
BACKUP_DIR="$SCRIPT_DIR/backups/$(date +%Y%m%d_%H%M%S)"

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

print_header() {
    echo -e "${PURPLE}"
    echo "=================================================="
    echo "  IoT Control Server v1.02 Installation"
    echo "  Discovery-Based Multi-Unit Installation"
    echo "=================================================="
    echo -e "${NC}"
}

# Function to check system requirements
check_system_requirements() {
    print_status "Checking system requirements..."
    
    # Check if running as root
    if [[ $EUID -eq 0 ]]; then
        print_warning "Running as root. This is not recommended for security reasons."
    fi
    
    # Check OS
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        print_success "Linux OS detected"
    else
        print_error "Unsupported OS: $OSTYPE. This script is designed for Linux."
        exit 1
    fi
    
    # Check Python
    if command -v python3 &> /dev/null; then
        PYTHON_VERSION=$(python3 --version | cut -d' ' -f2)
        print_success "Python 3 found: $PYTHON_VERSION"
    else
        print_error "Python 3 is required but not installed."
        exit 1
    fi
    
    # Check Docker
    if command -v docker &> /dev/null; then
        DOCKER_VERSION=$(docker --version | cut -d' ' -f3 | sed 's/,//')
        print_success "Docker found: $DOCKER_VERSION"
    else
        print_error "Docker is required but not installed."
        exit 1
    fi
    
    # Check Docker Compose
    if command -v docker-compose &> /dev/null; then
        COMPOSE_VERSION=$(docker-compose --version | cut -d' ' -f3 | sed 's/,//')
        print_success "Docker Compose found: $COMPOSE_VERSION"
    else
        print_error "Docker Compose is required but not installed."
        exit 1
    fi
    
    # Check network connectivity
    if ping -c 1 8.8.8.8 &> /dev/null; then
        print_success "Internet connectivity confirmed"
    else
        print_warning "No internet connectivity detected. Some features may not work."
    fi
}

# Function to create backup
create_backup() {
    print_status "Creating backup of existing installation..."
    
    mkdir -p "$BACKUP_DIR"
    
    # Backup existing configuration files
    if [[ -f "docker-compose.yml" ]]; then
        cp docker-compose.yml "$BACKUP_DIR/"
        print_success "Backed up docker-compose.yml"
    fi
    
    if [[ -d "config" ]]; then
        cp -r config "$BACKUP_DIR/"
        print_success "Backed up config directory"
    fi
    
    if [[ -f "discovered_devices.json" ]]; then
        cp discovered_devices.json "$BACKUP_DIR/"
        print_success "Backed up discovered devices"
    fi
    
    print_success "Backup created in: $BACKUP_DIR"
}

# Function to setup database
setup_database() {
    print_status "Setting up PostgreSQL database..."
    
    # Check if PostgreSQL is running
    if ! pg_isready &> /dev/null; then
        print_warning "PostgreSQL is not running. Starting PostgreSQL container..."
        
        # Create PostgreSQL container
        docker run -d \
            --name iot-postgres-v102 \
            --restart unless-stopped \
            -e POSTGRES_DB=iot_control_v102 \
            -e POSTGRES_USER=iot_user \
            -e POSTGRES_PASSWORD=iot_password \
            -p 5432:5432 \
            -v iot_postgres_data:/var/lib/postgresql/data \
            postgres:13
        
        # Wait for PostgreSQL to start
        print_status "Waiting for PostgreSQL to start..."
        sleep 10
        
        # Wait for PostgreSQL to be ready
        for i in {1..30}; do
            if docker exec iot-postgres-v102 pg_isready -U iot_user -d iot_control_v102 &> /dev/null; then
                break
            fi
            sleep 2
        done
    fi
    
    # Apply database schema
    if [[ -f "database-schema-v1.02.sql" ]]; then
        print_status "Applying database schema..."
        docker exec -i iot-postgres-v102 psql -U iot_user -d iot_control_v102 < database-schema-v1.02.sql
        print_success "Database schema applied"
    else
        print_error "Database schema file not found: database-schema-v1.02.sql"
        exit 1
    fi
}

# Function to run discovery
run_discovery() {
    print_status "Starting IO-Link device discovery..."
    
    # Check if discovery script exists
    if [[ ! -f "iolink-discovery-v2.py" ]]; then
        print_error "Discovery script not found: iolink-discovery-v2.py"
        exit 1
    fi
    
    # Install required Python packages
    print_status "Installing required Python packages..."
    pip3 install aiohttp asyncio
    
    # Run discovery
    print_status "Running device discovery..."
    python3 iolink-discovery-v2.py
    
    if [[ -f "discovered_devices.json" ]]; then
        print_success "Device discovery completed"
        print_status "Discovered devices saved to: discovered_devices.json"
    else
        print_warning "No devices were discovered or validated"
    fi
}

# Function to configure units
configure_units() {
    print_status "Configuring units based on discovered devices..."
    
    if [[ ! -f "discovered_devices.json" ]]; then
        print_warning "No discovered devices found. Skipping unit configuration."
        return
    fi
    
    # Read discovered devices
    DEVICES=$(cat discovered_devices.json)
    UNITS=$(echo "$DEVICES" | jq -r '.[] | .unit_number' | sort -u)
    
    for unit in $UNITS; do
        if [[ "$unit" != "null" && "$unit" != "" ]]; then
            print_status "Configuring Unit $unit..."
            ./configure-unit.sh --unit="$unit"
        fi
    done
}

# Function to setup auto-start
setup_auto_start() {
    print_status "Setting up auto-start configuration..."
    
    # Create systemd service file
    cat > /tmp/iot-control-v102.service << EOF
[Unit]
Description=IoT Control Server v1.02
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=$SCRIPT_DIR
ExecStart=/usr/bin/docker-compose up -d
ExecStop=/usr/bin/docker-compose down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF
    
    # Install systemd service
    sudo cp /tmp/iot-control-v102.service /etc/systemd/system/
    sudo systemctl daemon-reload
    sudo systemctl enable iot-control-v102.service
    
    print_success "Auto-start configured with systemd"
}

# Function to setup firewall
setup_firewall() {
    print_status "Configuring firewall..."
    
    # Check if UFW is available
    if command -v ufw &> /dev/null; then
        # Allow required ports
        sudo ufw allow 22/tcp    # SSH
        sudo ufw allow 80/tcp    # HTTP
        sudo ufw allow 443/tcp   # HTTPS
        sudo ufw allow 1883/tcp  # MQTT
        sudo ufw allow 9001/tcp  # MQTT WebSocket
        sudo ufw allow 5432/tcp  # PostgreSQL
        
        # Allow Docker ports (dynamic range)
        sudo ufw allow 3000:40000/tcp
        
        print_success "Firewall configured with UFW"
    else
        print_warning "UFW not found. Please configure firewall manually."
    fi
}

# Function to validate installation
validate_installation() {
    print_status "Validating installation..."
    
    # Check if containers are running
    if docker ps --format "table {{.Names}}\t{{.Status}}" | grep -q "iot-control"; then
        print_success "IoT Control containers are running"
    else
        print_warning "IoT Control containers are not running"
    fi
    
    # Check database connection
    if docker exec iot-postgres-v102 pg_isready -U iot_user -d iot_control_v102 &> /dev/null; then
        print_success "Database connection verified"
    else
        print_warning "Database connection failed"
    fi
    
    # Check discovered devices
    if [[ -f "discovered_devices.json" ]]; then
        DEVICE_COUNT=$(jq length discovered_devices.json)
        print_success "Found $DEVICE_COUNT discovered devices"
    else
        print_warning "No discovered devices found"
    fi
    
    print_success "Installation validation completed"
}

# Function to show help
show_help() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --mode=MODE           Installation mode (discovery, manual, update)"
    echo "  --backup              Create backup before installation"
    echo "  --no-discovery        Skip device discovery"
    echo "  --no-auto-start       Skip auto-start configuration"
    echo "  --no-firewall         Skip firewall configuration"
    echo "  --help                Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 --mode=discovery   # Full discovery-based installation"
    echo "  $0 --mode=manual      # Manual configuration"
    echo "  $0 --backup           # Create backup and install"
}

# Main installation function
main() {
    # Parse command line arguments
    MODE="discovery"
    CREATE_BACKUP=false
    SKIP_DISCOVERY=false
    SKIP_AUTO_START=false
    SKIP_FIREWALL=false
    
    for arg in "$@"; do
        case $arg in
            --mode=*)
                MODE="${arg#*=}"
                shift
                ;;
            --backup)
                CREATE_BACKUP=true
                shift
                ;;
            --no-discovery)
                SKIP_DISCOVERY=true
                shift
                ;;
            --no-auto-start)
                SKIP_AUTO_START=true
                shift
                ;;
            --no-firewall)
                SKIP_FIREWALL=true
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
    
    # Start installation
    print_header
    
    # Initialize log file
    echo "IoT Control Server v1.02 Installation Log" > "$LOG_FILE"
    echo "Started at: $(date)" >> "$LOG_FILE"
    echo "==========================================" >> "$LOG_FILE"
    
    print_status "Installation mode: $MODE"
    
    # Check system requirements
    check_system_requirements
    
    # Create backup if requested
    if [[ "$CREATE_BACKUP" == "true" ]]; then
        create_backup
    fi
    
    # Setup database
    setup_database
    
    # Run discovery if not skipped
    if [[ "$SKIP_DISCOVERY" == "false" ]]; then
        run_discovery
    fi
    
    # Configure units
    configure_units
    
    # Setup auto-start if not skipped
    if [[ "$SKIP_AUTO_START" == "false" ]]; then
        setup_auto_start
    fi
    
    # Setup firewall if not skipped
    if [[ "$SKIP_FIREWALL" == "false" ]]; then
        setup_firewall
    fi
    
    # Validate installation
    validate_installation
    
    # Installation complete
    print_success "Installation completed successfully!"
    echo ""
    echo -e "${GREEN}Next steps:${NC}"
    echo "1. Review discovered devices: cat discovered_devices.json"
    echo "2. Start services: docker-compose up -d"
    echo "3. Access web interface: http://localhost:3000"
    echo "4. Check logs: docker-compose logs"
    echo ""
    echo -e "${YELLOW}Installation log:${NC} $LOG_FILE"
    echo -e "${YELLOW}Backup location:${NC} $BACKUP_DIR"
}

# Run main function with all arguments
main "$@" 