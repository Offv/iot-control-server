import mqtt, { MqttClient } from 'mqtt';
import type { IClientOptions } from 'mqtt';

interface TemperatureData {
  device_id: string;
  device_type: string;
  unit_name: string;
  temperature: number;
  timestamp: string;
  data: {
    payload: {
      [key: string]: {
        data: string;
      };
    };
  };
}

interface HeaterData {
  temperature: number;
  timestamp: string;
  lastUpdate: Date;
}

interface MqttServiceCallbacks {
  onTemperatureUpdate?: (deviceType: string, data: HeaterData) => void;
  onConnectionChange?: (connected: boolean, status: string) => void;
  onError?: (error: string) => void;
}

class MqttService {
  private static instance: MqttService;
  private client: MqttClient | null = null;
  private callbacks: Map<string, MqttServiceCallbacks> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectInterval: NodeJS.Timeout | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private lastMessageTime = 0;
  private isConnecting = false;

  // Store latest data for each heater
  private heaterData: Map<string, HeaterData> = new Map();

  // MQTT Configuration
  private readonly config = {
    host: window.location.hostname || 'localhost',
    port: 39001, // WebSocket port
    clientId: `htr_control_global_${Math.random().toString(16).substring(2, 8)}`,
    keepalive: 60,
    reconnectPeriod: 5000,
    connectTimeout: 10000,
    clean: true
  };

  private constructor() {
    this.setupHealthCheck();
    this.connect();
  }

  public static getInstance(): MqttService {
    if (!MqttService.instance) {
      MqttService.instance = new MqttService();
    }
    return MqttService.instance;
  }

  public registerCallbacks(componentId: string, callbacks: MqttServiceCallbacks): void {
    this.callbacks.set(componentId, callbacks);
    
    // Send current data to new subscriber
    this.heaterData.forEach((data, deviceType) => {
      callbacks.onTemperatureUpdate?.(deviceType, data);
    });
    
    // Send current connection status
    callbacks.onConnectionChange?.(this.isConnected(), this.getConnectionStatus());
  }

  public unregisterCallbacks(componentId: string): void {
    this.callbacks.delete(componentId);
  }

  public getHeaterData(deviceType: string): HeaterData | null {
    return this.heaterData.get(deviceType) || null;
  }

  private connect(): void {
    if (this.client && this.client.connected) {
      console.log('MQTT Service: Already connected');
      this.notifyConnectionChange(true, 'Connected');
      return;
    }

    if (this.isConnecting) {
      console.log('MQTT Service: Connection already in progress');
      return;
    }

    this.isConnecting = true;
    console.log('MQTT Service: Connecting to broker...');

    const wsUrl = `ws://${this.config.host}:${this.config.port}`;
    
    const options: IClientOptions = {
      clientId: `${this.config.clientId}_${Date.now()}`,
      keepalive: this.config.keepalive,
      reconnectPeriod: this.config.reconnectPeriod,
      connectTimeout: this.config.connectTimeout,
      clean: this.config.clean,
      rejectUnauthorized: false
    };

    try {
      this.client = mqtt.connect(wsUrl, options);
      this.setupEventHandlers();
    } catch (error) {
      console.error('MQTT Service: Connection error:', error);
      this.isConnecting = false;
      this.notifyError(`Connection error: ${error}`);
      this.scheduleReconnect();
    }
  }

  private setupEventHandlers(): void {
    if (!this.client) return;

    this.client.on('connect', () => {
      console.log('MQTT Service: Connected to broker');
      this.isConnecting = false;
      this.reconnectAttempts = 0;
      this.lastMessageTime = Date.now();
      
      // Subscribe to all relevant topics
      const topics = [
        'instruments_ti',
        'instrument/htr_a',
        'instrument/htr_b',
        `instrument/${import.meta.env.VITE_UNIT_NAME || 'unit1'}/htr_a/temperature`,
        `instrument/${import.meta.env.VITE_UNIT_NAME || 'unit1'}/htr_b/temperature`
      ];

      topics.forEach(topic => {
        this.client?.subscribe(topic, { qos: 1 }, (err) => {
          if (err) {
            console.error(`MQTT Service: Failed to subscribe to ${topic}:`, err);
          } else {
            console.log(`MQTT Service: Subscribed to ${topic}`);
          }
        });
      });

      this.notifyConnectionChange(true, 'Connected');
    });

    this.client.on('message', (topic, message) => {
      this.lastMessageTime = Date.now();
      
      try {
        const data: TemperatureData = JSON.parse(message.toString());
        console.log(`MQTT Service: Received message on ${topic}:`, data);

        // Extract temperature from various message formats
        let temperature: number | null = null;
        let deviceType: string | null = null;

        // Check for processed temperature data
        if (data.data?.payload?.['/processdatamaster/temperature']?.data) {
          temperature = Number(data.data.payload['/processdatamaster/temperature'].data);
          deviceType = data.device_type || this.extractDeviceTypeFromTopic(topic);
        }
        // Check for raw hex temperature data
        else if (data.data?.payload?.['/iolinkmaster/port[6]/iolinkdevice/pdin']?.data) {
          const hexTemp = data.data.payload['/iolinkmaster/port[6]/iolinkdevice/pdin'].data;
          temperature = this.convertHexToFahrenheit(hexTemp);
          deviceType = data.device_type || this.extractDeviceTypeFromTopic(topic);
        }
        // Direct temperature in payload
        else if (data.temperature) {
          temperature = data.temperature;
          deviceType = data.device_type || this.extractDeviceTypeFromTopic(topic);
        }

        if (temperature !== null && deviceType && !isNaN(temperature) && temperature > 0) {
          const heaterData: HeaterData = {
            temperature,
            timestamp: data.timestamp || new Date().toISOString(),
            lastUpdate: new Date()
          };

          // Store the data
          this.heaterData.set(deviceType, heaterData);

          console.log(`MQTT Service: Temperature update - ${deviceType}: ${temperature}°F`);
          
          // Notify all subscribers
          this.notifyTemperatureUpdate(deviceType, heaterData);
        }
      } catch (error) {
        console.error('MQTT Service: Error parsing message:', error);
      }
    });

    this.client.on('error', (error) => {
      console.error('MQTT Service: Error:', error);
      this.notifyError(`MQTT error: ${error.message}`);
    });

    this.client.on('reconnect', () => {
      console.log('MQTT Service: Attempting to reconnect...');
      this.notifyConnectionChange(false, 'Reconnecting...');
    });

    this.client.on('offline', () => {
      console.log('MQTT Service: Connection offline');
      this.notifyConnectionChange(false, 'Offline');
    });

    this.client.on('close', () => {
      console.log('MQTT Service: Connection closed');
      this.notifyConnectionChange(false, 'Disconnected');
      this.scheduleReconnect();
    });

    this.client.on('disconnect', () => {
      console.log('MQTT Service: Disconnected');
      this.notifyConnectionChange(false, 'Disconnected');
    });
  }

  private extractDeviceTypeFromTopic(topic: string): string | null {
    if (topic.includes('htr_a') || topic.includes('htr-a')) {
      return 'HTR-A';
    } else if (topic.includes('htr_b') || topic.includes('htr-b')) {
      return 'HTR-B';
    }
    return null;
  }

  private convertHexToFahrenheit(hexTemp: string): number {
    try {
      return parseInt(hexTemp, 16) * 0.1;
    } catch (error) {
      console.error('MQTT Service: Error converting hex temperature:', error);
      return 0;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('MQTT Service: Max reconnection attempts reached');
      this.notifyError('Max reconnection attempts reached');
      return;
    }

    if (this.reconnectInterval) {
      clearTimeout(this.reconnectInterval);
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000); // Exponential backoff, max 30s
    
    console.log(`MQTT Service: Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);
    
    this.reconnectInterval = setTimeout(() => {
      this.isConnecting = false;
      this.connect();
    }, delay);
  }

  private setupHealthCheck(): void {
    this.healthCheckInterval = setInterval(() => {
      if (this.client && this.client.connected) {
        const timeSinceLastMessage = Date.now() - this.lastMessageTime;
        
        // If no messages for 30 seconds, consider connection stale
        if (timeSinceLastMessage > 30000) {
          console.warn('MQTT Service: No messages for 30s, connection may be stale');
          this.notifyConnectionChange(false, 'Stale Connection');
        }
      }
    }, 10000); // Check every 10 seconds
  }

  private notifyTemperatureUpdate(deviceType: string, data: HeaterData): void {
    this.callbacks.forEach(callback => {
      callback.onTemperatureUpdate?.(deviceType, data);
    });
  }

  private notifyConnectionChange(connected: boolean, status: string): void {
    this.callbacks.forEach(callback => {
      callback.onConnectionChange?.(connected, status);
    });
  }

  private notifyError(error: string): void {
    this.callbacks.forEach(callback => {
      callback.onError?.(error);
    });
  }

  public disconnect(): void {
    console.log('MQTT Service: Disconnecting...');
    
    if (this.reconnectInterval) {
      clearTimeout(this.reconnectInterval);
      this.reconnectInterval = null;
    }
    
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    
    if (this.client) {
      this.client.end();
      this.client = null;
    }
    
    this.isConnecting = false;
    this.notifyConnectionChange(false, 'Disconnected');
  }

  public isConnected(): boolean {
    return this.client?.connected || false;
  }

  public getConnectionStatus(): string {
    if (!this.client) return 'Not Connected';
    if (this.client.connected) return 'Connected';
    if (this.isConnecting) return 'Connecting...';
    return 'Disconnected';
  }

  public publish(topic: string, message: string, options?: any): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.client && this.client.connected) {
        this.client.publish(topic, message, options, (error) => {
          if (error) {
            console.error('MQTT Service: Publish error:', error);
            reject(error);
          } else {
            resolve();
          }
        });
      } else {
        const error = new Error('MQTT Service: Cannot publish - not connected');
        console.error(error.message);
        reject(error);
      }
    });
  }
}

export default MqttService; 