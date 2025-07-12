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

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],  # Allow both default Vite and configured port
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
    async with aiohttp.ClientSession() as session:
        while True:
            try:
                url = "http://192.168.30.29/iolinkmaster/port%5B6%5D/iolinkdevice/pdin/getdata"
                async with session.get(url) as response:
                    if response.status == 200:
                        data = await response.json()
                        if 'data' in data and 'value' in data['data']:
                            # Get hex value and ensure it's properly formatted
                            hex_value = data['data']['value'].replace('0x', '').zfill(4).upper()
                            logger.info(f"Received hex value: {hex_value}")
                            
                            try:
                                # Convert hex to decimal and divide by 10 for temperature
                                decimal_value = int(hex_value, 16)
                                temp_f = decimal_value / 10.0
                                logger.info(f"Temperature conversion: hex {hex_value} -> decimal {decimal_value} -> {temp_f}°F")
                                
                                timestamp = datetime.now().isoformat()
                                counter = int(datetime.now().timestamp())
                                
                                # Publish converted temperature
                                temp_reading = {
                                    'code': 'event',
                                    'cid': 123,
                                    'adr': '/instruments_ti',
                                    'data': {
                                        'eventno': str(counter),
                                        'srcurl': '00-02-01-6D-55-8A/timer[1]/counter/datachanged',
                                        'payload': {
                                            '/timer[1]/counter': {'code': 200, 'data': counter},
                                            '/processdatamaster/temperature': {'code': 200, 'data': temp_f}
                                        }
                                    }
                                }
                                
                                # Publish raw hex value
                                hex_reading = {
                                    'code': 'event',
                                    'cid': 123,
                                    'adr': '/instrument/htr_a',
                                    'data': {
                                        'eventno': str(counter),
                                        'srcurl': '00-02-01-6D-55-8A/timer[1]/counter/datachanged',
                                        'payload': {
                                            '/timer[1]/counter': {'code': 200, 'data': counter},
                                            '/iolinkmaster/port[6]/iolinkdevice/pdin': {'code': 200, 'data': hex_value}
                                        }
                                    }
                                }
                                
                                # Publish both messages
                                mqtt_client.publish('instruments_ti', json.dumps(temp_reading), qos=1)
                                mqtt_client.publish('instrument/htr_a', json.dumps(hex_reading), qos=1)
                                logger.info(f"Published temperature reading: {temp_f:.1f}°F (raw hex: {hex_value})")
                                
                                # Keep latest reading in memory for HTTP API compatibility
                                latest_readings['temperature'] = {
                                    'value': temp_f,
                                    'unit': 'fahrenheit',
                                    'timestamp': timestamp,
                                    'raw_value': hex_value
                                }
                            except ValueError as e:
                                logger.error(f"Error converting hex value {hex_value}: {e}")
                    else:
                        logger.error(f"Error reading temperature: HTTP {response.status}")
            except Exception as e:
                logger.error(f"Error polling temperature: {e}")
            
            await asyncio.sleep(1)  # Poll every second

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
    """Get the latest temperature reading"""
    if 'temperature' in latest_readings:
        return latest_readings['temperature']
    return {"error": "No temperature readings available"}

@app.post("/api/iolink/port/{port_num}/setdata")
async def set_iolink_port_output(port_num: int, request: Request):
    """Relay IO-Link output command to the IO-Link master for the given port."""
    try:
        body = await request.json()
        state = body.get('state')
        io_link_ip = body.get('ioLinkIp', '192.168.30.29')  # Default to main device, allow override
        adr = f"iolinkmaster/port[{port_num}]/iolinkdevice/pdout/setdata"
        url = f"http://{io_link_ip}/iolinkmaster/port%5B{port_num}%5D/iolinkdevice/pdout/setdata"
        payload = {
            "code": "request",
            "cid": 4711,
            "adr": adr,
            "data": {"newvalue": "01" if state else "00"}
        }
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=payload) as resp:
                data = await resp.json()
                return {"status": "ok", "response": data}
    except Exception as e:
        logger.error(f"Error relaying IO-Link output command: {e}")
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