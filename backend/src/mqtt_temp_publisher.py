import paho.mqtt.client as mqtt
import json
import time
from datetime import datetime
import random
import os
import logging

# Set up logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        logger.info("Connected to MQTT broker successfully")
    else:
        logger.error(f"Failed to connect to MQTT broker with code: {rc}")

def on_disconnect(client, userdata, rc):
    if rc != 0:
        logger.warning(f"Unexpected disconnection. Reconnecting...")
        time.sleep(2)
        try:
            client.reconnect()
        except Exception as e:
            logger.error(f"Reconnection failed: {e}")

def main():
    logger.info("Test publisher disabled to avoid conflicting with real sensor data")
    while True:
        time.sleep(60)  # Keep container alive but don't publish

if __name__ == "__main__":
    while True:
        try:
            logger.info("Starting MQTT test publisher (disabled)...")
            main()
        except Exception as e:
            logger.exception(f"Main loop error: {e}")
            time.sleep(5)  # Wait before restarting 