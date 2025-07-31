import React, { useState, useEffect } from 'react';

interface SimpleHtrControlProps {
  deviceType: string;
  ioLinkIp: string;
}

interface HtrConfig {
  setpoint: number;
  isAuto: boolean;
  pidOutput: number;
  sections: { [key: number]: boolean };
}

const SimpleHtrControl: React.FC<SimpleHtrControlProps> = ({ deviceType, ioLinkIp }) => {
  const [htrConfig, setHtrConfig] = useState<HtrConfig>({
    setpoint: 150,
    isAuto: false,
    pidOutput: 0,
    sections: { 1: false, 2: false, 3: false, 4: false }
  });
  
  const [currentTemp, setCurrentTemp] = useState(75.2);
  const [mqttStatus, setMqttStatus] = useState('Connected');
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // Simulate temperature updates
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTemp(prev => prev + (Math.random() - 0.5) * 2);
      setLastUpdate(new Date());
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const handleSetpointChange = (value: number) => {
    setHtrConfig(prev => ({ ...prev, setpoint: value }));
  };

  const toggleAutoMode = () => {
    setHtrConfig(prev => ({ ...prev, isAuto: !prev.isAuto }));
  };

  const toggleSection = (section: number) => {
    setHtrConfig(prev => ({
      ...prev,
      sections: { ...prev.sections, [section]: !prev.sections[section] }
    }));
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">
          {deviceType} Control
        </h1>
        <p className="text-gray-600">IP: {ioLinkIp}</p>
      </div>

      {/* Current Status */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded">
          <div className="text-lg font-bold text-blue-800">
            {currentTemp.toFixed(1)}°F
          </div>
          <div className="text-sm text-blue-600">Current Temperature</div>
        </div>
        
        <div className="bg-green-50 p-4 rounded">
          <div className="text-lg font-bold text-green-800">
            {htrConfig.setpoint}°F
          </div>
          <div className="text-sm text-green-600">Setpoint</div>
        </div>
      </div>

      {/* Setpoint Control */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Setpoint Temperature
        </label>
        <div className="flex items-center space-x-4">
          <input
            type="range"
            min="70"
            max="750"
            step="5"
            value={htrConfig.setpoint}
            onChange={(e) => handleSetpointChange(Number(e.target.value))}
            className="w-full h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer"
          />
          <input
            type="number"
            value={htrConfig.setpoint}
            onChange={(e) => handleSetpointChange(Number(e.target.value))}
            className="w-20 px-2 py-1 border rounded"
          />
        </div>
      </div>

      {/* Auto/Manual Mode */}
      <div className="mb-6">
        <button
          onClick={toggleAutoMode}
          className={`px-6 py-2 rounded font-semibold ${
            htrConfig.isAuto
              ? 'bg-green-600 text-white'
              : 'bg-gray-300 text-gray-700'
          }`}
        >
          {htrConfig.isAuto ? 'AUTO MODE' : 'MANUAL MODE'}
        </button>
      </div>

      {/* Section Controls */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-3">Heater Sections</h3>
        <div className="grid grid-cols-4 gap-2">
          {[1, 2, 3, 4].map(section => (
            <button
              key={section}
              onClick={() => toggleSection(section)}
              disabled={htrConfig.isAuto && section === 1}
              className={`py-2 px-4 rounded font-semibold ${
                htrConfig.sections[section]
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-300 text-gray-700'
              } ${htrConfig.isAuto && section === 1 ? 'opacity-50' : ''}`}
            >
              Section {section}
            </button>
          ))}
        </div>
      </div>

      {/* Status */}
      <div className="border-t pt-4">
        <div className="flex justify-between text-sm text-gray-600">
          <span>MQTT: {mqttStatus}</span>
          <span>Last Update: {lastUpdate.toLocaleTimeString()}</span>
        </div>
      </div>
    </div>
  );
};

export default SimpleHtrControl; 