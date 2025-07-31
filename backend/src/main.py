from fastapi import FastAPI, WebSocket, Request
from fastapi.middleware.cors import CORSMiddleware
import paho.mqtt.client as mqtt
from pycomm3 import LogixDriver
import json
import os
import asyncio
from datetime import datetime
import logging
import yaml
import aiohttp

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="IoT Control Server")

# Load IO-Link configuration
try:
    with open('config/iolink_config.yml', 'r') as f:
        iolink_config = yaml.safe_load(f)
    logger.info("Loaded IO-Link configuration")
except Exception as e:
    logger.error(f"Error loading IO-Link configuration: {e}")
    iolink_config = {"devices": {}}

# Store latest temperature readings
latest_readings = {}

# Add temporary logging helper
def log_important(message: str):
    """Log important events with timestamp"""
    timestamp = datetime.now().strftime("%H:%M:%S")
    logger.info(f"[{timestamp}] {message}")
    print(f"[{timestamp}] BACKEND: {message}")  # Also print to console for easy viewing

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MQTT client setup and callbacks
def on_mqtt_connect(client, userdata, flags, rc):
    if rc == 0:
        logger.info("Connected to MQTT broker successfully")
    else:
        logger.error(f"Failed to connect to MQTT broker with code: {rc}")

def on_mqtt_disconnect(client, userdata, rc):
    if rc != 0:
        logger.error(f"Unexpected MQTT disconnection. Reconnecting...")
        try:
            mqtt_client.reconnect()
        except Exception as e:
            logger.error(f"MQTT reconnection failed: {e}")

# MQTT client setup
mqtt_client = mqtt.Client()
mqtt_client.on_connect = on_mqtt_connect
mqtt_client.on_disconnect = on_mqtt_disconnect
mqtt_client.reconnect_delay_set(min_delay=1, max_delay=30)

# Connect to MQTT broker
try:
    mqtt_client.connect(
        os.getenv("MQTT_BROKER_HOST", "mqtt-broker"),
        int(os.getenv("MQTT_BROKER_PORT", 1883))
    )
    mqtt_client.loop_start()
    logger.info("Started MQTT client loop")
except Exception as e:
    logger.error(f"Failed to connect to MQTT broker: {e}")

# Store PLC connections
plc_connections = {}

# Temperature polling task
async def poll_temperature():
    """Poll temperature data from IO-Link master and publish to MQTT"""
    logger.info("Starting temperature polling task")
    
    # Get unit-specific configuration from environment variables
    unit_name = os.getenv("UNIT_NAME", "unit1")
    unit_subnet = os.getenv("UNIT_SUBNET", "20")
    
    # HTR-A configuration
    htr_a_ip_full = os.getenv("HTR_A_IP", "20.29")
    # Handle case where IP already includes subnet (e.g., "30.29") or just host part (e.g., "29")
    if '.' in htr_a_ip_full:
        # IP already includes subnet, extract just the host part
        htr_a_ip = htr_a_ip_full.split('.')[-1]
    else:
        # IP is just host part, use as is
        htr_a_ip = htr_a_ip_full
    htr_a_device_id = os.getenv("HTR_A_DEVICE_ID", "00-02-01-6D-55-8A")
    htr_a_port = os.getenv("HTR_A_TEMP_PORT", "6")
    htr_a_topic = os.getenv("HTR_A_TEMP_TOPIC", f"instrument/{unit_name}/htr_a/temperature")
    
    # HTR-B configuration
    htr_b_ip_full = os.getenv("HTR_B_IP", "20.33")
    # Handle case where IP already includes subnet (e.g., "30.33") or just host part (e.g., "33")
    if '.' in htr_b_ip_full:
        # IP already includes subnet, extract just the host part
        htr_b_ip = htr_b_ip_full.split('.')[-1]
    else:
        # IP is just host part, use as is
        htr_b_ip = htr_b_ip_full
    htr_b_device_id = os.getenv("HTR_B_DEVICE_ID", "00-02-01-6D-55-86")
    htr_b_port = os.getenv("HTR_B_TEMP_PORT", "6")
    htr_b_topic = os.getenv("HTR_B_TEMP_TOPIC", f"instrument/{unit_name}/htr_b/temperature")
    
    # Construct full IP addresses
    htr_a_full_ip = f"192.168.{unit_subnet}.{htr_a_ip}"
    htr_b_full_ip = f"192.168.{unit_subnet}.{htr_b_ip}"
    
    logger.info(f"Unit {unit_name}: Polling HTR-A from {htr_a_full_ip}:{htr_a_port} and HTR-B from {htr_b_full_ip}:{htr_b_port}")
    
    # Error tracking for exponential backoff
    consecutive_errors = 0
    max_consecutive_errors = 10
    
    async with aiohttp.ClientSession() as session:
        while True:
            try:
                # Poll HTR-A temperature
                try:
                    url_a = f"http://{htr_a_full_ip}/iolinkmaster/port%5B{htr_a_port}%5D/iolinkdevice/pdin/getdata"
                    async with session.get(url_a, timeout=aiohttp.ClientTimeout(total=5)) as response:
                        if response.status == 200:
                            data = await response.json()
                            if 'data' in data and 'value' in data['data']:
                                hex_value = data['data']['value'].replace('0x', '').zfill(4).upper()
                                logger.info(f"HTR-A received hex value: {hex_value}")
                                
                                try:
                                    decimal_value = int(hex_value, 16)
                                    temp_f = decimal_value / 10.0
                                    logger.info(f"HTR-A temperature conversion: hex {hex_value} -> decimal {decimal_value} -> {temp_f}°F")
                                    
                                    timestamp = datetime.now().isoformat()
                                    counter = int(datetime.now().timestamp())
                                    
                                    # Publish HTR-A temperature
                                    temp_reading = {
                                        'code': 'event',
                                        'cid': 123,
                                        'adr': '/instruments_ti',
                                        'data': {
                                            'eventno': str(counter),
                                            'srcurl': f'{htr_a_device_id}/timer[1]/counter/datachanged',
                                            'payload': {
                                                '/timer[1]/counter': {'code': 200, 'data': counter},
                                                '/processdatamaster/temperature': {'code': 200, 'data': temp_f}
                                            }
                                        }
                                    }
                                    
                                    hex_reading = {
                                        'code': 'event',
                                        'cid': 123,
                                        'adr': '/instrument/htr_a',
                                        'data': {
                                            'eventno': str(counter),
                                            'srcurl': f'{htr_a_device_id}/timer[1]/counter/datachanged',
                                            'payload': {
                                                '/timer[1]/counter': {'code': 200, 'data': counter},
                                                '/iolinkmaster/port[6]/iolinkdevice/pdin': {'code': 200, 'data': hex_value}
                                            }
                                        }
                                    }
                                    
                                    # Publish HTR-A temperature to device-specific topic
                                    mqtt_client.publish('instruments_ti', json.dumps(temp_reading), qos=1)
                                    mqtt_client.publish('instrument/htr_a', json.dumps(hex_reading), qos=1)
                                    # Also publish to device-specific topic
                                    mqtt_client.publish(f'instrument/{unit_name}/htr_a/temperature', json.dumps(temp_reading), qos=1)
                                    logger.info(f"Published HTR-A temperature: {temp_f:.1f}°F (raw hex: {hex_value})")
                                    
                                    # Keep latest reading in memory for HTTP API compatibility
                                    latest_readings['temperature'] = {
                                        'value': temp_f,
                                        'unit': 'fahrenheit',
                                        'timestamp': timestamp,
                                        'raw_value': hex_value,
                                        'device': 'htr_a',
                                        'ip': htr_a_full_ip
                                    }
                                    
                                    # Reset error counter on successful read
                                    consecutive_errors = 0
                                except ValueError as e:
                                    logger.error(f"Error converting HTR-A hex value {hex_value}: {e}")
                        else:
                            logger.error(f"Error reading HTR-A temperature: HTTP {response.status}")
                except Exception as e:
                    logger.error(f"Error polling HTR-A temperature: {e}")
                    consecutive_errors += 1
                
                # Poll HTR-B temperature
                try:
                    url_b = f"http://{htr_b_full_ip}/iolinkmaster/port%5B{htr_b_port}%5D/iolinkdevice/pdin/getdata"
                    async with session.get(url_b, timeout=aiohttp.ClientTimeout(total=5)) as response:
                        if response.status == 200:
                            data = await response.json()
                            if 'data' in data and 'value' in data['data']:
                                hex_value = data['data']['value'].replace('0x', '').zfill(4).upper()
                                logger.info(f"HTR-B received hex value: {hex_value}")
                                
                                try:
                                    decimal_value = int(hex_value, 16)
                                    temp_f = decimal_value / 10.0
                                    logger.info(f"HTR-B temperature conversion: hex {hex_value} -> decimal {decimal_value} -> {temp_f}°F")
                                    
                                    timestamp = datetime.now().isoformat()
                                    counter = int(datetime.now().timestamp())
                                    
                                    # Publish HTR-B temperature
                                    temp_reading = {
                                        'code': 'event',
                                        'cid': 123,
                                        'adr': '/instruments_ti',
                                        'data': {
                                            'eventno': str(counter),
                                            'srcurl': f'{htr_b_device_id}/timer[1]/counter/datachanged',
                                            'payload': {
                                                '/timer[1]/counter': {'code': 200, 'data': counter},
                                                '/processdatamaster/temperature': {'code': 200, 'data': temp_f}
                                            }
                                        }
                                    }
                                    
                                    hex_reading = {
                                        'code': 'event',
                                        'cid': 123,
                                        'adr': '/instrument/htr_b',
                                        'data': {
                                            'eventno': str(counter),
                                            'srcurl': f'{htr_b_device_id}/timer[1]/counter/datachanged',
                                            'payload': {
                                                '/timer[1]/counter': {'code': 200, 'data': counter},
                                                '/iolinkmaster/port[6]/iolinkdevice/pdin': {'code': 200, 'data': hex_value}
                                            }
                                        }
                                    }
                                    
                                    # Publish HTR-B temperature to device-specific topic
                                    mqtt_client.publish('instruments_ti', json.dumps(temp_reading), qos=1)
                                    mqtt_client.publish('instrument/htr_b', json.dumps(hex_reading), qos=1)
                                    # Also publish to device-specific topic
                                    mqtt_client.publish(f'instrument/{unit_name}/htr_b/temperature', json.dumps(temp_reading), qos=1)
                                    logger.info(f"Published HTR-B temperature: {temp_f:.1f}°F (raw hex: {hex_value})")
                                    
                                    # Keep latest HTR-B reading in memory
                                    latest_readings['temperature_htr_b'] = {
                                        'value': temp_f,
                                        'unit': 'fahrenheit',
                                        'timestamp': timestamp,
                                        'raw_value': hex_value,
                                        'device': 'htr_b',
                                        'ip': htr_b_full_ip
                                    }
                                    
                                    # Reset error counter on successful read
                                    consecutive_errors = 0
                                except ValueError as e:
                                    logger.error(f"Error converting HTR-B hex value {hex_value}: {e}")
                        else:
                            logger.error(f"Error reading HTR-B temperature: HTTP {response.status}")
                except Exception as e:
                    logger.error(f"Error polling HTR-B temperature: {e}")
                    consecutive_errors += 1
                
                # Calculate sleep time based on error count (exponential backoff)
                if consecutive_errors > max_consecutive_errors:
                    sleep_time = min(30, 2 ** (consecutive_errors - max_consecutive_errors))  # Max 30 seconds
                    logger.warning(f"Too many consecutive errors ({consecutive_errors}), sleeping for {sleep_time}s")
                else:
                    sleep_time = 1  # Normal 1-second polling
                
                await asyncio.sleep(sleep_time)
                
            except Exception as e:
                logger.error(f"Critical error in temperature polling loop: {e}")
                consecutive_errors += 1
                await asyncio.sleep(5)  # Wait 5 seconds before retrying

# Startup event
@app.on_event("startup")
async def startup_event():
    """Start background tasks on application startup"""
    logger.info("Starting IoT Control Server")
    try:
        # Start temperature polling in the background
        asyncio.create_task(poll_temperature())
        logger.info("Temperature polling task started")
    except Exception as e:
        logger.error(f"Error starting temperature polling: {e}")

# MQTT message handler
def on_mqtt_message(client, userdata, message):
    try:
        topic = message.topic
        payload = json.loads(message.payload.decode())
        logger.info(f"Received MQTT message on topic {topic}: {payload}")
        
        # Check if this is temperature sensor data from port 6
        if topic == "iolink/master1/port6":
            try:
                # Extract temperature value (adjust based on your sensor's data format)
                temp_value = float(payload.get('value', 0)) * iolink_config['devices']['temperature_sensor']['scaling_factor']
                timestamp = datetime.now().isoformat()
                
                latest_readings['temperature'] = {
                    'value': temp_value,
                    'unit': iolink_config['devices']['temperature_sensor']['unit'],
                    'timestamp': timestamp
                }
                
                logger.info(f"Updated temperature reading: {temp_value}°C")
            except Exception as e:
                logger.error(f"Error processing temperature data: {e}")
                
    except Exception as e:
        logger.error(f"Error processing MQTT message: {e}")

mqtt_client.on_message = on_mqtt_message

# API Endpoints
@app.get("/api/status")
async def get_status():
    return {"status": "running", "timestamp": datetime.now().isoformat()}

@app.post("/api/plc/connect")
async def connect_plc(ip_address: str, slot: int = 0):
    try:
        plc = LogixDriver(ip_address, slot=slot)
        plc.open()
        plc_connections[ip_address] = plc
        return {"status": "connected", "ip_address": ip_address}
    except Exception as e:
        logger.error(f"Error connecting to PLC: {e}")
        return {"status": "error", "message": str(e)}

@app.get("/api/plc/{ip_address}/tags")
async def read_plc_tags(ip_address: str, tags: str):
    try:
        plc = plc_connections.get(ip_address)
        if not plc:
            return {"error": "PLC not connected"}
        
        tag_list = tags.split(',')
        results = {}
        for tag in tag_list:
            value = plc.read(tag)
            results[tag] = value.value if value else None
        
        return results
    except Exception as e:
        logger.error(f"Error reading PLC tags: {e}")
        return {"error": str(e)}

@app.post("/api/plc/{ip_address}/write")
async def write_plc_tag(ip_address: str, tag: str, value: str):
    try:
        plc = plc_connections.get(ip_address)
        if not plc:
            return {"error": "PLC not connected"}
        
        result = plc.write(tag, value)
        return {"status": "success", "result": result}
    except Exception as e:
        logger.error(f"Error writing to PLC: {e}")
        return {"error": str(e)}

@app.get("/api/temperature")
async def get_temperature():
    """Get the latest temperature reading (HTR-A)"""
    if 'temperature' in latest_readings:
        return latest_readings['temperature']
    return {"error": "No temperature readings available"}

@app.get("/api/temperature/htr-a")
async def get_temperature_htr_a():
    """Get the latest HTR-A temperature reading"""
    if 'temperature' in latest_readings:
        return latest_readings['temperature']
    return {"error": "No HTR-A temperature readings available"}

@app.get("/api/temperature/htr-b")
async def get_temperature_htr_b():
    """Get the latest HTR-B temperature reading"""
    if 'temperature_htr_b' in latest_readings:
        return latest_readings['temperature_htr_b']
    return {"error": "No HTR-B temperature readings available"}

@app.get("/api/temperature/all")
async def get_all_temperatures():
    """Get temperature readings from all devices"""
    result = {}
    if 'temperature' in latest_readings:
        result['htr_a'] = latest_readings['temperature']
    if 'temperature_htr_b' in latest_readings:
        result['htr_b'] = latest_readings['temperature_htr_b']
    
    if result:
        return result
    return {"error": "No temperature readings available"}

@app.post("/api/iolink/port/{port_num}/setdata")
async def set_iolink_port_output(port_num: int, request: Request):
    """Relay IO-Link output command to the IO-Link master for the given port."""
    try:
        body = await request.json()
        state = body.get('state')
        
        # Get the IO-Link IP from the request body
        io_link_ip = body.get('ioLinkIp')
        
        # If no IP provided, construct default based on unit configuration
        if not io_link_ip:
            unit_subnet = os.getenv("UNIT_SUBNET", "20")
            htr_a_ip_full = os.getenv("HTR_A_IP", "20.29")
            htr_a_ip = htr_a_ip_full.split('.')[-1] if '.' in htr_a_ip_full else htr_a_ip_full
            io_link_ip = f"192.168.{unit_subnet}.{htr_a_ip}"
        
        # Ensure the IP is properly formatted (handle cases where it might be just the last octet)
        if '.' not in io_link_ip or io_link_ip.count('.') < 3:
            # If it's just the last octet (e.g., "30.29"), construct full IP
            unit_subnet = os.getenv("UNIT_SUBNET", "20")
            if '.' in io_link_ip:
                # Extract just the last octet
                last_octet = io_link_ip.split('.')[-1]
                io_link_ip = f"192.168.{unit_subnet}.{last_octet}"
            else:
                # Assume it's just the last octet
                io_link_ip = f"192.168.{unit_subnet}.{io_link_ip}"
        
        adr = f"iolinkmaster/port[{port_num}]/iolinkdevice/pdout/setdata"
        url = f"http://{io_link_ip}/iolinkmaster/port%5B{port_num}%5D/iolinkdevice/pdout/setdata"
        
        logger.info(f"Sending IO-Link command to {io_link_ip}:{port_num} - State: {state}")
        log_important(f"Section {port_num} → {'ON' if state else 'OFF'} (IP: {io_link_ip})")
        
        payload = {
            "code": "request",
            "cid": 4711,
            "adr": adr,
            "data": {"newvalue": "01" if state else "00"}
        }
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=payload) as resp:
                data = await resp.json()
                logger.info(f"IO-Link command response: {data}")
                return {"status": "ok", "response": data}
    except Exception as e:
        logger.error(f"Error relaying IO-Link output command: {e}")
        return {"status": "error", "message": str(e)}

@app.post("/api/iolink/port/{port_num}/getdata")
async def get_iolink_port_output(port_num: int, request: Request):
    """Read IO-Link output state from the IO-Link master for the given port."""
    try:
        body = await request.json()
        
        # Get the IO-Link IP from the request body
        io_link_ip = body.get('ioLinkIp')
        
        # If no IP provided, construct default based on unit configuration
        if not io_link_ip:
            unit_subnet = os.getenv("UNIT_SUBNET", "20")
            htr_a_ip_full = os.getenv("HTR_A_IP", "20.29")
            htr_a_ip = htr_a_ip_full.split('.')[-1] if '.' in htr_a_ip_full else htr_a_ip_full
            io_link_ip = f"192.168.{unit_subnet}.{htr_a_ip}"
        
        # Ensure the IP is properly formatted (handle cases where it might be just the last octet)
        if '.' not in io_link_ip or io_link_ip.count('.') < 3:
            # If it's just the last octet (e.g., "30.29"), construct full IP
            unit_subnet = os.getenv("UNIT_SUBNET", "20")
            if '.' in io_link_ip:
                # Extract just the last octet
                last_octet = io_link_ip.split('.')[-1]
                io_link_ip = f"192.168.{unit_subnet}.{last_octet}"
            else:
                # Assume it's just the last octet
                io_link_ip = f"192.168.{unit_subnet}.{io_link_ip}"
        
        adr = f"iolinkmaster/port[{port_num}]/iolinkdevice/pdout/getdata"
        url = f"http://{io_link_ip}/iolinkmaster/port%5B{port_num}%5D/iolinkdevice/pdout/getdata"
        
        logger.info(f"Reading IO-Link output from {io_link_ip}:{port_num}")
        
        payload = {
            "code": "request",
            "cid": 4711,
            "adr": adr
        }
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=payload) as resp:
                data = await resp.json()
                logger.info(f"IO-Link read response: {data}")
                return {"status": "ok", "response": data}
    except Exception as e:
        logger.error(f"Error reading IO-Link output: {e}")
        return {"status": "error", "message": str(e)}

# WebSocket for real-time updates
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            # Send real-time updates to connected clients
            await asyncio.sleep(1)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        await websocket.close() 