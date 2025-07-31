#!/usr/bin/env python3
"""
IO-Link Device Discovery Tool
Attempts to discover device IDs from IO-Link masters automatically
"""

import requests
import socket
import time
import json
import sys
from urllib.parse import urljoin
import xml.etree.ElementTree as ET

class IOLinkDiscovery:
    def __init__(self, ip_address, timeout=5):
        self.ip_address = ip_address
        self.timeout = timeout
        self.session = requests.Session()
        self.session.timeout = timeout
        
    def test_connectivity(self):
        """Test basic network connectivity"""
        try:
            # Try to ping the device
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(self.timeout)
            result = sock.connect_ex((self.ip_address, 80))
            sock.close()
            return result == 0
        except Exception as e:
            print(f"Connectivity test failed: {e}")
            return False
    
    def discover_device_id(self):
        """Attempt to discover device ID from IO-Link master"""
        print(f"🔍 Attempting to discover device ID from {self.ip_address}...")
        
        # List of common IO-Link master web interfaces and their device info endpoints
        discovery_methods = [
            self._try_ifm_web_interface,
            self._try_siemens_web_interface,
            self._try_phoenix_web_interface,
            self._try_beckhoff_web_interface,
            self._try_generic_web_interface,
        ]
        
        for method in discovery_methods:
            try:
                device_id = method()
                if device_id:
                    return device_id
            except Exception as e:
                print(f"Method {method.__name__} failed: {e}")
                continue
        
        return None
    
    def _try_ifm_web_interface(self):
        """Try IFM IO-Link master web interface"""
        try:
            # IFM typically uses /iolink/deviceinfo or similar
            urls = [
                f"http://{self.ip_address}/iolink/deviceinfo",
                f"http://{self.ip_address}/api/iolink/deviceinfo",
                f"http://{self.ip_address}/deviceinfo",
                f"http://{self.ip_address}/api/deviceinfo"
            ]
            
            for url in urls:
                try:
                    response = self.session.get(url)
                    if response.status_code == 200:
                        # Try to parse JSON response
                        try:
                            data = response.json()
                            if 'device_id' in data:
                                return data['device_id']
                            elif 'deviceId' in data:
                                return data['deviceId']
                        except:
                            pass
                        
                        # Try to parse XML response
                        try:
                            root = ET.fromstring(response.text)
                            device_id = root.find('.//device_id')
                            if device_id is not None:
                                return device_id.text
                        except:
                            pass
                except:
                    continue
        except Exception as e:
            print(f"IFM interface failed: {e}")
        
        return None
    
    def _try_siemens_web_interface(self):
        """Try Siemens IO-Link master web interface"""
        try:
            # Siemens typically uses /api/iolink or similar
            urls = [
                f"http://{self.ip_address}/api/iolink",
                f"http://{self.ip_address}/iolink/api",
                f"http://{self.ip_address}/api/deviceinfo"
            ]
            
            for url in urls:
                try:
                    response = self.session.get(url)
                    if response.status_code == 200:
                        # Try to parse JSON response
                        try:
                            data = response.json()
                            if 'device_id' in data:
                                return data['device_id']
                            elif 'deviceId' in data:
                                return data['deviceId']
                        except:
                            pass
                except:
                    continue
        except Exception as e:
            print(f"Siemens interface failed: {e}")
        
        return None
    
    def _try_phoenix_web_interface(self):
        """Try Phoenix Contact IO-Link master web interface"""
        try:
            # Phoenix Contact typically uses /api/iolink or similar
            urls = [
                f"http://{self.ip_address}/api/iolink",
                f"http://{self.ip_address}/iolink/api",
                f"http://{self.ip_address}/api/deviceinfo"
            ]
            
            for url in urls:
                try:
                    response = self.session.get(url)
                    if response.status_code == 200:
                        # Try to parse JSON response
                        try:
                            data = response.json()
                            if 'device_id' in data:
                                return data['device_id']
                            elif 'deviceId' in data:
                                return data['deviceId']
                        except:
                            pass
                except:
                    continue
        except Exception as e:
            print(f"Phoenix Contact interface failed: {e}")
        
        return None
    
    def _try_beckhoff_web_interface(self):
        """Try Beckhoff IO-Link master web interface"""
        try:
            # Beckhoff typically uses /api/iolink or similar
            urls = [
                f"http://{self.ip_address}/api/iolink",
                f"http://{self.ip_address}/iolink/api",
                f"http://{self.ip_address}/api/deviceinfo"
            ]
            
            for url in urls:
                try:
                    response = self.session.get(url)
                    if response.status_code == 200:
                        # Try to parse JSON response
                        try:
                            data = response.json()
                            if 'device_id' in data:
                                return data['device_id']
                            elif 'deviceId' in data:
                                return data['deviceId']
                        except:
                            pass
                except:
                    continue
        except Exception as e:
            print(f"Beckhoff interface failed: {e}")
        
        return None
    
    def _try_generic_web_interface(self):
        """Try generic web interface patterns"""
        try:
            # Try common web interface paths
            urls = [
                f"http://{self.ip_address}/",
                f"http://{self.ip_address}/index.html",
                f"http://{self.ip_address}/status",
                f"http://{self.ip_address}/info"
            ]
            
            for url in urls:
                try:
                    response = self.session.get(url)
                    if response.status_code == 200:
                        content = response.text.lower()
                        
                        # Look for device ID patterns in HTML content
                        import re
                        patterns = [
                            r'device[_-]?id[:\s]*([0-9a-f]{2}-[0-9a-f]{2}-[0-9a-f]{2}-[0-9a-f]{2}-[0-9a-f]{2}-[0-9a-f]{2})',
                            r'iolink[:\s]*([0-9a-f]{2}-[0-9a-f]{2}-[0-9a-f]{2}-[0-9a-f]{2}-[0-9a-f]{2}-[0-9a-f]{2})',
                            r'([0-9a-f]{2}-[0-9a-f]{2}-[0-9a-f]{2}-[0-9a-f]{2}-[0-9a-f]{2}-[0-9a-f]{2})'
                        ]
                        
                        for pattern in patterns:
                            match = re.search(pattern, content)
                            if match:
                                return match.group(1)
                except:
                    continue
        except Exception as e:
            print(f"Generic interface failed: {e}")
        
        return None

def main():
    if len(sys.argv) != 2:
        print("Usage: python3 iolink-discovery.py <ip_address>")
        sys.exit(1)
    
    ip_address = sys.argv[1]
    
    # Validate IP address format
    import re
    if not re.match(r'^(\d{1,3}\.){3}\d{1,3}$', ip_address):
        print("Invalid IP address format")
        sys.exit(1)
    
    discovery = IOLinkDiscovery(ip_address)
    
    print(f"🔍 IO-Link Device Discovery for {ip_address}")
    print("=" * 50)
    
    # Test connectivity
    if not discovery.test_connectivity():
        print("❌ Cannot reach the device. Please check:")
        print("  1. Device is powered on")
        print("  2. Network cable is connected")
        print("  3. IP address is correct")
        print("  4. Device is on the same network")
        sys.exit(1)
    
    print("✅ Network connectivity OK")
    
    # Attempt discovery
    device_id = discovery.discover_device_id()
    
    if device_id:
        print(f"✅ Device ID discovered: {device_id}")
        print(f"📋 Copy this device ID: {device_id}")
        return device_id
    else:
        print("❌ Could not automatically discover device ID")
        print("📋 Please manually enter the device ID from the IO-Link master's web interface")
        return None

if __name__ == "__main__":
    main() 