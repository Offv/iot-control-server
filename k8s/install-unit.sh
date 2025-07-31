#!/bin/bash

# IoT Control System - Interactive Unit Installation Script
# Prompts user for unit configuration and installs the unit

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

echo "🚀 IoT Control System - Unit Installation"
echo "========================================="

# Function to validate IP address
validate_ip() {
    local ip=$1
    if [[ $ip =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
        IFS='.' read -r -a ip_parts <<< "$ip"
        for part in "${ip_parts[@]}"; do
            if [ "$part" -lt 0 ] || [ "$part" -gt 255 ]; then
                return 1
            fi
        done
        return 0
    else
        return 1
    fi
}

# Function to validate device ID
validate_device_id() {
    local device_id=$1
    if [[ $device_id =~ ^[0-9A-Fa-f]{2}-[0-9A-Fa-f]{2}-[0-9A-Fa-f]{2}-[0-9A-Fa-f]{2}-[0-9A-Fa-f]{2}-[0-9A-Fa-f]{2}$ ]]; then
        return 0
    else
        return 1
    fi
}

# Interactive configuration
echo ""
print_status "Please provide the unit configuration:"

# Get unit number
while true; do
    read -p "Enter unit number (1-9): " UNIT_NUMBER
    if [[ $UNIT_NUMBER =~ ^[1-9]$ ]]; then
        break
    else
        print_error "Please enter a valid unit number (1-9)"
    fi
done

# Calculate default subnet
DEFAULT_SUBNET=$((20 + ($UNIT_NUMBER - 1) * 10))
DEFAULT_HTR_A_IP="${DEFAULT_SUBNET}.29"
DEFAULT_HTR_B_IP="${DEFAULT_SUBNET}.33"

echo ""
print_status "Default network configuration for Unit $UNIT_NUMBER:"
echo "  Subnet: ${DEFAULT_SUBNET}.x.x.x"
echo "  HTR-A (IO-Link A): ${DEFAULT_HTR_A_IP}"
echo "  HTR-B (IO-Link B): ${DEFAULT_HTR_B_IP}"

# Get HTR-A IP
while true; do
    read -p "Enter HTR-A IP address [${DEFAULT_HTR_A_IP}]: " HTR_A_IP
    HTR_A_IP=${HTR_A_IP:-$DEFAULT_HTR_A_IP}
    if validate_ip "$HTR_A_IP"; then
        break
    else
        print_error "Please enter a valid IP address"
    fi
done

# Get HTR-B IP
while true; do
    read -p "Enter HTR-B IP address [${DEFAULT_HTR_B_IP}]: " HTR_B_IP
    HTR_B_IP=${HTR_B_IP:-$DEFAULT_HTR_B_IP}
    if validate_ip "$HTR_B_IP"; then
        break
    else
        print_error "Please enter a valid IP address"
    fi
done

# Get HTR-A device ID
DEFAULT_HTR_A_DEVICE_ID="00-02-01-6D-55-$(printf '%02X' $((0x8A + ($UNIT_NUMBER - 1) * 2)))"
while true; do
    read -p "Enter HTR-A device ID [${DEFAULT_HTR_A_DEVICE_ID}]: " HTR_A_DEVICE_ID
    HTR_A_DEVICE_ID=${HTR_A_DEVICE_ID:-$DEFAULT_HTR_A_DEVICE_ID}
    if validate_device_id "$HTR_A_DEVICE_ID"; then
        break
    else
        print_error "Please enter a valid device ID (format: XX-XX-XX-XX-XX-XX)"
    fi
done

# Get HTR-B device ID
DEFAULT_HTR_B_DEVICE_ID="00-02-01-6D-55-$(printf '%02X' $((0x8A + ($UNIT_NUMBER - 1) * 2 + 1)))"
while true; do
    read -p "Enter HTR-B device ID [${DEFAULT_HTR_B_DEVICE_ID}]: " HTR_B_DEVICE_ID
    HTR_B_DEVICE_ID=${HTR_B_DEVICE_ID:-$DEFAULT_HTR_B_DEVICE_ID}
    if validate_device_id "$HTR_B_DEVICE_ID"; then
        break
    else
        print_error "Please enter a valid device ID (format: XX-XX-XX-XX-XX-XX)"
    fi
done

# Extract subnet from HTR-A IP
UNIT_SUBNET=$(echo $HTR_A_IP | cut -d. -f1-3)

# Pad unit number to 3 digits
UNIT_NUMBER_PADDED=$(printf '%03d' $UNIT_NUMBER)

echo ""
print_status "Configuration Summary:"
echo "==========================="
echo "Unit Number: $UNIT_NUMBER"
echo "Domain: unit${UNIT_NUMBER}htr.system"
echo "Subnet: ${UNIT_SUBNET}.x.x.x"
echo "HTR-A: $HTR_A_IP (Device ID: $HTR_A_DEVICE_ID)"
echo "HTR-B: $HTR_B_IP (Device ID: $HTR_B_DEVICE_ID)"
echo "Backend Port: 38${UNIT_NUMBER_PADDED}"
echo "Frontend Port: 33${UNIT_NUMBER_PADDED}"

# Confirm installation
echo ""
read -p "Proceed with installation? (y/N): " CONFIRM
if [[ ! $CONFIRM =~ ^[Yy]$ ]]; then
    print_warning "Installation cancelled"
    exit 0
fi

# Check if template exists
if [ ! -f "k8s/unit-template.yaml" ]; then
    print_error "Template file k8s/unit-template.yaml not found!"
    exit 1
fi

# Create unit configuration file
UNIT_FILE="k8s/unit${UNIT_NUMBER}-dev.yaml"

print_status "Generating unit configuration file: $UNIT_FILE"

# Replace placeholders in template
sed -e "s/{{UNIT_NUMBER}}/$UNIT_NUMBER/g" \
    -e "s/{{UNIT_NUMBER_PADDED}}/$UNIT_NUMBER_PADDED/g" \
    -e "s/{{UNIT_SUBNET}}/$UNIT_SUBNET/g" \
    -e "s/{{HTR_A_DEVICE_ID}}/$HTR_A_DEVICE_ID/g" \
    -e "s/{{HTR_B_DEVICE_ID}}/$HTR_B_DEVICE_ID/g" \
    k8s/unit-template.yaml > "$UNIT_FILE"

# Update HTR IP addresses in the generated file
sed -i "s/${UNIT_SUBNET}\.29/$HTR_A_IP/g" "$UNIT_FILE"
sed -i "s/${UNIT_SUBNET}\.33/$HTR_B_IP/g" "$UNIT_FILE"

print_success "Unit configuration file created: $UNIT_FILE"

# Create ingress update script
INGRESS_UPDATE_SCRIPT="k8s/update-ingress-${UNIT_NUMBER}.sh"

cat > "$INGRESS_UPDATE_SCRIPT" << EOF
#!/bin/bash
# Update ingress with new unit configuration

echo "Updating ingress for Unit $UNIT_NUMBER..."

# Add ingress rules to dev-deployment.yaml
cat >> k8s/dev-deployment.yaml << 'INGRESS_UPDATE'
  - host: unit${UNIT_NUMBER}htr.system
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: frontend-unit${UNIT_NUMBER}-service-dev
            port:
              number: 3000
      - path: /api
        pathType: Prefix
        backend:
          service:
            name: backend-unit${UNIT_NUMBER}-service-dev
            port:
              number: 8000
INGRESS_UPDATE

echo "Ingress updated. You can now apply the new unit:"
echo "kubectl apply -f $UNIT_FILE"
echo "kubectl apply -f k8s/dev-deployment.yaml"
EOF

chmod +x "$INGRESS_UPDATE_SCRIPT"

print_success "Ingress update script created: $INGRESS_UPDATE_SCRIPT"

# Create deployment script
DEPLOY_SCRIPT="k8s/deploy-unit${UNIT_NUMBER}.sh"

cat > "$DEPLOY_SCRIPT" << EOF
#!/bin/bash
# Deploy Unit $UNIT_NUMBER

echo "🚀 Deploying Unit $UNIT_NUMBER..."

# Apply unit configuration
kubectl apply -f $UNIT_FILE

# Update ingress
./$INGRESS_UPDATE_SCRIPT

# Wait for pods to be ready
echo "Waiting for Unit $UNIT_NUMBER pods to be ready..."
kubectl wait --for=condition=ready pod -l app=backend-unit${UNIT_NUMBER}-dev -n iot-control-dev --timeout=120s
kubectl wait --for=condition=ready pod -l app=frontend-unit${UNIT_NUMBER}-dev -n iot-control-dev --timeout=120s

echo "✅ Unit $UNIT_NUMBER deployed successfully!"
echo ""
echo "Access URLs:"
echo "  Frontend: http://unit${UNIT_NUMBER}htr.system (or http://localhost:33${UNIT_NUMBER_PADDED})"
echo "  Backend API: http://unit${UNIT_NUMBER}htr.system/api (or http://localhost:38${UNIT_NUMBER_PADDED})"
echo ""
echo "Network Configuration:"
echo "  Subnet: ${UNIT_SUBNET}.x.x.x"
echo "  HTR-A: $HTR_A_IP (IO-Link A)"
echo "  HTR-B: $HTR_B_IP (IO-Link B)"
echo ""
echo "MQTT Topics:"
echo "  HTR-A: instrument/unit${UNIT_NUMBER}/htr_a/temperature"
echo "  HTR-B: instrument/unit${UNIT_NUMBER}/htr_b/temperature"
echo ""
echo "Add to /etc/hosts for domain access:"
echo "127.0.0.1 unit${UNIT_NUMBER}htr.system"
EOF

chmod +x "$DEPLOY_SCRIPT"

print_success "Deployment script created: $DEPLOY_SCRIPT"

# Create network configuration script
NETWORK_SCRIPT="k8s/configure-network-${UNIT_NUMBER}.sh"

cat > "$NETWORK_SCRIPT" << EOF
#!/bin/bash
# Configure network for Unit $UNIT_NUMBER

echo "🔧 Configuring network for Unit $UNIT_NUMBER..."

# Add route for subnet if needed
echo "Adding route for subnet ${UNIT_SUBNET}.0.0/16..."
sudo ip route add ${UNIT_SUBNET}.0.0/16 dev eth0 2>/dev/null || echo "Route may already exist"

# Test connectivity
echo "Testing connectivity to HTR-A ($HTR_A_IP)..."
ping -c 3 $HTR_A_IP

echo "Testing connectivity to HTR-B ($HTR_B_IP)..."
ping -c 3 $HTR_B_IP

echo "✅ Network configuration completed!"
EOF

chmod +x "$NETWORK_SCRIPT"

print_success "Network configuration script created: $NETWORK_SCRIPT"

echo ""
print_success "Unit $UNIT_NUMBER installation completed!"
echo ""
print_status "Next steps:"
echo "1. Configure network: ./$NETWORK_SCRIPT"
echo "2. Deploy the unit: ./$DEPLOY_SCRIPT"
echo "3. Add to /etc/hosts: 127.0.0.1 unit${UNIT_NUMBER}htr.system"
echo "4. Access at: http://unit${UNIT_NUMBER}htr.system"

echo ""
print_status "Configuration files created:"
echo "  - $UNIT_FILE (Kubernetes configuration)"
echo "  - $INGRESS_UPDATE_SCRIPT (Ingress update)"
echo "  - $DEPLOY_SCRIPT (Deployment script)"
echo "  - $NETWORK_SCRIPT (Network configuration)"

echo ""
print_warning "Important notes:"
echo "1. Ensure both IO-Link masters are accessible:"
echo "   - HTR-A: $HTR_A_IP"
echo "   - HTR-B: $HTR_B_IP"
echo "2. Verify the device IDs are correct for your hardware"
echo "3. Configure network routing for subnet ${UNIT_SUBNET}.0.0/16"
echo "4. Test both MQTT connections and temperature readings" 

# IoT Control System - Interactive Unit Installation Script
# Prompts user for unit configuration and installs the unit

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

echo "🚀 IoT Control System - Unit Installation"
echo "========================================="

# Function to validate IP address
validate_ip() {
    local ip=$1
    if [[ $ip =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
        IFS='.' read -r -a ip_parts <<< "$ip"
        for part in "${ip_parts[@]}"; do
            if [ "$part" -lt 0 ] || [ "$part" -gt 255 ]; then
                return 1
            fi
        done
        return 0
    else
        return 1
    fi
}

# Function to validate device ID
validate_device_id() {
    local device_id=$1
    if [[ $device_id =~ ^[0-9A-Fa-f]{2}-[0-9A-Fa-f]{2}-[0-9A-Fa-f]{2}-[0-9A-Fa-f]{2}-[0-9A-Fa-f]{2}-[0-9A-Fa-f]{2}$ ]]; then
        return 0
    else
        return 1
    fi
}

# Interactive configuration
echo ""
print_status "Please provide the unit configuration:"

# Get unit number
while true; do
    read -p "Enter unit number (1-9): " UNIT_NUMBER
    if [[ $UNIT_NUMBER =~ ^[1-9]$ ]]; then
        break
    else
        print_error "Please enter a valid unit number (1-9)"
    fi
done

# Calculate default subnet
DEFAULT_SUBNET=$((20 + ($UNIT_NUMBER - 1) * 10))
DEFAULT_HTR_A_IP="${DEFAULT_SUBNET}.29"
DEFAULT_HTR_B_IP="${DEFAULT_SUBNET}.33"

echo ""
print_status "Default network configuration for Unit $UNIT_NUMBER:"
echo "  Subnet: ${DEFAULT_SUBNET}.x.x.x"
echo "  HTR-A (IO-Link A): ${DEFAULT_HTR_A_IP}"
echo "  HTR-B (IO-Link B): ${DEFAULT_HTR_B_IP}"

# Get HTR-A IP
while true; do
    read -p "Enter HTR-A IP address [${DEFAULT_HTR_A_IP}]: " HTR_A_IP
    HTR_A_IP=${HTR_A_IP:-$DEFAULT_HTR_A_IP}
    if validate_ip "$HTR_A_IP"; then
        break
    else
        print_error "Please enter a valid IP address"
    fi
done

# Get HTR-B IP
while true; do
    read -p "Enter HTR-B IP address [${DEFAULT_HTR_B_IP}]: " HTR_B_IP
    HTR_B_IP=${HTR_B_IP:-$DEFAULT_HTR_B_IP}
    if validate_ip "$HTR_B_IP"; then
        break
    else
        print_error "Please enter a valid IP address"
    fi
done

# Get HTR-A device ID
DEFAULT_HTR_A_DEVICE_ID="00-02-01-6D-55-$(printf '%02X' $((0x8A + ($UNIT_NUMBER - 1) * 2)))"
while true; do
    read -p "Enter HTR-A device ID [${DEFAULT_HTR_A_DEVICE_ID}]: " HTR_A_DEVICE_ID
    HTR_A_DEVICE_ID=${HTR_A_DEVICE_ID:-$DEFAULT_HTR_A_DEVICE_ID}
    if validate_device_id "$HTR_A_DEVICE_ID"; then
        break
    else
        print_error "Please enter a valid device ID (format: XX-XX-XX-XX-XX-XX)"
    fi
done

# Get HTR-B device ID
DEFAULT_HTR_B_DEVICE_ID="00-02-01-6D-55-$(printf '%02X' $((0x8A + ($UNIT_NUMBER - 1) * 2 + 1)))"
while true; do
    read -p "Enter HTR-B device ID [${DEFAULT_HTR_B_DEVICE_ID}]: " HTR_B_DEVICE_ID
    HTR_B_DEVICE_ID=${HTR_B_DEVICE_ID:-$DEFAULT_HTR_B_DEVICE_ID}
    if validate_device_id "$HTR_B_DEVICE_ID"; then
        break
    else
        print_error "Please enter a valid device ID (format: XX-XX-XX-XX-XX-XX)"
    fi
done

# Extract subnet from HTR-A IP
UNIT_SUBNET=$(echo $HTR_A_IP | cut -d. -f1-3)

# Pad unit number to 3 digits
UNIT_NUMBER_PADDED=$(printf '%03d' $UNIT_NUMBER)

echo ""
print_status "Configuration Summary:"
echo "==========================="
echo "Unit Number: $UNIT_NUMBER"
echo "Domain: unit${UNIT_NUMBER}htr.system"
echo "Subnet: ${UNIT_SUBNET}.x.x.x"
echo "HTR-A: $HTR_A_IP (Device ID: $HTR_A_DEVICE_ID)"
echo "HTR-B: $HTR_B_IP (Device ID: $HTR_B_DEVICE_ID)"
echo "Backend Port: 38${UNIT_NUMBER_PADDED}"
echo "Frontend Port: 33${UNIT_NUMBER_PADDED}"

# Confirm installation
echo ""
read -p "Proceed with installation? (y/N): " CONFIRM
if [[ ! $CONFIRM =~ ^[Yy]$ ]]; then
    print_warning "Installation cancelled"
    exit 0
fi

# Check if template exists
if [ ! -f "k8s/unit-template.yaml" ]; then
    print_error "Template file k8s/unit-template.yaml not found!"
    exit 1
fi

# Create unit configuration file
UNIT_FILE="k8s/unit${UNIT_NUMBER}-dev.yaml"

print_status "Generating unit configuration file: $UNIT_FILE"

# Replace placeholders in template
sed -e "s/{{UNIT_NUMBER}}/$UNIT_NUMBER/g" \
    -e "s/{{UNIT_NUMBER_PADDED}}/$UNIT_NUMBER_PADDED/g" \
    -e "s/{{UNIT_SUBNET}}/$UNIT_SUBNET/g" \
    -e "s/{{HTR_A_DEVICE_ID}}/$HTR_A_DEVICE_ID/g" \
    -e "s/{{HTR_B_DEVICE_ID}}/$HTR_B_DEVICE_ID/g" \
    k8s/unit-template.yaml > "$UNIT_FILE"

# Update HTR IP addresses in the generated file
sed -i "s/${UNIT_SUBNET}\.29/$HTR_A_IP/g" "$UNIT_FILE"
sed -i "s/${UNIT_SUBNET}\.33/$HTR_B_IP/g" "$UNIT_FILE"

print_success "Unit configuration file created: $UNIT_FILE"

# Create ingress update script
INGRESS_UPDATE_SCRIPT="k8s/update-ingress-${UNIT_NUMBER}.sh"

cat > "$INGRESS_UPDATE_SCRIPT" << EOF
#!/bin/bash
# Update ingress with new unit configuration

echo "Updating ingress for Unit $UNIT_NUMBER..."

# Add ingress rules to dev-deployment.yaml
cat >> k8s/dev-deployment.yaml << 'INGRESS_UPDATE'
  - host: unit${UNIT_NUMBER}htr.system
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: frontend-unit${UNIT_NUMBER}-service-dev
            port:
              number: 3000
      - path: /api
        pathType: Prefix
        backend:
          service:
            name: backend-unit${UNIT_NUMBER}-service-dev
            port:
              number: 8000
INGRESS_UPDATE

echo "Ingress updated. You can now apply the new unit:"
echo "kubectl apply -f $UNIT_FILE"
echo "kubectl apply -f k8s/dev-deployment.yaml"
EOF

chmod +x "$INGRESS_UPDATE_SCRIPT"

print_success "Ingress update script created: $INGRESS_UPDATE_SCRIPT"

# Create deployment script
DEPLOY_SCRIPT="k8s/deploy-unit${UNIT_NUMBER}.sh"

cat > "$DEPLOY_SCRIPT" << EOF
#!/bin/bash
# Deploy Unit $UNIT_NUMBER

echo "🚀 Deploying Unit $UNIT_NUMBER..."

# Apply unit configuration
kubectl apply -f $UNIT_FILE

# Update ingress
./$INGRESS_UPDATE_SCRIPT

# Wait for pods to be ready
echo "Waiting for Unit $UNIT_NUMBER pods to be ready..."
kubectl wait --for=condition=ready pod -l app=backend-unit${UNIT_NUMBER}-dev -n iot-control-dev --timeout=120s
kubectl wait --for=condition=ready pod -l app=frontend-unit${UNIT_NUMBER}-dev -n iot-control-dev --timeout=120s

echo "✅ Unit $UNIT_NUMBER deployed successfully!"
echo ""
echo "Access URLs:"
echo "  Frontend: http://unit${UNIT_NUMBER}htr.system (or http://localhost:33${UNIT_NUMBER_PADDED})"
echo "  Backend API: http://unit${UNIT_NUMBER}htr.system/api (or http://localhost:38${UNIT_NUMBER_PADDED})"
echo ""
echo "Network Configuration:"
echo "  Subnet: ${UNIT_SUBNET}.x.x.x"
echo "  HTR-A: $HTR_A_IP (IO-Link A)"
echo "  HTR-B: $HTR_B_IP (IO-Link B)"
echo ""
echo "MQTT Topics:"
echo "  HTR-A: instrument/unit${UNIT_NUMBER}/htr_a/temperature"
echo "  HTR-B: instrument/unit${UNIT_NUMBER}/htr_b/temperature"
echo ""
echo "Add to /etc/hosts for domain access:"
echo "127.0.0.1 unit${UNIT_NUMBER}htr.system"
EOF

chmod +x "$DEPLOY_SCRIPT"

print_success "Deployment script created: $DEPLOY_SCRIPT"

# Create network configuration script
NETWORK_SCRIPT="k8s/configure-network-${UNIT_NUMBER}.sh"

cat > "$NETWORK_SCRIPT" << EOF
#!/bin/bash
# Configure network for Unit $UNIT_NUMBER

echo "🔧 Configuring network for Unit $UNIT_NUMBER..."

# Add route for subnet if needed
echo "Adding route for subnet ${UNIT_SUBNET}.0.0/16..."
sudo ip route add ${UNIT_SUBNET}.0.0/16 dev eth0 2>/dev/null || echo "Route may already exist"

# Test connectivity
echo "Testing connectivity to HTR-A ($HTR_A_IP)..."
ping -c 3 $HTR_A_IP

echo "Testing connectivity to HTR-B ($HTR_B_IP)..."
ping -c 3 $HTR_B_IP

echo "✅ Network configuration completed!"
EOF

chmod +x "$NETWORK_SCRIPT"

print_success "Network configuration script created: $NETWORK_SCRIPT"

echo ""
print_success "Unit $UNIT_NUMBER installation completed!"
echo ""
print_status "Next steps:"
echo "1. Configure network: ./$NETWORK_SCRIPT"
echo "2. Deploy the unit: ./$DEPLOY_SCRIPT"
echo "3. Add to /etc/hosts: 127.0.0.1 unit${UNIT_NUMBER}htr.system"
echo "4. Access at: http://unit${UNIT_NUMBER}htr.system"

echo ""
print_status "Configuration files created:"
echo "  - $UNIT_FILE (Kubernetes configuration)"
echo "  - $INGRESS_UPDATE_SCRIPT (Ingress update)"
echo "  - $DEPLOY_SCRIPT (Deployment script)"
echo "  - $NETWORK_SCRIPT (Network configuration)"

echo ""
print_warning "Important notes:"
echo "1. Ensure both IO-Link masters are accessible:"
echo "   - HTR-A: $HTR_A_IP"
echo "   - HTR-B: $HTR_B_IP"
echo "2. Verify the device IDs are correct for your hardware"
echo "3. Configure network routing for subnet ${UNIT_SUBNET}.0.0/16"
echo "4. Test both MQTT connections and temperature readings" 

# IoT Control System - Interactive Unit Installation Script
# Prompts user for unit configuration and installs the unit

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

echo "🚀 IoT Control System - Unit Installation"
echo "========================================="

# Function to validate IP address
validate_ip() {
    local ip=$1
    if [[ $ip =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
        IFS='.' read -r -a ip_parts <<< "$ip"
        for part in "${ip_parts[@]}"; do
            if [ "$part" -lt 0 ] || [ "$part" -gt 255 ]; then
                return 1
            fi
        done
        return 0
    else
        return 1
    fi
}

# Function to validate device ID
validate_device_id() {
    local device_id=$1
    if [[ $device_id =~ ^[0-9A-Fa-f]{2}-[0-9A-Fa-f]{2}-[0-9A-Fa-f]{2}-[0-9A-Fa-f]{2}-[0-9A-Fa-f]{2}-[0-9A-Fa-f]{2}$ ]]; then
        return 0
    else
        return 1
    fi
}

# Interactive configuration
echo ""
print_status "Please provide the unit configuration:"

# Get unit number
while true; do
    read -p "Enter unit number (1-9): " UNIT_NUMBER
    if [[ $UNIT_NUMBER =~ ^[1-9]$ ]]; then
        break
    else
        print_error "Please enter a valid unit number (1-9)"
    fi
done

# Calculate default subnet
DEFAULT_SUBNET=$((20 + ($UNIT_NUMBER - 1) * 10))
DEFAULT_HTR_A_IP="${DEFAULT_SUBNET}.29"
DEFAULT_HTR_B_IP="${DEFAULT_SUBNET}.33"

echo ""
print_status "Default network configuration for Unit $UNIT_NUMBER:"
echo "  Subnet: ${DEFAULT_SUBNET}.x.x.x"
echo "  HTR-A (IO-Link A): ${DEFAULT_HTR_A_IP}"
echo "  HTR-B (IO-Link B): ${DEFAULT_HTR_B_IP}"

# Get HTR-A IP
while true; do
    read -p "Enter HTR-A IP address [${DEFAULT_HTR_A_IP}]: " HTR_A_IP
    HTR_A_IP=${HTR_A_IP:-$DEFAULT_HTR_A_IP}
    if validate_ip "$HTR_A_IP"; then
        break
    else
        print_error "Please enter a valid IP address"
    fi
done

# Get HTR-B IP
while true; do
    read -p "Enter HTR-B IP address [${DEFAULT_HTR_B_IP}]: " HTR_B_IP
    HTR_B_IP=${HTR_B_IP:-$DEFAULT_HTR_B_IP}
    if validate_ip "$HTR_B_IP"; then
        break
    else
        print_error "Please enter a valid IP address"
    fi
done

# Get HTR-A device ID
DEFAULT_HTR_A_DEVICE_ID="00-02-01-6D-55-$(printf '%02X' $((0x8A + ($UNIT_NUMBER - 1) * 2)))"
while true; do
    read -p "Enter HTR-A device ID [${DEFAULT_HTR_A_DEVICE_ID}]: " HTR_A_DEVICE_ID
    HTR_A_DEVICE_ID=${HTR_A_DEVICE_ID:-$DEFAULT_HTR_A_DEVICE_ID}
    if validate_device_id "$HTR_A_DEVICE_ID"; then
        break
    else
        print_error "Please enter a valid device ID (format: XX-XX-XX-XX-XX-XX)"
    fi
done

# Get HTR-B device ID
DEFAULT_HTR_B_DEVICE_ID="00-02-01-6D-55-$(printf '%02X' $((0x8A + ($UNIT_NUMBER - 1) * 2 + 1)))"
while true; do
    read -p "Enter HTR-B device ID [${DEFAULT_HTR_B_DEVICE_ID}]: " HTR_B_DEVICE_ID
    HTR_B_DEVICE_ID=${HTR_B_DEVICE_ID:-$DEFAULT_HTR_B_DEVICE_ID}
    if validate_device_id "$HTR_B_DEVICE_ID"; then
        break
    else
        print_error "Please enter a valid device ID (format: XX-XX-XX-XX-XX-XX)"
    fi
done

# Extract subnet from HTR-A IP
UNIT_SUBNET=$(echo $HTR_A_IP | cut -d. -f1-3)

# Pad unit number to 3 digits
UNIT_NUMBER_PADDED=$(printf '%03d' $UNIT_NUMBER)

echo ""
print_status "Configuration Summary:"
echo "==========================="
echo "Unit Number: $UNIT_NUMBER"
echo "Domain: unit${UNIT_NUMBER}htr.system"
echo "Subnet: ${UNIT_SUBNET}.x.x.x"
echo "HTR-A: $HTR_A_IP (Device ID: $HTR_A_DEVICE_ID)"
echo "HTR-B: $HTR_B_IP (Device ID: $HTR_B_DEVICE_ID)"
echo "Backend Port: 38${UNIT_NUMBER_PADDED}"
echo "Frontend Port: 33${UNIT_NUMBER_PADDED}"

# Confirm installation
echo ""
read -p "Proceed with installation? (y/N): " CONFIRM
if [[ ! $CONFIRM =~ ^[Yy]$ ]]; then
    print_warning "Installation cancelled"
    exit 0
fi

# Check if template exists
if [ ! -f "k8s/unit-template.yaml" ]; then
    print_error "Template file k8s/unit-template.yaml not found!"
    exit 1
fi

# Create unit configuration file
UNIT_FILE="k8s/unit${UNIT_NUMBER}-dev.yaml"

print_status "Generating unit configuration file: $UNIT_FILE"

# Replace placeholders in template
sed -e "s/{{UNIT_NUMBER}}/$UNIT_NUMBER/g" \
    -e "s/{{UNIT_NUMBER_PADDED}}/$UNIT_NUMBER_PADDED/g" \
    -e "s/{{UNIT_SUBNET}}/$UNIT_SUBNET/g" \
    -e "s/{{HTR_A_DEVICE_ID}}/$HTR_A_DEVICE_ID/g" \
    -e "s/{{HTR_B_DEVICE_ID}}/$HTR_B_DEVICE_ID/g" \
    k8s/unit-template.yaml > "$UNIT_FILE"

# Update HTR IP addresses in the generated file
sed -i "s/${UNIT_SUBNET}\.29/$HTR_A_IP/g" "$UNIT_FILE"
sed -i "s/${UNIT_SUBNET}\.33/$HTR_B_IP/g" "$UNIT_FILE"

print_success "Unit configuration file created: $UNIT_FILE"

# Create ingress update script
INGRESS_UPDATE_SCRIPT="k8s/update-ingress-${UNIT_NUMBER}.sh"

cat > "$INGRESS_UPDATE_SCRIPT" << EOF
#!/bin/bash
# Update ingress with new unit configuration

echo "Updating ingress for Unit $UNIT_NUMBER..."

# Add ingress rules to dev-deployment.yaml
cat >> k8s/dev-deployment.yaml << 'INGRESS_UPDATE'
  - host: unit${UNIT_NUMBER}htr.system
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: frontend-unit${UNIT_NUMBER}-service-dev
            port:
              number: 3000
      - path: /api
        pathType: Prefix
        backend:
          service:
            name: backend-unit${UNIT_NUMBER}-service-dev
            port:
              number: 8000
INGRESS_UPDATE

echo "Ingress updated. You can now apply the new unit:"
echo "kubectl apply -f $UNIT_FILE"
echo "kubectl apply -f k8s/dev-deployment.yaml"
EOF

chmod +x "$INGRESS_UPDATE_SCRIPT"

print_success "Ingress update script created: $INGRESS_UPDATE_SCRIPT"

# Create deployment script
DEPLOY_SCRIPT="k8s/deploy-unit${UNIT_NUMBER}.sh"

cat > "$DEPLOY_SCRIPT" << EOF
#!/bin/bash
# Deploy Unit $UNIT_NUMBER

echo "🚀 Deploying Unit $UNIT_NUMBER..."

# Apply unit configuration
kubectl apply -f $UNIT_FILE

# Update ingress
./$INGRESS_UPDATE_SCRIPT

# Wait for pods to be ready
echo "Waiting for Unit $UNIT_NUMBER pods to be ready..."
kubectl wait --for=condition=ready pod -l app=backend-unit${UNIT_NUMBER}-dev -n iot-control-dev --timeout=120s
kubectl wait --for=condition=ready pod -l app=frontend-unit${UNIT_NUMBER}-dev -n iot-control-dev --timeout=120s

echo "✅ Unit $UNIT_NUMBER deployed successfully!"
echo ""
echo "Access URLs:"
echo "  Frontend: http://unit${UNIT_NUMBER}htr.system (or http://localhost:33${UNIT_NUMBER_PADDED})"
echo "  Backend API: http://unit${UNIT_NUMBER}htr.system/api (or http://localhost:38${UNIT_NUMBER_PADDED})"
echo ""
echo "Network Configuration:"
echo "  Subnet: ${UNIT_SUBNET}.x.x.x"
echo "  HTR-A: $HTR_A_IP (IO-Link A)"
echo "  HTR-B: $HTR_B_IP (IO-Link B)"
echo ""
echo "MQTT Topics:"
echo "  HTR-A: instrument/unit${UNIT_NUMBER}/htr_a/temperature"
echo "  HTR-B: instrument/unit${UNIT_NUMBER}/htr_b/temperature"
echo ""
echo "Add to /etc/hosts for domain access:"
echo "127.0.0.1 unit${UNIT_NUMBER}htr.system"
EOF

chmod +x "$DEPLOY_SCRIPT"

print_success "Deployment script created: $DEPLOY_SCRIPT"

# Create network configuration script
NETWORK_SCRIPT="k8s/configure-network-${UNIT_NUMBER}.sh"

cat > "$NETWORK_SCRIPT" << EOF
#!/bin/bash
# Configure network for Unit $UNIT_NUMBER

echo "🔧 Configuring network for Unit $UNIT_NUMBER..."

# Add route for subnet if needed
echo "Adding route for subnet ${UNIT_SUBNET}.0.0/16..."
sudo ip route add ${UNIT_SUBNET}.0.0/16 dev eth0 2>/dev/null || echo "Route may already exist"

# Test connectivity
echo "Testing connectivity to HTR-A ($HTR_A_IP)..."
ping -c 3 $HTR_A_IP

echo "Testing connectivity to HTR-B ($HTR_B_IP)..."
ping -c 3 $HTR_B_IP

echo "✅ Network configuration completed!"
EOF

chmod +x "$NETWORK_SCRIPT"

print_success "Network configuration script created: $NETWORK_SCRIPT"

echo ""
print_success "Unit $UNIT_NUMBER installation completed!"
echo ""
print_status "Next steps:"
echo "1. Configure network: ./$NETWORK_SCRIPT"
echo "2. Deploy the unit: ./$DEPLOY_SCRIPT"
echo "3. Add to /etc/hosts: 127.0.0.1 unit${UNIT_NUMBER}htr.system"
echo "4. Access at: http://unit${UNIT_NUMBER}htr.system"

echo ""
print_status "Configuration files created:"
echo "  - $UNIT_FILE (Kubernetes configuration)"
echo "  - $INGRESS_UPDATE_SCRIPT (Ingress update)"
echo "  - $DEPLOY_SCRIPT (Deployment script)"
echo "  - $NETWORK_SCRIPT (Network configuration)"

echo ""
print_warning "Important notes:"
echo "1. Ensure both IO-Link masters are accessible:"
echo "   - HTR-A: $HTR_A_IP"
echo "   - HTR-B: $HTR_B_IP"
echo "2. Verify the device IDs are correct for your hardware"
echo "3. Configure network routing for subnet ${UNIT_SUBNET}.0.0/16"
echo "4. Test both MQTT connections and temperature readings" 