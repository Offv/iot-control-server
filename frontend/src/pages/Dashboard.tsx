import React from 'react';
import { Link } from 'react-router-dom';

interface Device {
  id: string;
  name: string;
  ip: string;
  topic: string;
}

const devices: Device[] = [
  {
    id: 'htr-a',
    name: 'HTR-A',
    ip: import.meta.env.VITE_HTR_A_IP || '192.168.30.29',
    topic: import.meta.env.VITE_HTR_A_TOPIC || 'instrument/unit1/htr_a/temperature',
  },
  {
    id: 'htr-b',
    name: 'HTR-B',
    ip: import.meta.env.VITE_HTR_B_IP || '192.168.30.33',
    topic: import.meta.env.VITE_HTR_B_TOPIC || 'instrument/unit1/htr_b/temperature',
  },
];

const Dashboard: React.FC = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      
      {/* Dual Control Quick Access */}
      <div className="mb-8">
        <Link
          to="/dual-control"
          className="block w-full bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700 text-white shadow-lg rounded-lg p-6 transition-all duration-300 transform hover:scale-105"
        >
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">🔥 Dual Heater Control</h2>
            <p className="text-blue-100 mb-4">Control both HTR-A and HTR-B side by side</p>
            <div className="flex justify-center space-x-8 text-sm">
              <div>
                <span className="font-semibold">HTR-A:</span> 192.168.30.29 (1200°F Max)
              </div>
              <div>
                <span className="font-semibold">HTR-B:</span> 192.168.30.33 (800°F Max)
              </div>
            </div>
          </div>
        </Link>
      </div>
      
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-700">Individual Controls</h2>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {devices.map((device) => (
          <Link
            key={device.id}
            to={`/${device.id}`}
            className="bg-white shadow rounded-lg p-6 hover:shadow-lg transition-shadow"
          >
            <h2 className="text-lg font-semibold mb-2">{device.name}</h2>
            <div className="text-gray-600 mb-4">IP: {device.ip}</div>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default Dashboard; 