import React, { useState, useEffect, useRef } from 'react';
// import type { IClientOptions } from 'mqtt';
// import mqtt from 'mqtt';
import { Switch } from '@mui/material';
import { BoltIcon } from '@heroicons/react/24/solid';
import MqttService from '../services/mqttService';

interface HtrDeviceDetailProps {
  deviceType: string;
  ioLinkIp: string;
}

interface HtrConfig {
  setpoint: number;
  currentTemp: number;
  output: number;
  kp: number;
  ki: number;
  kd: number;
  pulseState: boolean;
  controlMode: 'FULL_POWER' | 'PID';
  sections: boolean[];  // Status of 4 heater sections
  isAuto: boolean;     // Auto/Manual mode
  lastSectionChange: number; // Timestamp of last section change
  nextAction: 'add' | 'remove' | 'none';
  previousSetpoint: number; // Add this to track setpoint changes
  lastActionType: 'none' | 'add' | 'remove'; // Track the last action performed
  pendingChange: boolean; // Add this to track if we're in the middle of a change sequence
  lowPowerStartTime: number | null; // Add timestamp when low power condition starts
  lastTemp: number; // Track previous temperature for trend
  tempTrend: 'rising' | 'falling' | 'stable'; // Track temperature trend
  lastTempUpdate: number; // Add timestamp of last temperature reading
}

// interface HtrDevice {
//   id: string;
//   name: string;
//   ipAddress: string;
//   htrSystem: string;
//   ioLinkIp: string;
// }

// Device-specific configurations
const DEVICE_CONFIGS = {
  'HTR-A': {
    deviceId: '00-02-01-6D-55-8A',
    maxTemp: 750,
    name: 'HTR-A',
    description: 'Primary Heater Control',
    inputDeviceId: null // Uses own temperature sensor
  },
  'HTR-B': {
    deviceId: '00-02-01-6D-55-86',
    maxTemp: 750, // Updated to match HTR-A
    name: 'HTR-B',
    description: 'Secondary Heater Control',
    inputDeviceId: '00-02-01-6d-55-86' // External temperature sensor
  }
};

// Constants
const MAX_TEMP = 750; // Maximum temperature in Fahrenheit
const TEMP_APPROACH_THRESHOLD = 20; // Temperature difference threshold for starting removal
const STORAGE_KEY = 'htr_device_state_';
const SHARED_SETPOINT_KEY = 'shared_setpoint_global'; // Shared setpoint across all heaters

// Shared setpoint management functions
const getSharedSetpoint = (): number => {
  try {
    const saved = localStorage.getItem(SHARED_SETPOINT_KEY);
    return saved ? JSON.parse(saved) : 150; // Default to 150°F
  } catch (error) {
    console.error('Error loading shared setpoint:', error);
    return 150;
  }
};

const saveSharedSetpoint = (setpoint: number) => {
  try {
    localStorage.setItem(SHARED_SETPOINT_KEY, JSON.stringify(setpoint));
    // Trigger storage event for other instances
    window.dispatchEvent(new StorageEvent('storage', {
      key: SHARED_SETPOINT_KEY,
      newValue: JSON.stringify(setpoint),
      storageArea: localStorage
    }));
  } catch (error) {
    console.error('Error saving shared setpoint:', error);
  }
};

// Comprehensive state persistence functions
interface PersistentState {
  // Control settings
  isAuto: boolean;
  setpoint: number;
  sections: boolean[];
  
  // PID parameters
  kp: number;
  ki: number;
  kd: number;
  
  // Control mode
  controlMode: string;
  
  // Last saved timestamp
  lastSaved: number;
}

const getDeviceStorageKey = (deviceType: string): string => {
  return `${STORAGE_KEY}${deviceType}`;
};

const loadPersistentState = (deviceType: string): Partial<PersistentState> => {
  try {
    const storageKey = getDeviceStorageKey(deviceType);
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Check if data is recent (within last 24 hours)
      const isRecent = parsed.lastSaved && (Date.now() - parsed.lastSaved) < (24 * 60 * 60 * 1000);
      if (isRecent) {
        console.log(`Restored ${deviceType} state:`, parsed);
        return parsed;
      }
    }
    return {};
  } catch (error) {
    console.error(`Error loading ${deviceType} state:`, error);
    return {};
  }
};

const savePersistentState = (deviceType: string, state: Partial<PersistentState>) => {
  try {
    const storageKey = getDeviceStorageKey(deviceType);
    const dataToSave = {
      ...state,
      lastSaved: Date.now()
    };
    localStorage.setItem(storageKey, JSON.stringify(dataToSave));
    console.log(`Saved ${deviceType} state:`, dataToSave);
  } catch (error) {
    console.error(`Error saving ${deviceType} state:`, error);
  }
};

// MQTT Configuration - using WebSocket for persistent connection
// const MQTT_CONFIG = {
//   host: window.location.hostname || 'localhost',  // Use current hostname for external access
//   port: 39001,  // External MQTT WebSocket port
//   clientId: `htr_control_${Math.random().toString(16).substring(2, 8)}`
// };

// MQTT configuration
// const MQTT_OPTIONS: IClientOptions = {
//   clientId: `htr_control_${Math.random().toString(16).slice(3)}`,
//   clean: true,
//   connectTimeout: 4000,
//   username: 'iotuser',
//   password: 'iotpassword',
//   reconnectPeriod: 1000,
// };

// let staticMqttClient: MqttClient | null = null;

// IO-Link port mapping
const IO_LINK_PORTS = {
  SECTION_1: 'port[1]/iolinkdevice/pdout',
  SECTION_2: 'port[2]/iolinkdevice/pdout',
  SECTION_3: 'port[3]/iolinkdevice/pdout',
  SECTION_4: 'port[4]/iolinkdevice/pdout',
  PID_PULSE: 'port[5]/iolinkdevice/pdout',
  TEMP_SENSOR: 'port[6]/iolinkdevice/pdin'
};

// Add pulse modulation configuration
const PULSE_PERIOD = 1000; // 1 second pulse period
const MIN_PULSE_WIDTH = 50; // Minimum pulse width in milliseconds

// Define your output steps for cascade/stepped control
// const OUTPUT_STEPS = [0, 2, 5, 9, 12, 15, 18, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100];

// Helper function to save state to localStorage
// const saveState = (id: string, state: Partial<HtrConfig>) => {
//   try {
//     const key = STORAGE_KEY + id;
//     localStorage.setItem(key, JSON.stringify(state));
//   } catch (error) {
//     console.error('Error saving state:', error);
//   }
// };

// Helper function to load state from localStorage
// const loadState = (id: string): Partial<HtrConfig> | null => {
//   try {
//     const key = STORAGE_KEY + id;
//     const saved = localStorage.getItem(key);
//     return saved ? JSON.parse(saved) : null;
//   } catch (error) {
//     console.error('Error loading state:', error);
//     return null;
//   }
// };

const CircularTimer: React.FC<{
  timeLeft: number;
  totalTime: number;
}> = ({ timeLeft, totalTime }) => {
  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  // Reverse the progress so it counts down (decreasing circle)
  const progress = ((totalTime - timeLeft) / totalTime) * circumference;
  
  return (
    <div className="relative inline-flex items-center justify-center">
      <svg className="transform -rotate-90 w-14 h-14">
        {/* Background circle */}
        <circle
          cx="28"
          cy="28"
          r={radius}
          stroke="currentColor"
          strokeWidth="4"
          fill="transparent"
          className="text-gray-600"
        />
        {/* Progress circle - always green for countdown */}
        <circle
          cx="28"
          cy="28"
          r={radius}
          stroke="currentColor"
          strokeWidth="4"
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          className="text-green-500 transition-all duration-500"
        />
      </svg>
      <span className="absolute text-sm text-green-500 font-medium">
        {Math.ceil(timeLeft / 1000)}s
      </span>
    </div>
  );
};

const HtrDeviceDetail: React.FC<HtrDeviceDetailProps> = ({ deviceType, ioLinkIp }) => {
  const deviceConfig = DEVICE_CONFIGS[deviceType as keyof typeof DEVICE_CONFIGS];
  
  // const [device] = useState<HtrDevice>({
  //   id: deviceType,
  //   name: deviceConfig.name,
  //   ipAddress: ioLinkIp,
  //   htrSystem: deviceType,
  //   ioLinkIp: ioLinkIp
  // });

  // const [mqttConnected, setMqttConnected] = useState(false);
  // const [lastMqttUpdate, setLastMqttUpdate] = useState<Date | null>(null);
  // const [mqttReconnectAttempts, setMqttReconnectAttempts] = useState(0);
  // const [mqttStatus, setMqttStatus] = useState<string>('Disconnected');
  const [showDeviceInfo, setShowDeviceInfo] = useState(false);
  const [showPidTuning, setShowPidTuning] = useState(false);
  const [showSystemStatus, setShowSystemStatus] = useState(false);
  const [showDebugLog, setShowDebugLog] = useState(false); // Hidden by default for operators
  const [stateRestored, setStateRestored] = useState(false);
  const [timeUntilChange, setTimeUntilChange] = useState(15000); // Will be updated by timer effect
  // const [currentAction, setCurrentAction] = useState<'add' | 'remove' | 'none'>('none');
  const [debugLog, setDebugLog] = useState<string[]>([]);
  // const [realTemp, setRealTemp] = useState<number>(0);
  // const [tempHistory, setTempHistory] = useState<{temp: number, timestamp: number}[]>([]);

  const addDebugLog = (message: string) => {
    console.log(message); // For browser console
    const truncated = message.length > 100 ? message.substring(0, 97) + '...' : message;
    setDebugLog(prev => [...prev.slice(-49), truncated]); // Keep last 50 messages
  };

  // Listen for shared setpoint changes from other heater instances
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === SHARED_SETPOINT_KEY && e.newValue) {
        try {
          const newSetpoint = JSON.parse(e.newValue);
          setHtrConfig(prev => ({
            ...prev,
            setpoint: newSetpoint,
            previousSetpoint: newSetpoint
          }));
          addDebugLog(`SHARED: Setpoint synchronized to ${newSetpoint}°F from other heater`);
        } catch (error) {
          console.error('Error parsing shared setpoint:', error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Listen for shared setpoint changes from other heater instances
  useEffect(() => {
    // Mark state as restored after component mounts
    if (savedState && Object.keys(savedState).length > 0) {
      setStateRestored(true);
      setTimeout(() => setStateRestored(false), 3000); // Hide after 3 seconds
    }
  }, []);

  // MQTT Service Integration
  useEffect(() => {
    const mqttService = MqttService.getInstance();
    
    // Register callbacks for this component
    const componentId = `${deviceType}_${Date.now()}`;
    
    mqttService.registerCallbacks(componentId, {
      onTemperatureUpdate: (_deviceType: string, data: any) => {
        // Update temperature when MQTT data arrives
        if (data.temperature && data.temperature > 0) {
          forceTemperatureUpdate(data.temperature);
          addDebugLog(`MQTT: Temperature update ${data.temperature.toFixed(1)}°F`);
        }
      },
      onConnectionChange: (_connected: boolean, status: string) => {
        addDebugLog(`MQTT: ${status}`);
      },
      onError: (error: string) => {
        addDebugLog(`MQTT Error: ${error}`);
      }
    });

    // Cleanup on unmount
    return () => {
      mqttService.unregisterCallbacks(componentId);
    };
  }, [deviceType]);

  // Temperature conversion function with reduced logging
  // const convertHexToFahrenheit = (hexTemp: string): number => {
  //   try {
  //     const decimalValue = parseInt(hexTemp, 16);
  //     const fahrenheitTemp = (decimalValue / 10);
  //     return fahrenheitTemp;
  //   } catch (error) {
  //     addDebugLog(`Hex conversion error: ${hexTemp}`);
  //     return 0;
  //   }
  // };

  // Fetch temperature from backend API with reduced logging
  const fetchTemperatureFromAPI = async () => {
    try {
      // SHARED TEMPERATURE: Both HTR-A and HTR-B use the same temperature source from 192.168.30.29:port[6]
      // Always use HTR-A endpoint which reads from the shared temperature sensor
      const endpoint = 'htr-a'; // Force both devices to use HTR-A temperature reading
      
      // Use internal Docker service name for backend communication
      const backendUrl = 'http://backend-unit2:8000';
      const response = await fetch(`${backendUrl}/api/temperature/${endpoint}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      if (data.value && data.value > 0) {
        forceTemperatureUpdate(data.value);
      }
    } catch (error) {
      addDebugLog(`Temperature API error: ${error}`);
    }
  };

  // Periodic API fallback every 1 second for real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      // Always fetch from API for real-time updates, regardless of MQTT status
      fetchTemperatureFromAPI();
    }, 1000); // Update every 1 second

    return () => clearInterval(interval);
  }, []);

  // Initial API fetch
  useEffect(() => {
    fetchTemperatureFromAPI();
  }, []);



  // MQTT setup with reduced logging
  useEffect(() => {
    // const setupMqtt = () => {
    //   if (!staticMqttClient) {
    //     const wsUrl = `ws://${MQTT_CONFIG.host}:${MQTT_CONFIG.port}`;
        
    //     const client = mqtt.connect(wsUrl, {
    //       ...MQTT_OPTIONS,
    //       clientId: `${MQTT_CONFIG.clientId}_${deviceType}_${Date.now()}`, // Ensure unique client ID
    //       keepalive: 60, // Increase keepalive interval for stability
    //       reconnectPeriod: 5000, // Slower reconnection for stability
    //       connectTimeout: 10000, // Longer timeout
    //       clean: false // Maintain session for better stability
    //     });

    //     client.on('connect', () => {
    //       setMqttConnected(true);
    //       setMqttStatus('Connected');
    //       setMqttReconnectAttempts(0);
    //       addDebugLog(`MQTT: ${deviceType} Connected and subscribed to shared temperature topics`);
          
    //       // Get unit-specific topic
    //       const unitName = import.meta.env.VITE_UNIT_NAME || 'unit1';
          
    //       // SHARED TEMPERATURE: Both HTR-A and HTR-B subscribe to HTR-A temperature topics
    //       // since they share the same physical temperature sensor on 192.168.30.29:port[6]
    //       const sharedTempTopic = `instrument/${unitName}/htr-a/temperature`;
          
    //       // Subscribe to shared temperature topics (always use HTR-A source)
    //       client.subscribe('instruments_ti', { qos: 1 });
    //       client.subscribe('instrument/htr_a', { qos: 1 }); // Primary temperature source
    //       client.subscribe(sharedTempTopic, { qos: 1 }); // Shared temperature topic
    //     });

    //     client.on('error', (error) => {
    //       setMqttStatus('Error');
    //       addDebugLog(`MQTT Error: ${error.message}`);
    //     });

    //     client.on('reconnect', () => {
    //       setMqttStatus('Reconnecting...');
    //     });

    //     client.on('offline', () => {
    //       setMqttConnected(false);
    //       setMqttStatus('Offline');
    //     });

    //     client.on('close', () => {
    //       setMqttConnected(false);
    //       setMqttStatus('Disconnected');
    //     });

    //     client.on('message', (topic, message) => {
    //       setLastMqttUpdate(new Date());
    //       try {
    //         const data = JSON.parse(message.toString());
            
    //         // SHARED TEMPERATURE: Both HTR-A and HTR-B use HTR-A temperature topics
    //         const unitName = import.meta.env.VITE_UNIT_NAME || 'unit1';
    //         const sharedTempTopic = `instrument/${unitName}/htr-a/temperature`;
            
    //         // Handle processed temperature data from shared HTR-A topics
    //         if ((topic === 'instruments_ti' || topic === sharedTempTopic) && 
    //             data.data?.payload?.['/processdatamaster/temperature']?.data) {
    //           const tempValue = data.data.payload['/processdatamaster/temperature'].data;
    //           if (typeof tempValue === 'number' && tempValue > 0) {
    //             forceTemperatureUpdate(tempValue);
    //           }
    //         }
    //         // Handle raw hex temperature data from shared HTR-A topics (port 6)  
    //         else if ((topic === 'instrument/htr_a' || topic === sharedTempTopic) && 
    //                  data.data?.payload?.['/iolinkmaster/port[6]/iolinkdevice/pdin']?.data) {
    //           const hexTemp = data.data.payload['/iolinkmaster/port[6]/iolinkdevice/pdin'].data;
    //           const tempF = convertHexToFahrenheit(hexTemp);
    //           if (tempF > 0) {
    //             forceTemperatureUpdate(tempF);
    //           }
    //         }
    //       } catch (error) {
    //         // Silent error handling for malformed messages
    //       }
    //     });

    //     staticMqttClient = client;
    //   }
    // };
  }, [deviceType]);

  // Function to analyze temperature trend from history
  // const analyzeTrendFromHistory = (history: {temp: number, timestamp: number}[]) => {
  //   if (history.length < 3) return 'stable';
    
  //   // Get the last 3 readings
  //   const recent = history.slice(-3);
  //   const temps = recent.map(h => h.temp);
    
  //   // Calculate if there's a consistent trend
  //   const first = temps[0];
  //   const middle = temps[1];
  //   const last = temps[2];
    
  //   // Check if all three readings show the same trend
  //   if (first < middle && middle < last) {
  //     return 'rising';
  //   } else if (first > middle && middle > last) {
  //     return 'falling';
  //   } else {
  //     return 'stable';
  //   }
  // };

  // Add a force update function that always updates the state
  const forceTemperatureUpdate = (newTemp: number) => {
    if (newTemp > 0) {
      // Update temperature history (keep last 10 readings)
      // setTempHistory(prev => {
      //   const newHistory = [...prev, { temp: newTemp, timestamp: Date.now() }];
      //   return newHistory.slice(-10); // Keep only last 10 readings
      // });

      setHtrConfig(prev => {
        // Minimum change threshold to detect trend (0.5°F)
        const minChangeThreshold = 0.5;
        const tempDifference = Math.abs(newTemp - prev.currentTemp);
        
        let trend: 'rising' | 'falling' | 'stable' = 'stable';
        
        // Only update trend if there's a significant change
        if (tempDifference >= minChangeThreshold) {
          if (newTemp > prev.currentTemp) {
            trend = 'rising';
          } else if (newTemp < prev.currentTemp) {
            trend = 'falling';
          }
        } else {
          // Keep previous trend if change is too small
          trend = prev.tempTrend;
        }
        
        // Force state update with new temperature
        const newState: HtrConfig = {
          ...prev,
          currentTemp: newTemp,
          lastTemp: prev.currentTemp,
          tempTrend: trend,
          lastTempUpdate: Date.now()
        };
        
        // Log the state change with more detail
        if (tempDifference >= minChangeThreshold) {
          addDebugLog(`Temperature change: ${prev.currentTemp}°F -> ${newTemp}°F (${trend}, Δ${tempDifference.toFixed(1)}°F)`);
        } else {
          addDebugLog(`Temperature stable: ${newTemp}°F (change: ${tempDifference.toFixed(1)}°F < ${minChangeThreshold}°F threshold)`);
        }
        
        return newState;
      });
    }
  };

  // Initialize state with saved data
  const savedState = loadPersistentState(deviceType);
  const [htrConfig, setHtrConfig] = useState<HtrConfig>({
    setpoint: getSharedSetpoint(), // Shared setpoint
    currentTemp: 0,
    output: 0,
    kp: savedState.kp ?? 2.0,
    ki: savedState.ki ?? 0.1,
    kd: savedState.kd ?? 0.05,
    pulseState: false,
    controlMode: (savedState.controlMode === 'FULL_POWER' || savedState.controlMode === 'PID') ? savedState.controlMode : 'PID',
    sections: savedState.sections ?? [false, false, false, false],
    isAuto: savedState.isAuto ?? false,
    lastSectionChange: Date.now(),
    nextAction: 'none',
    previousSetpoint: getSharedSetpoint(),
    lastActionType: 'none',
    pendingChange: false,
    lowPowerStartTime: null,
    lastTemp: 0,
    tempTrend: 'stable',
    lastTempUpdate: Date.now()
  });

  // Timer size state - individual for each unit/heater
  const getTimerStorageKey = (deviceType: string): string => {
    const unitName = import.meta.env.VITE_UNIT_NAME || 'unit1';
    const htrType = deviceType.toLowerCase().replace('-', '');
    const key = `${unitName}${htrType}time`;
    console.log(`🔑 Timer storage key for ${deviceType}: ${key}`);
    return key;
  };

  const loadTimerSize = (deviceType: string): number => {
    try {
      const key = getTimerStorageKey(deviceType);
      const saved = localStorage.getItem(key);
      const value = saved ? parseInt(saved) : 15; // Default 15 seconds
      console.log(`📥 Loading timer size for ${deviceType}: key=${key}, saved=${saved}, value=${value}s`);
      return value;
    } catch {
      console.log(`❌ Failed to load timer size for ${deviceType}, using default 15s`);
      return 15;
    }
  };

  const saveTimerSize = (deviceType: string, timerSize: number) => {
    try {
      const key = getTimerStorageKey(deviceType);
      localStorage.setItem(key, timerSize.toString());
      console.log(`💾 Saved timer size for ${deviceType}: key=${key}, value=${timerSize}s`);
    } catch (error) {
      console.error('Failed to save timer size:', error);
    }
  };

  const [timerSize, setTimerSize] = useState<number>(loadTimerSize(deviceType));

  // Add IO-Link port status tracking
  const [ioLinkPortStatus, setIoLinkPortStatus] = useState<{
    port1: { value: string; status: 'ok' | 'error' | 'unknown' };
    port2: { value: string; status: 'ok' | 'error' | 'unknown' };
    port3: { value: string; status: 'ok' | 'error' | 'unknown' };
    port4: { value: string; status: 'ok' | 'error' | 'unknown' };
  }>({
    port1: { value: '00', status: 'unknown' },
    port2: { value: '00', status: 'unknown' },
    port3: { value: '00', status: 'unknown' },
    port4: { value: '00', status: 'unknown' }
  });

  // Save state changes to localStorage - comprehensive persistence
  useEffect(() => {
    savePersistentState(deviceType, {
      isAuto: htrConfig.isAuto,
      setpoint: htrConfig.setpoint,
      sections: htrConfig.sections,
      kp: htrConfig.kp,
      ki: htrConfig.ki,
      kd: htrConfig.kd,
      controlMode: htrConfig.controlMode
    });
  }, [deviceType, htrConfig.isAuto, htrConfig.setpoint, htrConfig.sections, htrConfig.kp, htrConfig.ki, htrConfig.kd, htrConfig.controlMode]);

  // Save timer size changes
  useEffect(() => {
    saveTimerSize(deviceType, timerSize);
  }, [deviceType, timerSize]);

  // Restore section states on component mount
  useEffect(() => {
    if (savedState.sections && Array.isArray(savedState.sections)) {
      // Small delay to ensure MQTT is connected before sending commands
      const restoreTimer = setTimeout(() => {
        savedState.sections!.forEach((isEnabled, index) => {
          if (isEnabled) {
            const portMap = [IO_LINK_PORTS.SECTION_1, IO_LINK_PORTS.SECTION_2, IO_LINK_PORTS.SECTION_3, IO_LINK_PORTS.SECTION_4];
            sendIoLinkCommand(portMap[index], true);
            console.log(`Restored section ${index + 1} to ON for ${deviceType}`);
          }
        });
      }, 2000);
      
      return () => clearTimeout(restoreTimer);
    }
  }, []); // Run only once on mount

  // Add this helper function for HTTP POST to IO-Link master
  const sendIoLinkHttpCommand = async (portNum: number, state: boolean) => {
    // Use internal Docker service name for backend communication
    const backendUrl = 'http://backend-unit2:8000';
    
    // Relay to backend API instead of direct fetch to IO-Link master
    const url = `${backendUrl}/api/iolink/port/${portNum}/setdata`;
    const payload = {
      state,
      ioLinkIp
    };
    addDebugLog(`Backend: POST to ${url} with payload: ${JSON.stringify(payload)}`);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      addDebugLog(`Backend POST to port ${portNum}: ${JSON.stringify(payload)} => ${JSON.stringify(data)}`);
      return data;
    } catch (err) {
      addDebugLog(`Backend POST error for port ${portNum}: ${err}`);
      return null;
    }
  };

  // Function to send IO-Link commands
  const sendIoLinkCommand = (port: string, state: boolean) => {
    const topic = `instrument/${deviceType.toLowerCase()}/iolink/${port}`;
    const message = state ? '1' : '0';
    addDebugLog(`Sending command: ${topic} -> ${message}`);
    // staticMqttClient.publish(topic, message, { qos: 1 }, (error?: Error) => {
    //   if (error) {
    //     addDebugLog(`MQTT Error: Failed to publish to ${topic} - ${error.message}`);
    //   } else {
    //     addDebugLog(`MQTT Success: Published ${message} to ${topic}`);
    //   }
    // });
  };

  // Modified handleAutoToggle to prevent immediate section activation
  const handleAutoToggle = () => {
    setHtrConfig(prev => {
      if (!prev.isAuto) {
        // When turning auto mode ON
        return {
          ...prev,
          isAuto: true,
          lastSectionChange: Date.now(),
          previousSetpoint: prev.setpoint,
          lastActionType: 'none',
          nextAction: 'none',
          pendingChange: false
        };
      }
      // When turning auto mode OFF
      return { 
        ...prev, 
        isAuto: false,
        nextAction: 'none',
        lastActionType: 'none',
        pendingChange: false
      };
    });
  };

  // Modify section toggle to use correct IO-Link ports
  const handleSectionToggle = (sectionIndex: number) => {
    if (htrConfig.isAuto) {
      addDebugLog(`Manual Toggle: Auto mode is ON - manual toggle blocked for section ${sectionIndex + 1}`);
      return;
    }

    const newSections = [...htrConfig.sections];
    const newState = !newSections[sectionIndex];
    
    addDebugLog(`Manual Toggle: Section ${sectionIndex + 1} state changed from ${newSections[sectionIndex]} to ${newState}`);
    
    // Update UI immediately
    setHtrConfig(prev => ({
      ...prev,
      sections: newSections.map((section, index) => index === sectionIndex ? newState : section),
      lastSectionChange: Date.now()
    }));

    // Send IO-Link command
    const portMap = [
      IO_LINK_PORTS.SECTION_1,
      IO_LINK_PORTS.SECTION_2,
      IO_LINK_PORTS.SECTION_3,
      IO_LINK_PORTS.SECTION_4
    ];
    
    addDebugLog(`Manual Toggle: Sending IO-Link command to ${portMap[sectionIndex]} = ${newState}`);
    sendIoLinkCommand(portMap[sectionIndex], newState);
    
    // Immediately update IO-Link port status display
    setIoLinkPortStatus(prev => {
      const portKey = `port${sectionIndex + 1}` as keyof typeof prev;
      return {
        ...prev,
        [portKey]: { value: newState ? '01' : '00', status: 'ok' }
      };
    });
    
    // Immediately poll IO-Link status to sync UI
    setTimeout(() => {
      addDebugLog(`Manual Toggle: Polling IO-Link status after section ${sectionIndex + 1} toggle`);
      pollIoLinkStatus();
    }, 500); // Wait 500ms for IO-Link command to process
  };

  // Add PID output history for averaging and time tracking
  const highPowerStartTimeRef = useRef<number | null>(null);
  const lowPowerStartTimeRef = useRef<number | null>(null);
  
  // Simple function to add next section when PID stays 100% for 15 seconds
  // const addNextSection = (config: HtrConfig): boolean => {
  //   const activeSections = config.sections.filter(Boolean).length;
  //   if (activeSections >= 4) return false; // All sections already active
    
  //   // Find next inactive section to add (skip section 1 as it's always on)
  //   for (let i = 1; i < config.sections.length; i++) {
  //     if (!config.sections[i]) {
  //       addDebugLog(`Add Section: Adding section ${i + 1} (Active sections: ${activeSections})`);
  //       return true; // Found section to add
  //     }
  //   }
  //   return false; // No sections to add
  // };
  
  // Simple function to remove last section when PID stays 0% for 15 seconds
  // const removeLastSection = (config: HtrConfig): boolean => {
  //   const activeSections = config.sections.filter(Boolean).length;
  //   if (activeSections <= 1) return false; // Only section 1 active, can't remove
    
  //   // Find last active section to remove (never remove section 1)
  //   for (let i = config.sections.length - 1; i > 0; i--) {
  //     if (config.sections[i]) {
  //       addDebugLog(`Remove Section: Removing section ${i + 1} (Active sections: ${activeSections})`);
  //       return true; // Found section to remove
  //     }
  //   }
  //   return false; // No sections to remove
  // };
  


  // Auto mode section management - continuous and independent
  useEffect(() => {
    if (!htrConfig.isAuto) {
      // Clear timers when auto mode is turned off
      highPowerStartTimeRef.current = null;
      lowPowerStartTimeRef.current = null;
      return;
    }

    const interval = setInterval(() => {
      setHtrConfig(prev => {
        // Section 0 is managed manually - no auto control needed

        // Get current state for decision making
        const activeSections = prev.sections.filter(Boolean).length;
        const currentOutput = prev.output;
        const now = Date.now();
        const timerMs = timerSize * 1000; // Convert seconds to milliseconds

        console.log(`🔄 Auto Check: PID=${currentOutput.toFixed(1)}%, Active=${activeSections}/4, Timer=${timerSize}s, High Timer=${highPowerStartTimeRef.current ? 'ON' : 'OFF'}, Low Timer=${lowPowerStartTimeRef.current ? 'ON' : 'OFF'}`);

        // ADD LOGIC: PID = 100% for timer duration continuously
        // Only start timer if we can actually add more sections
        if (currentOutput >= 100 && activeSections < 4) {
          if (highPowerStartTimeRef.current === null) {
            // Check if there are actually sections to add before starting timer
            const hasInactiveSections = prev.sections.some(section => !section);
            if (hasInactiveSections) {
              // Start add timer
              highPowerStartTimeRef.current = now;
              console.log(`🔥 ADD Timer: Started for section ${activeSections + 1} (PID: 100%, Timer: ${timerSize}s)`);
            } else {
              console.log(`🛑 No sections to add - all 4 sections already active`);
            }
          } else {
            // Check if timer duration has passed
            const timeAtHighPower = now - highPowerStartTimeRef.current;
            console.log(`⏱️ ADD Timer: ${Math.round(timeAtHighPower / 1000)}s/${timerSize}s (PID: ${currentOutput.toFixed(1)}%)`);
            
            if (timeAtHighPower >= timerMs) {
              // Add next section (find first inactive section)
              for (let i = 0; i < prev.sections.length; i++) {
                if (!prev.sections[i]) {
                  const newSections = [...prev.sections];
                  newSections[i] = true;
                  const portMap = [IO_LINK_PORTS.SECTION_1, IO_LINK_PORTS.SECTION_2, IO_LINK_PORTS.SECTION_3, IO_LINK_PORTS.SECTION_4];
                  sendIoLinkCommand(portMap[i], true);
                  console.log(`✅ ADD Action: Added section ${i + 1} (now ${activeSections + 1}/4 active)`);
                  
                  // Reset timer and continue checking
                  highPowerStartTimeRef.current = null;
                  
                  return {
                    ...prev,
                    sections: newSections,
                    lastSectionChange: now
                  };
                }
              }
              // If we get here, no sections were added (shouldn't happen)
              console.log(`⚠️ ADD Timer completed but no sections to add`);
              highPowerStartTimeRef.current = null;
            }
          }
        } else if (currentOutput < 100) {
          // Reset add timer if PID drops below 100%
          if (highPowerStartTimeRef.current !== null) {
            console.log(`🔄 ADD Timer: Reset (PID dropped to ${currentOutput.toFixed(1)}%)`);
            highPowerStartTimeRef.current = null;
          }
        } else if (activeSections >= 4) {
          // Stop add timer if all sections are active
          if (highPowerStartTimeRef.current !== null) {
            console.log(`🛑 ADD Timer: Stopped (All 4 sections active)`);
            highPowerStartTimeRef.current = null;
          }
        }

        // REMOVE LOGIC: PID = 0% for timer duration continuously  
        // Never remove section 0 - only start timer if we can actually remove sections
        if (currentOutput <= 0 && activeSections > 1) {
          if (lowPowerStartTimeRef.current === null) {
            // Check if there are actually sections to remove (excluding section 0)
            const hasRemovableSections = prev.sections.slice(1).some(section => section);
            if (hasRemovableSections) {
              // Start remove timer
              lowPowerStartTimeRef.current = now;
              console.log(`❄️ REMOVE Timer: Started for section removal (PID: 0%, Timer: ${timerSize}s)`);
            } else {
              console.log(`🛑 No sections to remove - only section 0 remains (protected)`);
            }
          } else {
            // Check if timer duration has passed
            const timeAtLowPower = now - lowPowerStartTimeRef.current;
            console.log(`⏱️ REMOVE Timer: ${Math.round(timeAtLowPower / 1000)}s/${timerSize}s (PID: ${currentOutput.toFixed(1)}%)`);
            
            if (timeAtLowPower >= timerMs) {
              // Remove last active section (find last active section working backwards, never remove section 0)
              for (let i = prev.sections.length - 1; i > 0; i--) {
                if (prev.sections[i]) {
                  const newSections = [...prev.sections];
                  newSections[i] = false;
                  const portMap = [IO_LINK_PORTS.SECTION_1, IO_LINK_PORTS.SECTION_2, IO_LINK_PORTS.SECTION_3, IO_LINK_PORTS.SECTION_4];
                  sendIoLinkCommand(portMap[i], false);
                  console.log(`✅ REMOVE Action: Removed section ${i + 1} (now ${activeSections - 1}/4 active, Section 0 protected)`);
                  
                  // Reset timer and continue checking
                  lowPowerStartTimeRef.current = null;
                  
                  return {
                    ...prev,
                    sections: newSections,
                    lastSectionChange: now
                  };
                }
              }
              // If we get here, no sections were removed (shouldn't happen)
              console.log(`⚠️ REMOVE Timer completed but no sections to remove`);
              lowPowerStartTimeRef.current = null;
            }
          }
        } else if (currentOutput > 0) {
          // Reset remove timer if PID rises above 0%
          if (lowPowerStartTimeRef.current !== null) {
            console.log(`🔄 REMOVE Timer: Reset (PID rose to ${currentOutput.toFixed(1)}%)`);
            lowPowerStartTimeRef.current = null;
          }
        } else if (activeSections <= 1) {
          // Stop remove timer if only section 0 remains
          if (lowPowerStartTimeRef.current !== null) {
            console.log(`🛑 REMOVE Timer: Stopped (Only section 0 remains, protected)`);
            lowPowerStartTimeRef.current = null;
          }
        }

        // Return unchanged state - continue checking next cycle
        return prev;
      });
    }, 1000); // Check every second continuously

    return () => {
      clearInterval(interval);
      // Don't clear timers here - let them persist across component updates
    };
  }, [htrConfig.isAuto, timerSize]); // Restart when auto mode or timer size changes

  // Timer update effect
  useEffect(() => {
    if (!htrConfig.isAuto) {
      setTimeUntilChange(timerSize * 1000);
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      
      // Calculate timer based on current power conditions
      let timeLeft = timerSize * 1000;
      let currentAction: 'add' | 'remove' | 'none' = 'none';
      
      // Check high power timer
      if (highPowerStartTimeRef.current !== null) {
        const timeElapsed = now - highPowerStartTimeRef.current;
        const timerMs = timerSize * 1000;
        if (timeElapsed < timerMs) {
          timeLeft = timerMs - timeElapsed;
          currentAction = 'add';
        }
      }
      
      // Check low power timer
      if (lowPowerStartTimeRef.current !== null) {
        const timeElapsed = now - lowPowerStartTimeRef.current;
        const timerMs = timerSize * 1000;
        if (timeElapsed < timerMs) {
          timeLeft = timerMs - timeElapsed;
          currentAction = 'remove';
        }
      }
      
      setTimeUntilChange(timeLeft);
      setHtrConfig(prev => ({ ...prev, nextAction: currentAction }));
    }, 100);

    return () => clearInterval(interval);
  }, [htrConfig.isAuto, timerSize]); // Add timerSize to dependencies

  // PID state refs for integral and lastError
  const integralRef = useRef(0);
  const lastErrorRef = useRef(0);
  // const lastOutputRef = useRef(0);
  // const lastTempRef = useRef(0);
  // const lastTempTimeRef = useRef(0);
  const tempVelocityRef = useRef(0);
  // const lastTempVelocityRef = useRef(0);

  // Add temperature history for velocity calculation
  const tempHistoryRef = useRef<{temp: number, timestamp: number}[]>([]);
  
  // PID calculation function
  const calculatePIDOutput = (setpoint: number, currentTemp: number, kp: number, ki: number, kd: number, lastError: number, integral: number): { output: number, newIntegral: number, newLastError: number } => {
    const error = setpoint - currentTemp;
    const newIntegral = integral + error;
    const derivative = error - lastError;
    
    let output = (kp * error) + (ki * newIntegral) + (kd * derivative);
    
    // Clamp output to 0-100%
    output = Math.max(0, Math.min(100, output));
    
    return {
      output,
      newIntegral,
      newLastError: error
    };
  };

  // PID state tracking
  const pidStateRef = useRef({
    integral: 0,
    lastError: 0
  });

  // Update PID output whenever temperature or setpoint changes
  useEffect(() => {
    if (htrConfig.currentTemp > 0) { // Only calculate if we have valid temperature
      const pidResult = calculatePIDOutput(
        htrConfig.setpoint,
        htrConfig.currentTemp,
        htrConfig.kp,
        htrConfig.ki,
        htrConfig.kd,
        pidStateRef.current.lastError,
        pidStateRef.current.integral
      );
      
      // Update PID state
      pidStateRef.current.integral = pidResult.newIntegral;
      pidStateRef.current.lastError = pidResult.newLastError;
      
      // Update htrConfig with new output
      setHtrConfig(prev => ({
        ...prev,
        output: pidResult.output
      }));
      
      console.log(`PID: SP=${htrConfig.setpoint}°F, PV=${htrConfig.currentTemp.toFixed(1)}°F, Error=${pidResult.newLastError.toFixed(1)}°F, Output=${pidResult.output.toFixed(1)}%`);
    }
  }, [htrConfig.setpoint, htrConfig.currentTemp, htrConfig.kp, htrConfig.ki, htrConfig.kd]);

  // Stepped Output Controller with Acceleration-Based Control
  const calculateSteppedOutput = (setpoint: number, currentTemp: number, currentOutput: number, _tempTrend: string): number => {
    const error = setpoint - currentTemp;
    const absError = Math.abs(error);
    const now = Date.now();
    
    // Add current temperature to history
    tempHistoryRef.current.push({temp: currentTemp, timestamp: now});
    
    // Keep only last 10 seconds of data
    const tenSecondsAgo = now - 10000;
    tempHistoryRef.current = tempHistoryRef.current.filter(entry => entry.timestamp > tenSecondsAgo);
    
    // Calculate velocity using 5-second average
    let tempVelocity = 0;
    if (tempHistoryRef.current.length >= 2) {
      const fiveSecondsAgo = now - 5000;
      const recentData = tempHistoryRef.current.filter(entry => entry.timestamp > fiveSecondsAgo);
      
      if (recentData.length >= 2) {
        const oldestEntry = recentData[0];
        const newestEntry = recentData[recentData.length - 1];
        const timeDiff = (newestEntry.timestamp - oldestEntry.timestamp) / 1000; // Convert to seconds
        
        if (timeDiff > 0) {
          tempVelocity = (newestEntry.temp - oldestEntry.temp) / timeDiff;
          // Debug velocity calculation
          addDebugLog(`Velocity Calc: Current=${currentTemp}°F, 5s ago=${oldestEntry.temp}°F, TimeDiff=${timeDiff.toFixed(1)}s, Velocity=${tempVelocity.toFixed(3)}°F/s, DataPoints=${recentData.length}`);
        }
      } else {
        addDebugLog(`Velocity Calc: Not enough recent data - Current=${currentTemp}°F, RecentDataPoints=${recentData.length}`);
      }
    } else {
      addDebugLog(`Velocity Calc: No history data - Current=${currentTemp}°F, HistoryLength=${tempHistoryRef.current.length}`);
    }
    
    // Deadband to prevent oscillation near setpoint
    const deadband = 0.5; // ±0.5°F deadband
    if (absError <= deadband) {
      return 0; // No output in deadband
    }
    
    // Determine step size based on current output level
    let stepSize: number;
    if (currentOutput >= 20) {
      stepSize = 20; // 20% steps for 20-100% range
    } else if (currentOutput >= 10) {
      stepSize = 10; // 10% steps for 10-20% range (minimum modulation)
    } else if (currentOutput >= 5) {
      stepSize = 5;  // 5% steps for 5-10% range
    } else {
      stepSize = 1;  // 1% steps for 1-5% range
    }
    
    // Simplified acceleration-based control logic
    let newOutput = currentOutput;
    
    if (error > 0) {
      // Temperature is below setpoint - we need to heat
      if (tempVelocity < -0.05) {
        // Temperature is falling - INCREASE power to maintain heating
        newOutput = Math.min(100, currentOutput + stepSize);
      } else if (tempVelocity > 0.1) {
        // Temperature is rising fast - REDUCE power to avoid overshoot
        newOutput = Math.max(10, currentOutput - stepSize);
      } else if (tempVelocity > 0.02) {
        // Temperature is rising slowly - slightly reduce power
        newOutput = Math.max(10, currentOutput - (stepSize / 2));
      } else if (tempVelocity < -0.02) {
        // Temperature is falling slowly - increase power
        newOutput = Math.min(100, currentOutput + stepSize);
      } else {
        // Stable temperature - maintain or increase if too low
        if (currentOutput < 30) {
          newOutput = Math.min(100, currentOutput + stepSize);
        } else if (absError < 5) {
          // Close to setpoint (within 5°F) and stable - reduce power gradually
          newOutput = Math.max(10, currentOutput - (stepSize / 2));
        }
      }
    } else {
      // Temperature is above setpoint - we need to cool down
      if (tempVelocity > 0.05) {
        // Temperature is still rising - REDUCE power
        newOutput = Math.max(0, currentOutput - stepSize);
      } else if (tempVelocity < -0.05) {
        // Temperature is falling - reduce power less
        newOutput = Math.max(0, currentOutput - (stepSize / 2));
      } else {
        // Temperature is stable - reduce power gradually
        newOutput = Math.max(0, currentOutput - (stepSize / 2));
      }
    }
    
    // Ensure minimum output for heating when below setpoint
    if (error > 1 && newOutput < 10) {
      newOutput = 10; // Minimum 10% output when heating needed
    }
    
    return newOutput;
  };

  // Remove temperature simulation
  useEffect(() => {
    if (!htrConfig.sections[0]) return;

    let pulseTimer: NodeJS.Timeout;
    const interval = setInterval(() => {
      setHtrConfig((prev) => {
        const error = prev.setpoint - prev.currentTemp;
        const absError = Math.abs(error);
        
        addDebugLog(`PID Debug: Setpoint=${prev.setpoint}°F, Current=${prev.currentTemp}°F, Error=${error.toFixed(1)}°F, AbsError=${absError.toFixed(1)}°F`);
        
        // Determine control mode based on error magnitude
        let newControlMode: 'FULL_POWER' | 'PID';
        let newOutput: number;
        
        if (absError > 10) {
          // Large error (>10°F): Use full power for fast response
          newControlMode = 'FULL_POWER';
          if (error > 0) {
            // Temperature is below setpoint - use full power
            newOutput = 100;
            addDebugLog(`PID: Large error (${absError.toFixed(1)}°F > 10°F) - Temperature below setpoint - Using FULL_POWER mode, Output=100%`);
          } else {
            // Temperature is above setpoint - no heating needed
            newOutput = 0;
            addDebugLog(`PID: Large error (${absError.toFixed(1)}°F > 10°F) - Temperature above setpoint - No heating needed, Output=0%`);
          }
          // Reset PID state when switching to full power
          integralRef.current = 0;
          lastErrorRef.current = 0;
        } else {
          // Small error (≤10°F): Use acceleration-based control for modulation
          newControlMode = 'PID';
          newOutput = calculateSteppedOutput(prev.setpoint, prev.currentTemp, prev.output, prev.tempTrend);
          addDebugLog(`PID: Small error (${absError.toFixed(1)}°F ≤ 10°F) - Using PID mode, Output=${newOutput.toFixed(1)}%`);
        }
        
        // Handle pulse modulation with improved timing
        if (newOutput > 0) {
          const pulseOnTime = Math.max(MIN_PULSE_WIDTH, (newOutput / 100) * PULSE_PERIOD);
          const pulseOffTime = PULSE_PERIOD - pulseOnTime;
          
          // Enhanced debug logging with acceleration info
          const tempVelocity = tempVelocityRef.current;
          // const tempAcceleration = (tempVelocity - lastTempVelocityRef.current) / 1; // Approximate acceleration
          
          let debugReason = '';
          if (absError > 10) {
            debugReason = 'Large error (>10°F) - Full power';
          } else if (error > 0 && tempVelocity < -0.05) {
            debugReason = 'Below setpoint + falling fast - INCREASING power to maintain heating';
          } else if (error > 0 && tempVelocity > 0.1) {
            debugReason = 'Below setpoint + rising fast - REDUCING power to avoid overshoot';
          } else if (error > 0 && tempVelocity > 0.02) {
            debugReason = 'Below setpoint + rising slowly - Slightly reducing power';
          } else if (error > 0 && tempVelocity < -0.02) {
            debugReason = 'Below setpoint + falling slowly - INCREASING power';
          } else if (error < 0 && tempVelocity > 0.05) {
            debugReason = 'Above setpoint + rising - REDUCING power';
          } else if (error < 0 && tempVelocity < -0.05) {
            debugReason = 'Above setpoint + falling - Reducing power less';
          } else if (error > 0) {
            if (absError < 5) {
              debugReason = 'Below setpoint + close to target + stable - Reducing power gradually';
            } else {
              debugReason = 'Below setpoint - Stable adjustment';
            }
          } else {
            debugReason = 'Above setpoint - Gradual power reduction';
          }
          
          addDebugLog(`Velocity Control: Error=${error.toFixed(1)}°F, Vel=${tempVelocity.toFixed(3)}°F/s, Output=${newOutput.toFixed(1)}% - ${debugReason}`);
          
          // Send ON pulse
          sendIoLinkHttpCommand(5, true);
          if (pulseTimer) clearTimeout(pulseTimer);
          
          // Schedule OFF pulse
          if (pulseOffTime > 0) {
            pulseTimer = setTimeout(() => {
              sendIoLinkHttpCommand(5, false);
            }, pulseOnTime);
          }
        } else {
          // Output is 0, ensure port 5 is OFF
          addDebugLog(`Stepped Control: Error=${error.toFixed(1)}°F, Trend=${prev.tempTrend}, Output=0%, Mode=${newControlMode} - No output (deadband or no heating needed)`);
          sendIoLinkHttpCommand(5, false);
          if (pulseTimer) clearTimeout(pulseTimer);
        }

        return {
          ...prev,
          output: newOutput,
          controlMode: newControlMode,
          pulseState: newOutput > 0
        };
      });
    }, 1000);

    return () => {
      clearInterval(interval);
      if (pulseTimer) {
        clearTimeout(pulseTimer);
      }
    };
  }, [htrConfig.sections[0], htrConfig.setpoint, htrConfig.kp, htrConfig.ki, htrConfig.kd, htrConfig.tempTrend]);

  // Update temperature state when MQTT messages arrive
  // useEffect(() => {
  //   if (realTemp !== null) {
  //     forceTemperatureUpdate(realTemp);
  //     addDebugLog(`MQTT Temperature update: ${realTemp.toFixed(1)}°F`);
  //   }
  // }, [realTemp]);

  const handleSetpointChange = (value: number) => {
    // Save shared setpoint for all heaters
    saveSharedSetpoint(value);
    
    setHtrConfig((prev) => {
      // Calculate if we need more heaters
      const tempDiff = Math.abs(value - prev.currentTemp);
      const needsMoreHeaters = tempDiff > TEMP_APPROACH_THRESHOLD || value > prev.setpoint;

      const newConfig = { 
        ...prev, 
        setpoint: value,
        previousSetpoint: prev.setpoint,
        pendingChange: false,
        // Reset the timer if we need more heaters
        lastSectionChange: needsMoreHeaters ? Date.now() : prev.lastSectionChange
      };

      if (value > prev.currentTemp && !prev.sections[0]) {
        newConfig.sections = [...prev.sections];
        newConfig.sections[0] = true;
      }
      
      addDebugLog(`SHARED: Setpoint changed to ${value}°F (will sync to all heaters)`);
      return newConfig;
    });
  };

  // Force UI refresh every 5 seconds if needed
  useEffect(() => {
    const interval = setInterval(() => {
      setHtrConfig(prev => {
        const now = Date.now();
        const timeSinceLastUpdate = now - prev.lastTempUpdate;
        
        if (timeSinceLastUpdate > 5000) {
          addDebugLog(`UI Refresh: Last temperature update was ${(timeSinceLastUpdate/1000).toFixed(1)}s ago`);
          return { ...prev, lastTempUpdate: now };
        }
        return prev;
      });
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Listen for shared setpoint changes from other heater instances
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === SHARED_SETPOINT_KEY && e.newValue) {
        try {
          const newSetpoint = JSON.parse(e.newValue);
          setHtrConfig(prev => ({
            ...prev,
            setpoint: newSetpoint,
            previousSetpoint: prev.setpoint
          }));
          addDebugLog(`SHARED: Setpoint synchronized to ${newSetpoint}°F from other heater`);
        } catch (error) {
          console.error('Error parsing shared setpoint:', error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Add IO-Link status polling to sync UI with actual output states
  const pollIoLinkStatus = async () => {
    try {
      addDebugLog(`IO-Link Poll: Starting status check...`);
      // Use internal Docker service name for backend communication
      const backendUrl = 'http://backend-unit2:8000';
      
      // Poll all 4 heater section outputs
      const actualStates: boolean[] = [];
      const newPortStatus = { ...ioLinkPortStatus };
      
      for (let port = 1; port <= 4; port++) {
        try {
          const url = `${backendUrl}/api/iolink/port/${port}/getdata`;
          addDebugLog(`IO-Link Poll: Checking port ${port} at ${url}`);
          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ioLinkIp })
          });
          const data = await response.json();
          
          if (data.status === 'ok' && data.response && data.response.data) {
            const rawValue = data.response.data.value; // Changed from newvalue to value
            const isActive = rawValue === '01';
            actualStates[port - 1] = isActive;
            
            // Update port status
            const portKey = `port${port}` as keyof typeof newPortStatus;
            newPortStatus[portKey] = { value: rawValue, status: 'ok' };
            
            addDebugLog(`IO-Link Status: Port ${port} = ${isActive ? 'ON' : 'OFF'} (raw: ${rawValue})`);
          } else {
            actualStates[port - 1] = false;
            const portKey = `port${port}` as keyof typeof newPortStatus;
            newPortStatus[portKey] = { value: '00', status: 'error' };
            addDebugLog(`IO-Link Status: Port ${port} = ERROR (${JSON.stringify(data)})`);
          }
        } catch (error) {
          actualStates[port - 1] = false;
          const portKey = `port${port}` as keyof typeof newPortStatus;
          newPortStatus[portKey] = { value: '00', status: 'error' };
          addDebugLog(`IO-Link Status: Port ${port} = ERROR (${error})`);
        }
      }
      
      // Update IO-Link port status
      setIoLinkPortStatus(newPortStatus);
      
      // Compare actual states with UI states and sync if different
      const uiStates = htrConfig.sections;
      let needsSync = false;
      
      addDebugLog(`IO-Link Poll: Current UI states: [${uiStates.map((s, i) => `S${i+1}:${s}`).join(', ')}]`);
      addDebugLog(`IO-Link Poll: Actual IO-Link states: [${actualStates.map((s, i) => `S${i+1}:${s}`).join(', ')}]`);
      
      for (let i = 0; i < 4; i++) {
        // In auto mode, section 1 should always be ON and not be synced from IO-Link
        if (htrConfig.isAuto && i === 0) {
          if (!uiStates[0]) {
            addDebugLog(`IO-Link Sync: Auto mode - forcing section 1 to ON`);
            needsSync = true;
            actualStates[0] = true; // Force section 1 to true in auto mode
          }
          continue; // Skip IO-Link comparison for section 1 in auto mode
        }
        
        if (actualStates[i] !== uiStates[i]) {
          addDebugLog(`IO-Link Sync: Section ${i + 1} mismatch - UI: ${uiStates[i]}, IO-Link: ${actualStates[i]}`);
          needsSync = true;
        }
      }
      
      if (needsSync) {
        addDebugLog(`IO-Link Sync: Updating UI to match actual IO-Link states: [${actualStates.map((s, i) => `S${i+1}:${s}`).join(', ')}]`);
        setHtrConfig(prev => {
          addDebugLog(`IO-Link Sync: State update triggered - old sections: [${prev.sections.map((s, i) => `S${i+1}:${s}`).join(', ')}]`);
          return {
            ...prev,
            sections: actualStates,
            lastSectionChange: Date.now() // Force React to detect the change
          };
        });
      } else {
        addDebugLog(`IO-Link Poll: No sync needed - UI and IO-Link states match`);
      }
      
    } catch (error) {
      addDebugLog(`IO-Link Status Polling Error: ${error}`);
    }
  };

  // IO-Link status polling effect
  useEffect(() => {
    const interval = setInterval(() => {
      pollIoLinkStatus();
    }, 1000); // Poll every 1 second instead of 2 seconds for faster sync

    return () => clearInterval(interval);
  }, []); // Remove htrConfig.isAuto dependency to poll all the time

  // Calculate temperature velocity with reduced logging
  // const calculateTempVelocity = (currentTemp: number): number => {
  //   const now = Date.now();
  //   const recentData = tempHistoryRef.current.filter(entry => 
  //     now - entry.timestamp <= 5000 // Data from last 5 seconds
  //   );

  //   if (recentData.length >= 2) {
  //     const oldestEntry = recentData[0];
  //     const timeDiff = (now - oldestEntry.timestamp) / 1000; // Convert to seconds
  //     const tempVelocity = (currentTemp - oldestEntry.temp) / timeDiff;
  //     return tempVelocity;
  //   }

  //   return 0;
  // };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* State Restoration Indicator */}
      {stateRestored && (
        <div className="fixed top-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 flex items-center space-x-2">
          <span className="text-sm">✅ Settings Restored</span>
          <button 
            onClick={() => {
              localStorage.removeItem(getDeviceStorageKey(deviceType));
              localStorage.removeItem(SHARED_SETPOINT_KEY);
              window.location.reload();
            }}
            className="text-xs bg-green-700 hover:bg-green-800 px-2 py-1 rounded"
            title="Clear saved settings and reload"
          >
            Clear
          </button>
        </div>
      )}
      
      {/* Device Info Modal */}
      {showDeviceInfo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-white">Device Information</h2>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-300">IO-Link IP:</span>
                <span className="font-mono text-white">{ioLinkIp}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300">Device ID:</span>
                <span className="font-mono text-white">{deviceConfig.deviceId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300">Max Temp:</span>
                <span className="text-white">{deviceConfig.maxTemp}°F</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300">Description:</span>
                <span className="text-white">{deviceConfig.description}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300">Unit:</span>
                <span className="text-white">{import.meta.env.VITE_UNIT_NAME || 'unit1'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300">Subnet:</span>
                <span className="text-white">{import.meta.env.VITE_UNIT_SUBNET || '20'}.x.x.x</span>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowDeviceInfo(false)}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PID Tuning Modal */}
      {showPidTuning && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-white">PID Tuning</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {/* Proportional Gain (Kp) */}
              <div className="bg-gray-700 rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium text-white">Proportional (Kp)</span>
                  <span className="text-lg font-bold text-white">{htrConfig.kp.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="10"
                  step="0.1"
                  value={htrConfig.kp}
                  onChange={(e) => setHtrConfig(prev => ({ ...prev, kp: Number(e.target.value) }))}
                  className="w-full"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Response speed - Higher = faster but more oscillation
                </p>
              </div>

              {/* Integral Gain (Ki) */}
              <div className="bg-gray-700 rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium text-white">Integral (Ki)</span>
                  <span className="text-lg font-bold text-white">{htrConfig.ki.toFixed(3)}</span>
                </div>
                <input
                  type="range"
                  min="0.001"
                  max="0.5"
                  step="0.001"
                  value={htrConfig.ki}
                  onChange={(e) => setHtrConfig(prev => ({ ...prev, ki: Number(e.target.value) }))}
                  className="w-full"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Eliminates steady-state error - Higher = faster but more overshoot
                </p>
              </div>

              {/* Derivative Gain (Kd) */}
              <div className="bg-gray-700 rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium text-white">Derivative (Kd)</span>
                  <span className="text-lg font-bold text-white">{htrConfig.kd.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="5"
                  step="0.1"
                  value={htrConfig.kd}
                  onChange={(e) => setHtrConfig(prev => ({ ...prev, kd: Number(e.target.value) }))}
                  className="w-full"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Damping - Higher = less oscillation but slower response
                </p>
              </div>
            </div>

            {/* Timer Size Control */}
            <div className="mb-6">
              <div className="bg-gray-700 rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium text-white">Timer Size (seconds)</span>
                  <span className="text-lg font-bold text-white">{timerSize}s</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="120"
                  step="1"
                  value={timerSize}
                  onChange={(e) => {
                    const newSize = Number(e.target.value);
                    setTimerSize(newSize);
                    saveTimerSize(deviceType, newSize);
                    console.log(`⚙️ Timer Size Updated: ${newSize}s for ${deviceType}`);
                  }}
                  className="w-full"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Time required at 100% or 0% PID before adding/removing heater sections (5-120 seconds)
                </p>
              </div>
            </div>
            
            {/* PID Presets */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-white mb-3">Quick Presets</h3>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setHtrConfig(prev => ({ ...prev, kp: 2.0, ki: 0.05, kd: 0.5 }))}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition-colors"
                >
                  Conservative
                </button>
                <button
                  onClick={() => setHtrConfig(prev => ({ ...prev, kp: 3.0, ki: 0.1, kd: 0.3 }))}
                  className="px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded text-sm transition-colors"
                >
                  Balanced
                </button>
                <button
                  onClick={() => setHtrConfig(prev => ({ ...prev, kp: 5.0, ki: 0.2, kd: 0.1 }))}
                  className="px-3 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded text-sm transition-colors"
                >
                  Aggressive
                </button>
                <button
                  onClick={() => setHtrConfig(prev => ({ ...prev, kp: 1.5, ki: 0.02, kd: 1.0 }))}
                  className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded text-sm transition-colors"
                >
                  Stable
                </button>
              </div>
            </div>

            {/* Current PID Status */}
            <div className="bg-gray-700 rounded-lg p-4 mb-6">
              <h3 className="text-lg font-semibold text-white mb-3">Current PID Status</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-400">Control Mode:</span>
                  <span className="text-white ml-2">{htrConfig.controlMode}</span>
                </div>
                <div>
                  <span className="text-gray-400">Current Output:</span>
                  <span className="text-white ml-2">{htrConfig.output.toFixed(1)}%</span>
                </div>
                <div>
                  <span className="text-gray-400">Temperature Error:</span>
                  <span className="text-white ml-2">{(htrConfig.setpoint - htrConfig.currentTemp).toFixed(1)}°F</span>
                </div>
                <div>
                  <span className="text-gray-400">Pulse State:</span>
                  <span className="text-white ml-2">{htrConfig.pulseState ? 'ON' : 'OFF'}</span>
                </div>
              </div>
            </div>

            {/* Control Mode Selection */}
            <div className="bg-gray-700 rounded-lg p-4 mb-6">
              <h3 className="text-lg font-semibold text-white mb-3">Control Algorithm</h3>
              <div className="space-y-3">
                <div className="flex items-center">
                  <input
                    type="radio"
                    id="accel-control"
                    name="control-mode"
                    checked={true}
                    className="mr-3"
                    disabled
                  />
                  <label htmlFor="accel-control" className="text-white">
                    <span className="font-medium">Acceleration Control (Active)</span>
                    <p className="text-sm text-gray-400">
                      Uses temperature acceleration and velocity for precise control
                    </p>
                  </label>
                </div>
                <div className="flex items-center">
                  <input
                    type="radio"
                    id="stepped-control"
                    name="control-mode"
                    checked={false}
                    className="mr-3"
                    disabled
                  />
                  <label htmlFor="stepped-control" className="text-gray-500">
                    <span className="font-medium">Stepped Control (Disabled)</span>
                    <p className="text-sm text-gray-500">
                      20% steps (20-100%), 10% steps (10-20%), 5% steps (5-10%), 1% steps (1-5%)
                    </p>
                  </label>
                </div>
                <div className="flex items-center">
                  <input
                    type="radio"
                    id="pid-control"
                    name="control-mode"
                    checked={false}
                    className="mr-3"
                    disabled
                  />
                  <label htmlFor="pid-control" className="text-gray-500">
                    <span className="font-medium">PID Control (Disabled)</span>
                    <p className="text-sm text-gray-500">
                      Continuous proportional control with anti-windup
                    </p>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setShowPidTuning(false)}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Control Mode Switch with Timer */}
      <div className="bg-gray-800 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Control Mode</h2>
            <p className="text-sm text-gray-400">
              {htrConfig.isAuto ? 'Automatic section control' : 'Manual section control'}
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <span className="mr-2">Manual</span>
              <Switch
                checked={htrConfig.isAuto}
                onChange={handleAutoToggle}
                className="mx-2"
              />
              <span className="ml-2">Auto</span>
            </div>
            {htrConfig.isAuto && (
              <CircularTimer
                timeLeft={timeUntilChange}
                totalTime={timerSize * 1000}
              />
            )}
          </div>
        </div>
      </div>

      {/* Heater Sections Control */}
      <div className="bg-gray-800 rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Heater Sections</h2>
        <div className="grid grid-cols-2 gap-4">
          {htrConfig.sections.map((isEnabled, index) => (
            <div
              key={index}
              className={`bg-gray-700 rounded-lg p-4 flex items-center justify-between transition-all duration-300 ${
                htrConfig.isAuto && index > 0 ? 'opacity-75' : ''
              } ${
                isEnabled ? 'bg-gray-600' : ''
              }`}
            >
              <div>
                <h3 className="text-lg font-semibold text-white flex items-center">
                  Section {index + 1}
                </h3>
                <p className="text-sm text-gray-400">
                  Digital Output {index + 1}
                  {index === 0 && " - Main Control"}
                </p>
              </div>
              <Switch
                checked={isEnabled}
                onChange={() => handleSectionToggle(index)}
                disabled={htrConfig.isAuto}
                className={`ml-4 ${
                  isEnabled ? 'scale-110' : ''
                } ${
                  htrConfig.isAuto && isEnabled ? 'opacity-80' : ''
                }`}
              />
            </div>
          ))}
        </div>
      </div>
      
      {/* Temperature Control */}
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold">Temperature Control</h2>
            <p className="text-sm text-gray-400 mt-1">
              Mode: {htrConfig.controlMode === 'FULL_POWER' ? 'Full Power' : 'PID Control'}
            </p>
            <p className="text-sm text-gray-400">
              Active Sections: {htrConfig.sections.filter(Boolean).length} of 4
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Temperature Gauge */}
          <div className="bg-gray-700 rounded-lg p-4">
            <div className="flex justify-between items-center mb-2">
              <span>Current Temperature</span>
              <div className="text-right">
                <span className="text-2xl font-bold">
                  {deviceType === 'HTR-B' && !deviceConfig.inputDeviceId ? 
                    '0.0' : 
                    htrConfig.currentTemp.toFixed(1)}°F
                </span>
                <div className="text-sm text-gray-400">
                  Last updated: {new Date(htrConfig.lastTempUpdate).toLocaleTimeString()}
                </div>
                <div className={`text-sm ${
                  htrConfig.tempTrend === 'rising' ? 'text-green-400' :
                  htrConfig.tempTrend === 'falling' ? 'text-red-400' :
                  'text-gray-400'
                }`}>
                  Trend: {htrConfig.tempTrend}
                </div>
              </div>
            </div>
            <div className="h-4 bg-gray-600 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-500"
                style={{ 
                  width: `${((deviceType === 'HTR-B' && !deviceConfig.inputDeviceId ? 
                    0 : 
                    htrConfig.currentTemp) / deviceConfig.maxTemp) * 100}%` 
                }}
              />
            </div>
          </div>

          {/* Shared Setpoint Control */}
          <div className="bg-gray-700 rounded-lg p-4">
            <div className="flex justify-between items-center mb-2">
              <div>
                <span>Shared Setpoint</span>
                <p className="text-xs text-blue-400">Same for HTR-A & HTR-B</p>
              </div>
              <span className="text-2xl font-bold">{htrConfig.setpoint}°F</span>
            </div>
            <input
              type="range"
              min="0"
              max={MAX_TEMP}
              value={htrConfig.setpoint}
              onChange={(e) => handleSetpointChange(Number(e.target.value))}
              className="w-full"
            />
          </div>

          {/* Output Indicator */}
          <div className={`bg-gray-700 rounded-lg p-4 col-span-2 ${!htrConfig.sections[0] ? 'opacity-50' : ''}`}>
            <div className="flex justify-between items-center mb-2">
              <div>
                <span 
                  className="cursor-pointer hover:text-blue-400 transition-colors"
                  onClick={() => setShowPidTuning(true)}
                  title="Click to open PID tuning"
                >
                  PID Output
                </span>
                <p className="text-sm text-gray-400">Port 5 - PID Output</p>
              </div>
              <div className="flex items-center">
                <BoltIcon
                  className={`h-6 w-6 mr-2 transition-colors ${
                    htrConfig.pulseState ? 'text-primary' : 'text-gray-500'
                  }`}
                />
                <span className="text-2xl font-bold">
                  {htrConfig.output.toFixed(1)}%
                </span>
              </div>
            </div>
            <div className="h-4 bg-gray-600 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  htrConfig.pulseState ? 'bg-primary' : 'bg-primary/30'
                }`}
                style={{ width: `${htrConfig.output}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Debug Log */}
      <div className="mt-6 bg-gray-800 rounded-lg p-4">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-lg font-semibold text-white">System Status</h3>
          <button
            onClick={() => setShowSystemStatus(!showSystemStatus)}
            className="text-gray-400 hover:text-gray-300 transition-colors"
            title={showSystemStatus ? 'Hide System Status' : 'Show System Status'}
          >
            {showSystemStatus ? '▼' : '▶'}
          </button>
        </div>
        {showSystemStatus && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-700 rounded p-2">
                <p className="text-sm font-semibold mb-1">Temperature Status</p>
                <p className="text-sm text-gray-300">Current: {htrConfig.currentTemp.toFixed(1)}°F</p>
                <p className="text-sm text-gray-300">Trend: {htrConfig.tempTrend}</p>
                <p className="text-sm text-gray-300">Last Update: {new Date(htrConfig.lastTempUpdate).toLocaleTimeString()}</p>
              </div>
              <div className="bg-gray-700 rounded p-2">
                <p className="text-sm font-semibold mb-1">Heater Status</p>
                <p className="text-sm text-gray-300">Active Sections: {htrConfig.sections.filter(Boolean).length}/4</p>
                <p className="text-sm text-gray-300">Control Mode: {htrConfig.controlMode}</p>
                <p className="text-sm text-gray-300">Output Power: {htrConfig.output.toFixed(1)}%</p>
              </div>
            </div>
            
            {/* IO-Link Port Status - Technical Information */}
            <div>
              <p className="text-sm font-semibold mb-2 text-gray-300">IO-Link Port Status</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {[1, 2, 3, 4].map((portNum) => {
                  const portKey = `port${portNum}` as keyof typeof ioLinkPortStatus;
                  const portData = ioLinkPortStatus[portKey];
                  const isActive = portData.value === '01';
                  
                  return (
                    <div key={portNum} className="bg-gray-600 rounded-lg p-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium">Port {portNum}</span>
                        <div className={`w-2 h-2 rounded-full ${
                          portData.status === 'ok' ? 
                            (isActive ? 'bg-green-500' : 'bg-red-500') : 
                            'bg-gray-500'
                        }`}></div>
                      </div>
                      <div className="text-center">
                        <div className={`text-sm font-mono font-bold ${
                          isActive ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {portData.value}
                        </div>
                        <div className="text-xs text-gray-400">
                          {portData.status === 'ok' ? 
                            (isActive ? 'ON' : 'OFF') : 
                            'ERR'
                          }
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
        
        {/* Debug Log Section */}
        <div className="space-y-1 mt-4">
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center space-x-2">
              <p className="text-sm text-gray-400 font-semibold">Debug Log</p>
              <button
                onClick={() => setShowDebugLog(!showDebugLog)}
                className="text-gray-500 hover:text-gray-300 transition-colors text-xs"
                title={showDebugLog ? 'Hide Debug Log' : 'Show Debug Log'}
              >
                {showDebugLog ? '▼' : '▶'}
              </button>
            </div>
            {showDebugLog && (
              <button
                onClick={() => setDebugLog([])}
                className="text-xs text-gray-500 hover:text-gray-300 transition-colors px-2 py-1 rounded"
                title="Clear debug log"
              >
                Clear
              </button>
            )}
          </div>
          {showDebugLog && (
            <div className="max-h-96 overflow-y-auto transition-all duration-300">
              {debugLog.length === 0 ? (
                <p className="text-sm text-gray-500 italic">No debug messages</p>
              ) : (
                debugLog.map((log, index) => (
                  <p key={index} className={`text-sm ${
                    log.includes('Error') ? 'text-red-400' : 
                    log.includes('Success') ? 'text-green-400' : 
                    'text-gray-400'
                  } whitespace-pre-wrap`}>{log}</p>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HtrDeviceDetail; 