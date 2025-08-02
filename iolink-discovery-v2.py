#!/usr/bin/env python3
"""
IO-Link Discovery System v2.0
Enhanced discovery with MAC address extraction and validation
For IoT Control Server v1.02 Installation
"""

import asyncio
import aiohttp
import json
import ipaddress
import subprocess
import sys
import os
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass
from datetime import datetime
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('discovery.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

@dataclass
class IoLinkDevice:
    """IO-Link device information"""
    ip_address: str
    mac_address: str
    subnet: int
    device_type: str
    is_validated: bool = False
    unit_number: Optional[int] = None
    heater_type: Optional[str] = None
    device_name: Optional[str] = None

class IoLinkDiscovery:
    """Enhanced IO-Link discovery with MAC extraction and validation"""
    
    def __init__(self):
        self.discovered_devices: List[IoLinkDevice] = []
        self.validated_devices: List[IoLinkDevice] = []
        self.session: Optional[aiohttp.ClientSession] = None
        
    async def __aenter__(self):
        self.session = aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=5))
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    def get_local_subnets(self) -> List[int]:
        """Get local subnets from network interfaces"""
        subnets = []
        try:
            # Get network interfaces
            result = subprocess.run(['ip', 'route'], capture_output=True, text=True)
            if result.returncode == 0:
                for line in result.stdout.split('\n'):
                    if 'default via' in line:
                        # Extract subnet from default route
                        parts = line.split()
                        if len(parts) >= 3:
                            gateway = parts[2]
                            if gateway.count('.') == 3:
                                subnet = int(gateway.split('.')[2])
                                if subnet not in subnets:
                                    subnets.append(subnet)
                                    logger.info(f"Found subnet: 192.168.{subnet}.x")
        except Exception as e:
            logger.error(f"Error getting local subnets: {e}")
        
        # Add common subnets if none found
        if not subnets:
            subnets = [20, 21, 22, 25, 30]
            logger.info("Using default subnets: 192.168.20.x, 192.168.21.x, etc.")
        
        return subnets
    
    async def scan_subnet(self, subnet: int) -> List[IoLinkDevice]:
        """Scan subnet for IO-Link devices"""
        devices = []
        logger.info(f"Scanning subnet 192.168.{subnet}.x for IO-Link devices...")
        
        # Common IO-Link IPs to check
        common_ips = [29, 30, 31, 32, 33, 34, 35]
        
        tasks = []
        for host in common_ips:
            ip = f"192.168.{subnet}.{host}"
            tasks.append(self.check_iolink_device(ip, subnet))
        
        # Run all checks concurrently
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        for result in results:
            if isinstance(result, IoLinkDevice):
                devices.append(result)
                logger.info(f"Found IO-Link device: {result.ip_address} (MAC: {result.mac_address})")
        
        return devices
    
    async def check_iolink_device(self, ip: str, subnet: int) -> Optional[IoLinkDevice]:
        """Check if IP has an IO-Link device and extract MAC address"""
        try:
            # Try to get device info from IO-Link master
            url = f"http://{ip}/iolinkmaster/deviceinfo"
            
            async with self.session.get(url) as response:
                if response.status == 200:
                    data = await response.json()
                    
                    # Extract MAC address
                    mac_address = await self.extract_mac_address(ip)
                    
                    if mac_address:
                        device = IoLinkDevice(
                            ip_address=ip,
                            mac_address=mac_address,
                            subnet=subnet,
                            device_type="IO-Link Master"
                        )
                        return device
                        
        except Exception as e:
            # Device not found or not accessible
            pass
        
        return None
    
    async def extract_mac_address(self, ip: str) -> Optional[str]:
        """Extract MAC address from IO-Link device"""
        try:
            # Try multiple methods to get MAC address
            
            # Method 1: ARP table lookup
            mac = await self.get_mac_from_arp(ip)
            if mac:
                return mac
            
            # Method 2: IO-Link device info
            mac = await self.get_mac_from_iolink(ip)
            if mac:
                return mac
            
            # Method 3: Network scan
            mac = await self.get_mac_from_network(ip)
            if mac:
                return mac
                
        except Exception as e:
            logger.error(f"Error extracting MAC from {ip}: {e}")
        
        return None
    
    async def get_mac_from_arp(self, ip: str) -> Optional[str]:
        """Get MAC address from ARP table"""
        try:
            result = subprocess.run(['arp', '-n', ip], capture_output=True, text=True)
            if result.returncode == 0:
                lines = result.stdout.split('\n')
                for line in lines:
                    if ip in line and 'ether' in line:
                        parts = line.split()
                        for part in parts:
                            if ':' in part and len(part) == 17:
                                return part.upper()
        except Exception as e:
            logger.debug(f"ARP lookup failed for {ip}: {e}")
        return None
    
    async def get_mac_from_iolink(self, ip: str) -> Optional[str]:
        """Get MAC address from IO-Link device info"""
        try:
            url = f"http://{ip}/iolinkmaster/deviceinfo"
            async with self.session.get(url) as response:
                if response.status == 200:
                    data = await response.json()
                    # Look for MAC address in device info
                    if 'mac' in data:
                        return data['mac'].upper()
                    elif 'macAddress' in data:
                        return data['macAddress'].upper()
        except Exception as e:
            logger.debug(f"IO-Link device info failed for {ip}: {e}")
        return None
    
    async def get_mac_from_network(self, ip: str) -> Optional[str]:
        """Get MAC address from network scan"""
        try:
            # Use nmap or similar tool if available
            result = subprocess.run(['nmap', '-sn', ip], capture_output=True, text=True)
            if result.returncode == 0:
                # Parse nmap output for MAC address
                lines = result.stdout.split('\n')
                for line in lines:
                    if 'MAC Address:' in line:
                        mac = line.split('MAC Address:')[1].strip()
                        return mac.upper()
        except Exception as e:
            logger.debug(f"Network scan failed for {ip}: {e}")
        return None
    
    async def validate_device(self, device: IoLinkDevice) -> bool:
        """Show MAC to user for validation"""
        print(f"\n{'='*60}")
        print(f"🔍 DEVICE DISCOVERED")
        print(f"{'='*60}")
        print(f"IP Address: {device.ip_address}")
        print(f"MAC Address: {device.mac_address}")
        print(f"Subnet: 192.168.{device.subnet}.x")
        print(f"Device Type: {device.device_type}")
        print(f"{'='*60}")
        
        while True:
            response = input("\n❓ Does this MAC address match the device? (y/n/q to quit): ").lower().strip()
            
            if response in ['y', 'yes']:
                print("✅ Device validated!")
                device.is_validated = True
                return True
            elif response in ['n', 'no']:
                print("❌ Device rejected.")
                return False
            elif response in ['q', 'quit']:
                print("🛑 Discovery cancelled by user.")
                return False
            else:
                print("❓ Please enter 'y', 'n', or 'q'.")
    
    async def assign_to_unit(self, device: IoLinkDevice) -> bool:
        """Assign device to specific unit"""
        print(f"\n{'='*60}")
        print(f"🏭 UNIT ASSIGNMENT")
        print(f"{'='*60}")
        print(f"Device: {device.ip_address} ({device.mac_address})")
        print(f"{'='*60}")
        
        # Get unit number
        while True:
            try:
                unit_num = input("Enter unit number (1, 2, 3, etc.): ").strip()
                if unit_num.isdigit() and int(unit_num) > 0:
                    device.unit_number = int(unit_num)
                    break
                else:
                    print("❌ Please enter a valid unit number (1 or higher).")
            except ValueError:
                print("❌ Please enter a valid number.")
        
        # Get heater type
        print("\nHeater types:")
        print("A - Heater A (Primary)")
        print("B - Heater B (Secondary)")
        print("C - Heater C (Tertiary)")
        print("T - Temperature Sensor")
        print("O - Other")
        
        while True:
            heater_type = input("Enter heater type (A/B/C/T/O): ").strip().upper()
            if heater_type in ['A', 'B', 'C', 'T', 'O']:
                device.heater_type = heater_type
                break
            else:
                print("❌ Please enter a valid heater type.")
        
        # Get device name
        device_name = input("Enter device name (optional): ").strip()
        if device_name:
            device.device_name = device_name
        
        print(f"✅ Device assigned to Unit {device.unit_number}, Type {device.heater_type}")
        return True
    
    async def discover_all_devices(self) -> List[IoLinkDevice]:
        """Discover all IO-Link devices on all subnets"""
        logger.info("Starting comprehensive IO-Link discovery...")
        
        subnets = self.get_local_subnets()
        all_devices = []
        
        for subnet in subnets:
            devices = await self.scan_subnet(subnet)
            all_devices.extend(devices)
        
        logger.info(f"Discovery complete. Found {len(all_devices)} devices.")
        return all_devices
    
    async def interactive_discovery(self) -> List[IoLinkDevice]:
        """Interactive discovery with user validation"""
        print("🚀 IO-Link Discovery System v2.0")
        print("=" * 60)
        
        # Discover devices
        devices = await self.discover_all_devices()
        
        if not devices:
            print("❌ No IO-Link devices found on the network.")
            return []
        
        print(f"\n✅ Found {len(devices)} IO-Link devices.")
        
        validated_devices = []
        
        for device in devices:
            # Validate device
            if await self.validate_device(device):
                # Assign to unit
                if await self.assign_to_unit(device):
                    validated_devices.append(device)
                    self.validated_devices.append(device)
        
        print(f"\n🎉 Discovery complete! {len(validated_devices)} devices validated and configured.")
        return validated_devices
    
    def save_to_database(self, devices: List[IoLinkDevice], db_config: Dict) -> bool:
        """Save discovered devices to database"""
        try:
            # This would connect to PostgreSQL and save devices
            # For now, save to JSON file
            data = []
            for device in devices:
                data.append({
                    'ip_address': device.ip_address,
                    'mac_address': device.mac_address,
                    'subnet': device.subnet,
                    'unit_number': device.unit_number,
                    'heater_type': device.heater_type,
                    'device_name': device.device_name,
                    'is_validated': device.is_validated,
                    'discovered_at': datetime.now().isoformat()
                })
            
            with open('discovered_devices.json', 'w') as f:
                json.dump(data, f, indent=2)
            
            logger.info(f"Saved {len(devices)} devices to discovered_devices.json")
            return True
            
        except Exception as e:
            logger.error(f"Error saving to database: {e}")
            return False
    
    def print_summary(self, devices: List[IoLinkDevice]):
        """Print discovery summary"""
        print(f"\n{'='*60}")
        print(f"📊 DISCOVERY SUMMARY")
        print(f"{'='*60}")
        
        if not devices:
            print("No devices discovered.")
            return
        
        # Group by unit
        units = {}
        for device in devices:
            unit = device.unit_number or 'Unassigned'
            if unit not in units:
                units[unit] = []
            units[unit].append(device)
        
        for unit_num, unit_devices in units.items():
            print(f"\n🏭 Unit {unit_num}:")
            for device in unit_devices:
                print(f"  • {device.heater_type}: {device.ip_address} ({device.mac_address})")
                if device.device_name:
                    print(f"    Name: {device.device_name}")
        
        print(f"\nTotal devices: {len(devices)}")
        print(f"Validated devices: {len([d for d in devices if d.is_validated])}")

async def main():
    """Main discovery function"""
    print("🔍 IO-Link Discovery System v2.0")
    print("Enhanced discovery with MAC validation")
    print("=" * 60)
    
    async with IoLinkDiscovery() as discovery:
        # Run interactive discovery
        devices = await discovery.interactive_discovery()
        
        if devices:
            # Save to database/file
            discovery.save_to_database(devices, {})
            
            # Print summary
            discovery.print_summary(devices)
            
            print(f"\n✅ Discovery completed successfully!")
            print(f"📁 Results saved to: discovered_devices.json")
        else:
            print("\n❌ No devices were validated. Discovery failed.")

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n🛑 Discovery cancelled by user.")
    except Exception as e:
        logger.error(f"Discovery failed: {e}")
        print(f"\n❌ Discovery failed: {e}") 