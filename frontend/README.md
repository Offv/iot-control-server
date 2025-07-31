# IoT Dual Heater Control System - Frontend

Advanced React frontend for industrial dual heater control with real-time temperature monitoring, sophisticated PID control, and state persistence.

## 🔥 Overview

This frontend provides a modern, responsive interface for controlling industrial heating units with:
- **Dual Heater Control**: Side-by-side HTR-A and HTR-B interfaces
- **Real-time Temperature Monitoring**: Live MQTT data visualization
- **Advanced PID Control**: Interactive tuning with timer configuration
- **State Persistence**: All settings survive page refreshes
- **Responsive Design**: Works on desktop, tablet, and mobile devices

## 🏗️ Architecture

### Technology Stack

- **React 18**: Modern React with hooks and functional components
- **TypeScript**: Full type safety for robust development
- **Vite**: Fast development server with hot module replacement
- **Tailwind CSS**: Utility-first CSS framework for rapid styling
- **MQTT.js**: Real-time communication with MQTT broker
- **React Router DOM**: Client-side routing for navigation

### Component Structure

```
src/
├── components/           # Reusable UI components
│   └── Layout.tsx       # Main layout with navigation
├── pages/               # Page-level components
│   ├── DualHtrControl.tsx     # Main dual heater interface
│   ├── HtrDeviceDetail.tsx    # Individual heater control
│   ├── SimpleHtrControl.tsx   # Simplified control interface
│   └── SimpleTest.tsx         # Testing interface
├── App.tsx              # Main application component
├── main.tsx            # Application entry point
├── App.css             # Global styles
└── index.css           # Base styles and Tailwind imports
```

## 🎛️ Key Features

### Dual Heater Control (`DualHtrControl.tsx`)

The main interface displaying both HTR-A and HTR-B side-by-side:

```typescript
// Key features:
- Unified temperature display (shared sensor)
- Individual section controls per heater
- Real-time PID output visualization
- Auto/Manual mode switching
- Setpoint control with shared value
```

### Individual Heater Control (`HtrDeviceDetail.tsx`)

Comprehensive control interface for each heater unit:

#### State Management
```typescript
interface PersistentState {
  isAuto: boolean;           // Auto/Manual mode
  setpoint: number;          // Temperature setpoint
  sections: boolean[];       // Heater section states
  kp: number;               // PID proportional gain
  ki: number;               // PID integral gain
  kd: number;               // PID derivative gain
  controlMode: string;      // Control mode selection
}
```

#### Advanced PID Control
```typescript
const calculatePIDOutput = (currentTemp: number, setpoint: number) => {
  const error = setpoint - currentTemp;
  const proportional = kp * error;
  const integral = ki * errorIntegral;
  const derivative = kd * (error - lastError);
  return Math.max(0, Math.min(100, proportional + integral + derivative));
};
```

#### Section Control Logic
```typescript
// Auto mode section management
if (pidOutput >= 100 && timerDuration >= timerSize) {
  // Add next section (0→1→2→3)
  addNextSection();
} else if (pidOutput <= 0 && timerDuration >= timerSize) {
  // Remove last section (3→2→1→0, protect section 0)
  removeLastSection();
}
```

### State Persistence System

#### Local Storage Integration
```typescript
// Save state to localStorage
const savePersistentState = (deviceId: string, state: PersistentState) => {
  const key = getDeviceStorageKey(deviceId);
  localStorage.setItem(key, JSON.stringify(state));
};

// Load state from localStorage
const loadPersistentState = (deviceId: string): PersistentState | null => {
  const key = getDeviceStorageKey(deviceId);
  const saved = localStorage.getItem(key);
  return saved ? JSON.parse(saved) : null;
};
```

#### Shared Setpoint Management
```typescript
// Unified setpoint across both heaters
const SHARED_SETPOINT_KEY = 'shared_setpoint';

// Listen for setpoint changes from other instances
useEffect(() => {
  const handleStorageChange = (e: StorageEvent) => {
    if (e.key === SHARED_SETPOINT_KEY && e.newValue) {
      setSetpoint(parseFloat(e.newValue));
    }
  };
  
  window.addEventListener('storage', handleStorageChange);
  return () => window.removeEventListener('storage', handleStorageChange);
}, []);
```

### Real-time Communication

#### MQTT Integration
```typescript
// MQTT client setup with optimized connection settings
const client = mqtt.connect(`ws://${mqttHost}:${mqttPort}`, {
  keepalive: 60,
  reconnectPeriod: 5000,
  connectTimeout: 10000,
  clean: true,
  clientId: `htr_${deviceId}_${Date.now()}`
});

// Temperature subscription
const temperatureTopic = `instrument/unit${unitNumber}/htr_a/temperature`;
client.subscribe(temperatureTopic);

// Handle incoming temperature data
client.on('message', (topic, message) => {
  if (topic === temperatureTopic) {
    const temp = parseFloat(message.toString());
    setCurrentTemp(temp);
  }
});
```

#### Connection Monitoring
```typescript
// MQTT connection watchdog
useEffect(() => {
  const watchdog = setInterval(() => {
    const now = Date.now();
    if (lastMessageTime && (now - lastMessageTime) > 30000) {
      // Stale connection - let MQTT.js handle reconnection
      setConnectionStatus('Stale');
    }
  }, 5000);
  
  return () => clearInterval(watchdog);
}, [lastMessageTime]);
```

### Timer Configuration

#### Individual Timer Settings
```typescript
// Timer size management per unit
const timerSizeKey = `unit${unitNumber}htr${htrType}time`;

const saveTimerSize = (key: string, size: number) => {
  localStorage.setItem(key, size.toString());
};

const loadTimerSize = (key: string): number => {
  const saved = localStorage.getItem(key);
  return saved ? parseInt(saved) : 15; // Default 15 seconds
};
```

#### Timer-based Section Control
```typescript
// Circular timer display
<CircularTimer 
  isActive={isTimerActive}
  timeLeft={timeLeft}
  totalTime={timerSize * 1000}
  label={timerAction}
/>

// Timer logic with PID change reset
useEffect(() => {
  if (pidOutput !== lastPidOutput) {
    // Reset timer on PID change
    setTimeLeft(timerSize * 1000);
    setIsTimerActive(true);
  }
}, [pidOutput, timerSize]);
```

## 🎨 UI Components

### Temperature Display
```typescript
// Animated temperature indicator
<div className="text-4xl font-bold text-blue-400">
  {currentTemp.toFixed(1)}°F
</div>

// Temperature range indicator (32°F - 750°F)
<div className="text-sm text-gray-400">
  Range: 32°F - 750°F
</div>
```

### Section Controls
```typescript
// Interactive section toggles
{sections.map((isActive, index) => (
  <button
    key={index}
    onClick={() => toggleSection(index)}
    className={`px-4 py-2 rounded ${
      isActive 
        ? 'bg-orange-500 text-white' 
        : 'bg-gray-600 text-gray-300'
    }`}
  >
    Section {index + 1}
  </button>
))}
```

### PID Tuning Interface
```typescript
// PID parameter controls
<div className="grid grid-cols-1 gap-4">
  <div>
    <label>Kp (Proportional)</label>
    <input
      type="number"
      step="0.1"
      value={kp}
      onChange={(e) => setKp(parseFloat(e.target.value))}
      className="w-full p-2 border rounded"
    />
  </div>
  
  // Timer size control
  <div>
    <label>Timer Size (5-120s)</label>
    <input
      type="range"
      min="5"
      max="120"
      value={timerSize}
      onChange={(e) => {
        const newSize = parseInt(e.target.value);
        setTimerSize(newSize);
        saveTimerSize(timerSizeKey, newSize);
      }}
    />
  </div>
</div>
```

### Debug Information
```typescript
// Collapsible debug panel
const [showDebugLog, setShowDebugLog] = useState(false);

<button
  onClick={() => setShowDebugLog(!showDebugLog)}
  className="text-sm text-blue-400 hover:text-blue-300"
>
  {showDebugLog ? 'Hide' : 'Show'} Debug Log
</button>

{showDebugLog && (
  <div className="mt-4 p-4 bg-gray-800 rounded max-h-40 overflow-y-auto">
    {debugLog.map((entry, index) => (
      <div key={index} className="text-xs text-green-400 font-mono">
        {entry}
      </div>
    ))}
  </div>
)}
```

## 🔧 Development Setup

### Prerequisites
```bash
# Node.js 18+ required
node --version  # Should be 18.0.0 or higher
npm --version   # Should be 8.0.0 or higher
```

### Installation
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Environment Variables
Create `.env.local` file:
```bash
VITE_UNIT_NUMBER=1
VITE_HTR_A_IP=192.168.30.29
VITE_HTR_B_IP=192.168.30.33
VITE_HTR_A_DEVICE_ID=00-02-01-6D-55-8A
VITE_HTR_B_DEVICE_ID=00-02-01-6D-55-86
VITE_HTR_A_TOPIC=instrument/unit1/htr_a/temperature
VITE_HTR_B_TOPIC=instrument/unit1/htr_a/temperature
VITE_MQTT_HOST=localhost
VITE_MQTT_PORT=1883
VITE_API_BASE_URL=http://localhost:38001
```

## 🧪 Testing

### Component Testing
```bash
# Run tests
npm run test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

### Manual Testing Checklist

#### State Persistence
- [ ] Auto/Manual mode survives page refresh
- [ ] Setpoint value persists across sessions
- [ ] PID parameters remain after reload
- [ ] Section states maintained on refresh
- [ ] Timer settings preserved per unit

#### Real-time Features
- [ ] Temperature updates every second
- [ ] MQTT connection status accurate
- [ ] Section toggles reflect actual state
- [ ] PID output updates in real-time
- [ ] Timer countdown works correctly

#### Cross-unit Features
- [ ] Shared setpoint updates both heaters
- [ ] Individual timer settings per unit
- [ ] Independent section control
- [ ] Separate auto/manual modes

### Browser Debugging

#### React Developer Tools
```bash
# Install browser extension
# Chrome: React Developer Tools
# Firefox: React Developer Tools

# Debug component state
# Open DevTools → React tab → Select component
```

#### MQTT WebSocket Monitoring
```bash
# Open browser DevTools
# Network tab → WS (WebSocket) filter
# Monitor MQTT messages in real-time
```

#### localStorage Inspection
```bash
# Open browser DevTools
# Application tab → Local Storage
# Check stored values:
# - unit1_htr_a_persistent_state
# - unit1htratime
# - shared_setpoint
```

## 🚀 Production Build

### Optimization
```bash
# Build optimized production bundle
npm run build

# Analyze bundle size
npm run build:analyze

# Serve production build locally
npm run preview
```

### Docker Integration
```dockerfile
# Multi-stage build for production
FROM node:18-alpine as builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

## 📊 Performance

### Optimization Techniques

#### React Optimization
```typescript
// Memoized components for expensive renders
const MemoizedTemperatureDisplay = React.memo(TemperatureDisplay);

// Optimized state updates
const updateSections = useCallback((index: number) => {
  setSections(prev => {
    const newSections = [...prev];
    newSections[index] = !newSections[index];
    return newSections;
  });
}, []);

// Debounced API calls
const debouncedSaveSettings = useMemo(
  () => debounce(saveSettings, 500),
  []
);
```

#### MQTT Optimization
```typescript
// Efficient message handling
const handleMqttMessage = useCallback((topic: string, message: Buffer) => {
  if (topic.endsWith('/temperature')) {
    setCurrentTemp(parseFloat(message.toString()));
  }
}, []);

// Connection optimization
const mqttOptions = {
  keepalive: 60,
  reconnectPeriod: 5000,
  connectTimeout: 10000,
  clean: true
};
```

### Performance Metrics
- **Initial Load**: < 2 seconds
- **Temperature Update Latency**: < 100ms
- **UI Response Time**: < 50ms
- **Memory Usage**: < 50MB
- **Bundle Size**: < 1MB gzipped

## 🔒 Security Considerations

### Input Validation
```typescript
// Temperature setpoint validation
const validateSetpoint = (value: number): boolean => {
  return value >= 32 && value <= 750;
};

// PID parameter validation
const validatePidValue = (value: number): boolean => {
  return value >= 0 && value <= 100;
};
```

### MQTT Security
```typescript
// Secure MQTT connection options
const mqttOptions = {
  // username: 'iot_user',    // Enable in production
  // password: 'secure_pass', // Enable in production
  clean: true,
  clientId: `htr_${deviceId}_${Date.now()}`
};
```

## 📚 Additional Resources

### Useful Scripts
```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "lint": "eslint src --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
    "type-check": "tsc --noEmit",
    "test": "vitest",
    "test:coverage": "vitest --coverage"
  }
}
```

### Browser Compatibility
- **Chrome**: 88+
- **Firefox**: 85+
- **Safari**: 14+
- **Edge**: 88+

### Development Tips

1. **🔄 Hot Reload**: Changes are instantly reflected
2. **📱 Responsive**: Test on different screen sizes
3. **🎯 Type Safety**: Use TypeScript for robust code
4. **📊 Real-time**: Monitor MQTT connections actively
5. **💾 Persistence**: Test localStorage functionality
6. **🎛️ PID Tuning**: Use the built-in tuning interface
7. **⏱️ Timer Testing**: Verify timer functionality

This frontend provides a modern, efficient interface for industrial heater control with real-time monitoring, advanced PID control, and comprehensive state management! 🔥
