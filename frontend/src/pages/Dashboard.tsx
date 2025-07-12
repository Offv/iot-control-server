import { Link } from 'react-router-dom';

const DEVICE_CONFIGS = {
  'HTR-A': {
    deviceId: '00-02-01-6D-55-8A',
    maxTemp: 1200,
    name: 'HTR-A',
    description: 'Primary Heater Control',
    ip: '192.168.30.29',
    inputDeviceId: null
  },
  'HTR-B': {
    deviceId: '00-02-01-6D-55-86',
    maxTemp: 800,
    name: 'HTR-B',
    description: 'Secondary Heater Control',
    ip: '192.168.30.33',
    inputDeviceId: '00-02-01-6d-55-86'
  }
};

const Dashboard = () => {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Heater Control Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {Object.entries(DEVICE_CONFIGS).map(([key, config]) => (
          <Link key={key} to={`/htr-${key.toLowerCase().split('-')[1]}`} className="block">
            <div className="bg-gray-800 rounded-lg p-6 hover:bg-gray-700 transition-colors">
              <h2 className="text-xl font-semibold mb-2">{config.name}</h2>
              <p className="text-gray-400">{config.description}</p>
              <p className="text-gray-400">IO-Link IP: {config.ip}</p>
              <p className="text-gray-400">Device ID: {config.deviceId}</p>
              <p className="text-gray-400">Max Temperature: {config.maxTemp}°F</p>
              {config.inputDeviceId && (
                <p className="text-gray-400">Temperature Input: {config.inputDeviceId}</p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default Dashboard; 