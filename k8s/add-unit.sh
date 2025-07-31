#!/bin/bash

# IoT Control System - Add Unit Script
# Easily add new units using the unit template
# Each unit has 2 HTRs (A & B) with separate IO-Link masters

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

echo "🔧 IoT Control System - Add New Unit"
echo "===================================="

# Check if unit number is provided
if [ $# -lt 1 ]; then
    print_error "Usage: $0 <unit_number> [htr_a_device_id] [htr_b_device_id]"
    echo ""
    print_status "Example: $0 1"
    echo ""
    print_status "This will create Unit 1 with:"
    echo "  - Domain: unit1htr.system"
    echo "  - Subnet: 20.x.x.x"
    echo "  - HTR-A: 20.29 (IO-Link A)"
    echo "  - HTR-B: 20.33 (IO-Link B)"
    echo "  - Ports: 38001 (backend), 33001 (frontend)"
    echo ""
    print_status "Network Architecture:"
    echo "  Unit 1: Subnet 20.x.x.x (HTR-A: 20.29, HTR-B: 20.33)"
    echo "  Unit 2: Subnet 30.x.x.x (HTR-A: 30.29, HTR-B: 30.33)"
    echo "  Unit 3: Subnet 40.x.x.x (HTR-A: 40.29, HTR-B: 40.33)"
    echo "  Unit 4: Subnet 50.x.x.x (HTR-A: 50.29, HTR-B: 50.33)"
    echo "  And so on..."
    exit 1
fi

UNIT_NUMBER=$1
HTR_A_DEVICE_ID=${2:-"00-02-01-6D-55-$(printf '%02X' $((0x8A + ($UNIT_NUMBER - 1) * 2)))}"}
HTR_B_DEVICE_ID=${3:-"00-02-01-6D-55-$(printf '%02X' $((0x8A + ($UNIT_NUMBER - 1) * 2 + 1)))}"}

# Calculate subnet (20, 30, 40, 50, etc.)
UNIT_SUBNET=$((20 + ($UNIT_NUMBER - 1) * 10))

# Pad unit number to 3 digits
UNIT_NUMBER_PADDED=$(printf '%03d' $UNIT_NUMBER)

print_status "Creating Unit $UNIT_NUMBER with the following configuration:"
echo "  Domain: unit${UNIT_NUMBER}htr.system"
echo "  Subnet: ${UNIT_SUBNET}.x.x.x"
echo "  HTR-A: ${UNIT_SUBNET}.29 (IO-Link A) - Device ID: ${HTR_A_DEVICE_ID}"
echo "  HTR-B: ${UNIT_SUBNET}.33 (IO-Link B) - Device ID: ${HTR_B_DEVICE_ID}"
echo "  Backend Port: 38${UNIT_NUMBER_PADDED}"
echo "  Frontend Port: 33${UNIT_NUMBER_PADDED}"

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
echo "  HTR-A: ${UNIT_SUBNET}.29 (IO-Link A)"
echo "  HTR-B: ${UNIT_SUBNET}.33 (IO-Link B)"
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

echo ""
print_status "Next steps:"
echo "1. Review the generated configuration: cat $UNIT_FILE"
echo "2. Deploy the unit: ./$DEPLOY_SCRIPT"
echo "3. Add to /etc/hosts: 127.0.0.1 unit${UNIT_NUMBER}htr.system"
echo "4. Access at: http://unit${UNIT_NUMBER}htr.system"

echo ""
print_status "Unit $UNIT_NUMBER Configuration Summary:"
echo "=============================================="
echo "Domain: unit${UNIT_NUMBER}htr.system"
echo "Subnet: ${UNIT_SUBNET}.x.x.x"
echo "HTR-A: ${UNIT_SUBNET}.29 (IO-Link A) - ${HTR_A_DEVICE_ID}"
echo "HTR-B: ${UNIT_SUBNET}.33 (IO-Link B) - ${HTR_B_DEVICE_ID}"
echo "MQTT Topics:"
echo "  - instrument/unit${UNIT_NUMBER}/htr_a/temperature"
echo "  - instrument/unit${UNIT_NUMBER}/htr_b/temperature"
echo "Backend Port: 38${UNIT_NUMBER_PADDED}"
echo "Frontend Port: 33${UNIT_NUMBER_PADDED}"

echo ""
print_status "Network Architecture:"
echo "=========================="
echo "Each unit operates on its own subnet:"
echo "  Unit 1: 20.x.x.x (HTR-A: 20.29, HTR-B: 20.33)"
echo "  Unit 2: 30.x.x.x (HTR-A: 30.29, HTR-B: 30.33)"
echo "  Unit 3: 40.x.x.x (HTR-A: 40.29, HTR-B: 40.33)"
echo "  Unit 4: 50.x.x.x (HTR-A: 50.29, HTR-B: 50.33)"
echo "  Unit 5: 60.x.x.x (HTR-A: 60.29, HTR-B: 60.33)"
echo "  Unit 6: 70.x.x.x (HTR-A: 70.29, HTR-B: 70.33)"
echo "  Unit 7: 80.x.x.x (HTR-A: 80.29, HTR-B: 80.33)"
echo "  Unit 8: 90.x.x.x (HTR-A: 90.29, HTR-B: 90.33)"

echo ""
print_warning "Remember to:"
echo "1. Update your DNS or /etc/hosts for domain access"
echo "2. Ensure both IO-Link masters are accessible:"
echo "   - HTR-A: ${UNIT_SUBNET}.29"
echo "   - HTR-B: ${UNIT_SUBNET}.33"
echo "3. Verify the device IDs are correct for your hardware"
echo "4. Test both MQTT connections and temperature readings"
echo "5. Configure network routing for subnet ${UNIT_SUBNET}.x.x.x" 