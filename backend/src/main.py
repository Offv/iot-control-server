from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
import paho.mqtt.client as mqtt
from pycomm3 import LogixDriver
import json
import os
import asyncio
from datetime import datetime
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="IoT Control Server")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MQTT client setup
mqtt_client = mqtt.Client()
mqtt_client.connect(
    os.getenv("MQTT_BROKER_HOST", "mqtt-broker"),
    int(os.getenv("MQTT_BROKER_PORT", 1883))
)
mqtt_client.loop_start()

# Store PLC connections
plc_connections = {}

@app.on_event("startup")
async def startup_event():
    logger.info("Starting IoT Control Server")
    # Subscribe to IO-Link master topics
    mqtt_client.subscribe("iolink/#")

@app.on_event("shutdown")
async def shutdown_event():
    logger.info("Shutting down IoT Control Server")
    mqtt_client.loop_stop()
    for plc in plc_connections.values():
        plc.close()

# MQTT message handler
def on_mqtt_message(client, userdata, message):
    try:
        payload = json.loads(message.payload.decode())
        logger.info(f"Received MQTT message on topic {message.topic}: {payload}")
        # Handle IO-Link data processing here
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