import { useState, useEffect, useRef } from 'react';
import { Switch } from '@mui/material';
import { BoltIcon } from '@heroicons/react/24/solid';
import mqtt from 'mqtt';
import type { MqttClient, IClientOptions } from 'mqtt';

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

interface HtrDevice {
  id: string;
  name: string;
  ipAddress: string;
  htrSystem: string;
  ioLinkIp: string;
}

// Device-specific configurations
const DEVICE_CONFIGS = {
  'HTR-A': {
    deviceId: '00-02-01-6D-55-8A',
    maxTemp: 1200,
    name: 'HTR-A',
    description: 'Primary Heater Control',
    inputDeviceId: null // Uses own temperature sensor
  },
  'HTR-B': {
    deviceId: '00-02-01-6D-55-86',
    maxTemp: 800, // Different max temperature for HTR-B
    name: 'HTR-B',
    description: 'Secondary Heater Control',
    inputDeviceId: '00-02-01-6d-55-86' // External temperature sensor
  }
};

// Constants
const MAX_TEMP = 1200; // Maximum temperature in Fahrenheit
const SECTION_CHANGE_INTERVAL = 15000; // 15 seconds for testing
const TEMP_APPROACH_THRESHOLD = 20; // Temperature difference threshold for starting removal
const STORAGE_KEY = 'htr_device_state_';

// MQTT Configuration - using WebSocket for persistent connection
const MQTT_CONFIG = {
  host: 'localhost',  // Use localhost directly since we're running in dev mode
  port: 9001,  // WebSocket port
  clientId: `htr_control_${Math.random().toString(16).substring(2, 8)}`
};

const MQTT_OPTIONS: IClientOptions = {
  clientId: MQTT_CONFIG.clientId,
  clean: true,
  reconnectPeriod: 5000,
  connectTimeout: 5000,
  rejectUnauthorized: false
};

// Static MQTT client to maintain connection across component unmounts
let staticMqttClient: MqttClient | null = null;

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
const OUTPUT_STEPS = [0, 2, 5, 9, 12, 15, 18, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100];

// Helper function to save state to localStorage
const saveState = (id: string, state: Partial<HtrConfig>) => {
  try {
    const key = STORAGE_KEY + id;
    localStorage.setItem(key, JSON.stringify(state));
  } catch (error) {
    console.error('Error saving state:', error);
  }
};

// Helper function to load state from localStorage
const loadState = (id: string): Partial<HtrConfig> | null => {
  try {
    const key = STORAGE_KEY + id;
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : null;
  } catch (error) {
    console.error('Error loading state:', error);
    return null;
  }
};

const CircularTimer: React.FC<{
  timeLeft: number;
  totalTime: number;
  action: 'add' | 'remove' | 'none';
}> = ({ timeLeft, totalTime, action }) => {
  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  const progress = (timeLeft / totalTime) * circumference;
  
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
        {/* Progress circle */}
        <circle
          cx="28"
          cy="28"
          r={radius}
          stroke="currentColor"
          strokeWidth="4"
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          className={`${
            action === 'add' ? 'text-green-500' : 
            action === 'remove' ? 'text-red-500' : 
            'text-gray-500'
          } transition-all duration-500`}
        />
      </svg>
      <span className="absolute text-sm">
        {Math.ceil(timeLeft / 1000)}s
      </span>
    </div>
  );
};

const HtrDeviceDetail: React.FC<HtrDeviceDetailProps> = ({ deviceType, ioLinkIp }) => {
  const deviceConfig = DEVICE_CONFIGS[deviceType as keyof typeof DEVICE_CONFIGS];
  
  const [device] = useState<HtrDevice>({
    id: deviceType,
    name: deviceConfig.name,
    ipAddress: ioLinkIp,
    htrSystem: deviceType,
    ioLinkIp: ioLinkIp
  });

  const [mqttConnected, setMqttConnected] = useState(false);
  const [timeUntilChange, setTimeUntilChange] = useState(SECTION_CHANGE_INTERVAL);
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const [realTemp, setRealTemp] = useState<number | null>(null);

  const addDebugLog = (message: string) => {
    console.log(message); // For browser console
    const truncated = message.length > 100 ? message.substring(0, 97) + '...' : message;
    setDebugLog(prev => [...prev.slice(-9), truncated]); // Keep last 10 messages
  };

  // Hex conversion function
  const convertHexToFahrenheit = (hexTemp: string): number => {
    try {
      // Remove any '0x' prefix if present
      const cleanHex = hexTemp.replace('0x', '');
      // Convert hex to decimal
      const decimalValue = parseInt(cleanHex, 16);
      // Apply scaling factor (10:1) and convert to Fahrenheit
      const fahrenheitTemp = decimalValue / 10;
      
      // Debug the conversion
      addDebugLog(`Hex conversion: ${hexTemp} -> ${decimalValue} -> ${fahrenheitTemp}°F`);
      
      return Number(fahrenheitTemp.toFixed(1));
    } catch (error) {
      addDebugLog(`Hex conversion error: ${hexTemp}`);
      return NaN;
    }
  };
  
  // Initialize MQTT connection if not already connected
  useEffect(() => {
    const setupMqtt = () => {
      if (!staticMqttClient) {
        addDebugLog('MQTT: Setting up new connection...');
        const wsUrl = `ws://${MQTT_CONFIG.host}:${MQTT_CONFIG.port}`;
        addDebugLog(`MQTT: Connecting to ${wsUrl}`);
        
        const client = mqtt.connect(wsUrl, {
          ...MQTT_OPTIONS,
          clientId: `${MQTT_CONFIG.clientId}_${deviceType}_${Date.now()}`, // Ensure unique client ID
          keepalive: 30, // Reduce keepalive interval
          reconnectPeriod: 3000 // Faster reconnection
        });

        client.on('connect', () => {
          setMqttConnected(true);
          addDebugLog(`MQTT: Connected to broker for ${deviceType}`);
          
          // Only subscribe to raw hex temperature data
          client.subscribe('instrument/htr_a', { qos: 1 });
          addDebugLog(`MQTT: Subscribed to topic: instrument/htr_a`);
        });

        client.on('error', (error) => {
          addDebugLog(`MQTT Error: ${error.message}`);
        });

        client.on('reconnect', () => {
          addDebugLog('MQTT: Attempting to reconnect...');
        });

        client.on('offline', () => {
          addDebugLog('MQTT: Connection offline');
          setMqttConnected(false);
        });

        client.on('close', () => {
          addDebugLog('MQTT: Connection closed');
          setMqttConnected(false);
        });

        client.on('message', (topic, message) => {
          try {
            const data = JSON.parse(message.toString());
            
            // Only process raw hex temperature data
            if (topic === 'instrument/htr_a' && data.data?.payload?.['/iolinkmaster/port[6]/iolinkdevice/pdin']?.data) {
              const hexTemp = data.data.payload['/iolinkmaster/port[6]/iolinkdevice/pdin'].data;
              const tempF = convertHexToFahrenheit(hexTemp);
              if (!isNaN(tempF)) {
                setRealTemp(tempF);
                addDebugLog(`Temperature update: ${hexTemp} -> ${tempF}°F`);
              }
            }
          } catch (error) {
            addDebugLog(`Error processing message: ${error}`);
          }
        });

        staticMqttClient = client;
      }
    };

    setupMqtt();

    // Cleanup function
    return () => {
      if (staticMqttClient) {
        addDebugLog('MQTT: Cleaning up connection...');
        staticMqttClient.end();
        staticMqttClient = null;
      }
    };
  }, [deviceType, deviceConfig]);

  // Add a force update function that always updates the state
  const forceTemperatureUpdate = (newTemp: number) => {
    if (newTemp > 0) {
      setHtrConfig(prev => {
        const trend: 'rising' | 'falling' | 'stable' = 
          newTemp > prev.currentTemp ? 'rising' : 
          newTemp < prev.currentTemp ? 'falling' : 
          'stable';
        
        // Force state update with new temperature
        const newState: HtrConfig = {
          ...prev,
          currentTemp: newTemp,
          lastTemp: prev.currentTemp,
          tempTrend: trend,
          lastTempUpdate: Date.now()
        };
        
        // Log the state change
        addDebugLog(`State force-updated: ${prev.currentTemp}°F -> ${newTemp}°F (${trend})`);
        
        return newState;
      });
    }
  };

  // Initialize state with saved data and device-specific config
  const [htrConfig, setHtrConfig] = useState<HtrConfig>(() => {
    const savedState = device.id ? loadState(device.id) : null;
    return {
      setpoint: savedState?.setpoint ?? 0,
      currentTemp: savedState?.currentTemp ?? 0,
      output: savedState?.output ?? 0,
      kp: 1,
      ki: 0.1,
      kd: 0.01,
      pulseState: false,
      controlMode: 'FULL_POWER',
      sections: savedState?.sections ?? [false, false, false, false],
      isAuto: savedState?.isAuto ?? false,
      lastSectionChange: Date.now(),
      nextAction: 'none',
      previousSetpoint: savedState?.setpoint ?? 0,
      lastActionType: 'none',
      pendingChange: false,
      lowPowerStartTime: null,
      lastTemp: savedState?.currentTemp ?? 0,
      tempTrend: 'stable',
      lastTempUpdate: Date.now()
    };
  });

  // Save state changes to localStorage
  useEffect(() => {
    if (device.id) {
      saveState(device.id, {
        setpoint: htrConfig.setpoint,
        currentTemp: htrConfig.currentTemp,
        output: htrConfig.output,
        sections: htrConfig.sections,
        isAuto: htrConfig.isAuto
      });
    }
  }, [device.id, htrConfig.setpoint, htrConfig.currentTemp, htrConfig.output, htrConfig.sections, htrConfig.isAuto]);

  // Add this helper function for HTTP POST to IO-Link master
  const sendIoLinkHttpCommand = async (portNum: number, state: boolean) => {
    // Relay to backend API instead of direct fetch to IO-Link master
    const url = `/api/iolink/port/${portNum}/setdata`;
    const payload = {
      state,
      ioLinkIp
    };
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
    // Extract port number from string like 'port[1]/iolinkdevice/pdout'
    const match = port.match(/port\[(\d+)\]/);
    if (match) {
      const portNum = parseInt(match[1], 10);
      if (portNum >= 1 && portNum <= 5) {
        sendIoLinkHttpCommand(portNum, state);
        return;
      }
    }
    // fallback to MQTT for other ports or if parsing fails
    if (!staticMqttClient || !mqttConnected) {
      addDebugLog(`MQTT Error: Cannot send command - not connected`);
      return;
    }
    const topic = `${deviceConfig.deviceId}/iolinkmaster/${port}`;
    const message = state ? '1' : '0';
    addDebugLog(`Sending command: ${topic} -> ${message}`);
    staticMqttClient.publish(topic, message, { qos: 1 }, (error?: Error) => {
      if (error) {
        addDebugLog(`MQTT Error: Failed to publish to ${topic} - ${error.message}`);
      } else {
        addDebugLog(`MQTT Success: Published ${message} to ${topic}`);
      }
    });
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
    if (htrConfig.isAuto && sectionIndex > 0) return;

    setHtrConfig((prev) => {
      const newSections = [...prev.sections];
      newSections[sectionIndex] = !newSections[sectionIndex];
      
      // Send command to IO-Link using correct port mapping
      const portMap = [
        IO_LINK_PORTS.SECTION_1,
        IO_LINK_PORTS.SECTION_2,
        IO_LINK_PORTS.SECTION_3,
        IO_LINK_PORTS.SECTION_4
      ];

      // Send the command for the specific section
      sendIoLinkCommand(portMap[sectionIndex], newSections[sectionIndex]);
      
      addDebugLog(`Section ${sectionIndex + 1} ${newSections[sectionIndex] ? 'enabled' : 'disabled'}`);
      
      if (sectionIndex === 0 && !prev.sections[0] && newSections[0]) {
        return {
          ...prev,
          sections: newSections,
          lastSectionChange: Date.now(),
          pendingChange: false
        };
      }
      
      return { ...prev, sections: newSections };
    });
  };

  // Modified determineNextAction to be more precise about timing
  const determineNextAction = (config: HtrConfig): 'add' | 'remove' | 'none' => {
    if (config.pendingChange) {
      return 'none';
    }

    const activeSections = config.sections.filter(Boolean).length;
    const tempDifference = config.setpoint - config.currentTemp;
    const absoluteTempDiff = Math.abs(tempDifference);
    const tempRising = config.tempTrend === 'rising';

    // Don't take action if first section isn't on
    if (!config.sections[0]) {
      addDebugLog('Auto Control: First section not active, no action needed');
      return 'none';
    }

    // Temperature is below setpoint - check if we need more heaters
    if (tempDifference > 0) { // Below setpoint
      const neededSections = Math.min(4, Math.ceil(absoluteTempDiff / 20)); // Rough estimate of heaters needed
      
      if (activeSections < neededSections) {
        addDebugLog(`Auto Control: Temperature ${config.currentTemp}°F is below setpoint ${config.setpoint}°F by ${absoluteTempDiff}°F, adding section`);
        return 'add';
      }
    }
    // Temperature is approaching or above setpoint - check if we can remove heaters
    else if (tempDifference < -5) { // Above setpoint by 5°F
      if (activeSections > 1 && (tempRising || absoluteTempDiff > 10)) {
        addDebugLog(`Auto Control: Temperature ${config.currentTemp}°F is above setpoint ${config.setpoint}°F by ${absoluteTempDiff}°F, removing section`);
        return 'remove';
      }
    }

    addDebugLog(`Auto Control: No action needed. Active sections: ${activeSections}, Temp diff: ${tempDifference}°F`);
    return 'none';
  };

  // Auto mode section management
  useEffect(() => {
    if (!htrConfig.isAuto || !htrConfig.sections[0]) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const timeSinceLastChange = now - htrConfig.lastSectionChange;
      
      setHtrConfig(prev => {
        const activeSections = prev.sections.filter(Boolean).length;
        const nextAction = determineNextAction(prev);

        // Start countdown if we have a new action
        if (!prev.pendingChange && nextAction !== 'none') {
          addDebugLog(`Auto Control: Starting countdown for ${nextAction} section`);
          return {
            ...prev,
            nextAction,
            pendingChange: true,
            lastSectionChange: now
          };
        }

        // Execute change after countdown
        if (prev.pendingChange && timeSinceLastChange >= SECTION_CHANGE_INTERVAL) {
          const newSections = [...prev.sections];
          let changed = false;

          // In auto mode section management, update port mapping
          const portMap = [
            IO_LINK_PORTS.SECTION_1,
            IO_LINK_PORTS.SECTION_2,
            IO_LINK_PORTS.SECTION_3,
            IO_LINK_PORTS.SECTION_4
          ];

          if (nextAction === 'add' && activeSections < 4) {
            // Find next inactive section to add
            for (let i = 0; i < newSections.length; i++) {
              if (!newSections[i]) {
                newSections[i] = true;
                changed = true;
                addDebugLog(`Auto Control: Adding section ${i + 1}`);
                // Send command to IO-Link using correct port mapping
                sendIoLinkCommand(portMap[i], true);
                break;
              }
            }
          } else if (nextAction === 'remove' && activeSections > 1) {
            // Remove last active section
            for (let i = newSections.length - 1; i > 0; i--) {
              if (newSections[i]) {
                newSections[i] = false;
                changed = true;
                addDebugLog(`Auto Control: Removing section ${i + 1}`);
                // Send command to IO-Link using correct port mapping
                sendIoLinkCommand(portMap[i], false);
                break;
              }
            }
          }

          if (changed) {
            // After change, immediately check if we need another action
            const tempDiff = Math.abs(prev.setpoint - prev.currentTemp);
            const needsMoreAction = nextAction === 'add' ? 
              (tempDiff > 20 && activeSections + 1 < 4) : 
              (tempDiff < 5 && activeSections - 1 > 1);

            addDebugLog(`Auto Control: Change complete. Needs more action: ${needsMoreAction}`);
            
            return {
              ...prev,
              sections: newSections,
              pendingChange: false,
              lastSectionChange: needsMoreAction ? now : prev.lastSectionChange,
              nextAction: needsMoreAction ? nextAction : 'none'
            };
          }
        }

        return prev;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [htrConfig.isAuto, htrConfig.sections[0]]);

  // Timer update effect
  useEffect(() => {
    if (!htrConfig.isAuto || !htrConfig.sections[0]) {
      setTimeUntilChange(SECTION_CHANGE_INTERVAL);
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      const timeSinceLastChange = now - htrConfig.lastSectionChange;
      const timeLeft = Math.max(0, SECTION_CHANGE_INTERVAL - timeSinceLastChange);
      
      setTimeUntilChange(timeLeft);

      // Update action status when timer completes
      if (timeLeft === 0 && htrConfig.pendingChange) {
        const nextAction = determineNextAction(htrConfig);
        if (nextAction !== 'none') {
          addDebugLog(`Next action needed: ${nextAction}`);
        }
      }
    }, 100);

    return () => clearInterval(interval);
  }, [htrConfig.isAuto, htrConfig.sections[0], htrConfig.lastSectionChange, htrConfig.pendingChange]);

  // PID state refs for integral and lastError
  const integralRef = useRef(0);
  const lastErrorRef = useRef(0);

  // Remove temperature simulation
  useEffect(() => {
    if (!htrConfig.sections[0]) return;

    let pulseTimer: NodeJS.Timeout;
    const interval = setInterval(() => {
      setHtrConfig((prev) => {
        // Smoother transition: start PID at 85% of setpoint
        const setpointThreshold = prev.setpoint * 0.85;
        const isNearSetpoint = prev.currentTemp >= setpointThreshold;
        const newControlMode = isNearSetpoint ? 'PID' : 'FULL_POWER';

        let newOutput: number;
        let error = prev.setpoint - prev.currentTemp;
        if (newControlMode === 'FULL_POWER') {
          newOutput = 100;
          // Reset PID state when in full power
          integralRef.current = 0;
          lastErrorRef.current = 0;
        } else {
          // PID calculation
          const dt = 1; // seconds (interval is 1000ms)
          integralRef.current += error * dt;
          const derivative = (error - lastErrorRef.current) / dt;
          let pidOutput = prev.kp * error + prev.ki * integralRef.current + prev.kd * derivative;
          pidOutput = Math.max(0, Math.min(100, pidOutput));

          // Stepped/cascade output logic
          let steppedOutput = OUTPUT_STEPS.reduce((prevStep, currStep) =>
            Math.abs(currStep - pidOutput) < Math.abs(prevStep - pidOutput) ? currStep : prevStep
          );

          // Force a minimum output if heating and not near setpoint
          if (steppedOutput > 0 && steppedOutput < 15 && error > 2) {
            steppedOutput = 15;
          }

          // As you get close to setpoint, allow only smaller steps
          if (Math.abs(error) < 5) {
            if (steppedOutput > 9) steppedOutput = 9;
            if (Math.abs(error) < 2 && steppedOutput > 5) steppedOutput = 5;
            if (Math.abs(error) < 1 && steppedOutput > 2) steppedOutput = 2;
            if (Math.abs(error) < 0.5) steppedOutput = 0;
          }

          newOutput = steppedOutput;
          lastErrorRef.current = error;
        }

        // Handle pulse modulation
        if (newOutput > 0) {
          const pulseOnTime = Math.max(MIN_PULSE_WIDTH, (newOutput / 100) * PULSE_PERIOD);
          const pulseOffTime = PULSE_PERIOD - pulseOnTime;
          // Unique debug log for backend relay confirmation
          addDebugLog(`[UNIQUE] PID Pulse (backend relay): ON for ${pulseOnTime}ms, Output: ${newOutput}%`);
          // Send ON pulse
          sendIoLinkHttpCommand(5, true);
          if (pulseTimer) clearTimeout(pulseTimer);
          // Schedule OFF pulse
          if (pulseOffTime > 0) {
            pulseTimer = setTimeout(() => {
              addDebugLog(`[UNIQUE] PID Pulse (backend relay): OFF after ${pulseOnTime}ms`);
              sendIoLinkHttpCommand(5, false);
            }, pulseOnTime);
          }
        } else {
          // Output is 0, ensure port 5 is OFF
          addDebugLog(`[UNIQUE] PID Pulse (backend relay): Output 0, port 5 OFF`);
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
  }, [htrConfig.sections[0], htrConfig.setpoint, htrConfig.kp, htrConfig.ki, htrConfig.kd]);

  // Update temperature state when MQTT messages arrive
  useEffect(() => {
    if (realTemp !== null) {
      forceTemperatureUpdate(realTemp);
      addDebugLog(`MQTT Temperature update: ${realTemp.toFixed(1)}°F`);
    }
  }, [realTemp]);

  const handleSetpointChange = (value: number) => {
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

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{deviceConfig.name}</h1>
        <p className="text-gray-400">IO-Link IP: {ioLinkIp}</p>
        <p className="text-gray-400">Device ID: {deviceConfig.deviceId}</p>
        <p className="text-emerald-400">{deviceConfig.description}</p>
        {deviceConfig.inputDeviceId && (
          <p className="text-gray-400">Temperature Input: {deviceConfig.inputDeviceId}</p>
        )}
        <div className={`text-sm ${mqttConnected ? 'text-green-500' : 'text-red-500'}`}>
          MQTT Status: {mqttConnected ? 'Connected' : 'Disconnected'} ({MQTT_CONFIG.host}:{MQTT_CONFIG.port})
        </div>
      </div>

      {/* Control Mode Switch with Timer */}
      <div className="bg-gray-800 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Control Mode</h2>
            <p className="text-sm text-gray-400">
              {htrConfig.isAuto ? 'Automatic section control' : 'Manual section control'}
            </p>
            {htrConfig.isAuto && htrConfig.sections[0] && htrConfig.nextAction !== 'none' && (
              <p className="text-sm mt-1">
                {htrConfig.nextAction === 'add' ? 'Adding' : 'Removing'} next heater in:
              </p>
            )}
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
            {htrConfig.isAuto && htrConfig.sections[0] && (
              <CircularTimer
                timeLeft={timeUntilChange}
                totalTime={SECTION_CHANGE_INTERVAL}
                action={htrConfig.nextAction}
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
              className={`bg-gray-700 rounded-lg p-4 flex items-center justify-between ${
                htrConfig.isAuto && index > 0 ? 'opacity-50' : ''
              }`}
            >
              <div>
                <h3 className="text-lg">Section {index + 1}</h3>
                <p className="text-sm text-gray-400">
                  Digital Output {index + 1}
                  {index === 0 && " - Main Control"}
                </p>
              </div>
              <Switch
                checked={isEnabled}
                onChange={() => handleSectionToggle(index)}
                disabled={htrConfig.isAuto && index > 0}
                className="ml-4"
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

          {/* Setpoint Control */}
          <div className="bg-gray-700 rounded-lg p-4">
            <div className="flex justify-between items-center mb-2">
              <span>Setpoint</span>
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
                <span>Output Power</span>
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
        <h3 className="text-lg font-semibold mb-2">System Status</h3>
        <div className="grid grid-cols-2 gap-4 mb-4">
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
        <div className="space-y-1 max-h-60 overflow-y-auto">
          <p className="text-sm text-gray-400 font-semibold">Debug Log:</p>
          {debugLog.map((log, index) => (
            <p key={index} className={`text-sm ${
              log.includes('Error') ? 'text-red-400' : 
              log.includes('Success') ? 'text-green-400' : 
              'text-gray-400'
            } whitespace-pre-wrap`}>{log}</p>
          ))}
        </div>
      </div>

      {/* Temperature Display */}
      <div className="p-4">
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-lg font-semibold mb-2">Raw Temperature</h3>
          <div className="text-3xl font-bold text-blue-600">
            {realTemp !== null ? `${realTemp.toFixed(1)}°F` : 'N/A'}
          </div>
          <div className="text-sm text-gray-500">
            {realTemp !== null ? `${((realTemp - 32) * 5/9).toFixed(1)}°C` : 'N/A'}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HtrDeviceDetail; 