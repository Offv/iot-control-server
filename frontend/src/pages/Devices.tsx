import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowPathIcon, ChevronRightIcon } from '@heroicons/react/24/solid';

interface Device {
  id: string;
  name: string;
  type: 'io-link' | 'plc';
  status: 'online' | 'offline';
  lastSeen: string;
  ipAddress: string;
  htrSystem?: string;
}

const Devices = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: Replace with actual API call
    const fetchDevices = () => {
      // Simulated API response
      setDevices([
        {
          id: '1',
          name: 'IO-Link Master HTR-A',
          type: 'io-link',
          status: 'online',
          lastSeen: new Date().toISOString(),
          ipAddress: '192.168.30.29',
          htrSystem: 'HTR A'
        },
        {
          id: '2',
          name: 'IO-Link Master HTR-B',
          type: 'io-link',
          status: 'online',
          lastSeen: new Date().toISOString(),
          ipAddress: '192.168.30.33',
          htrSystem: 'HTR B'
        }
      ]);
      setLoading(false);
    };

    fetchDevices();
  }, []);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Connected Devices</h1>
        <button
          onClick={() => setLoading(true)}
          className="flex items-center space-x-2 px-3 py-1.5 bg-primary rounded-lg hover:bg-primary-dark transition-colors"
        >
          <ArrowPathIcon className="h-4 w-4" />
          <span className="text-sm">Refresh</span>
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-48">
          <ArrowPathIcon className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid gap-3">
          {devices.map((device) => (
            <Link
              key={device.id}
              to={`/devices/${device.id}`}
              className="bg-gray-800 rounded-lg p-4 flex items-center justify-between hover:bg-gray-700 transition-colors"
            >
              <div>
                <h3 className="text-lg font-medium">{device.name}</h3>
                <div className="flex space-x-4">
                  <p className="text-sm text-gray-400">Type: {device.type.toUpperCase()}</p>
                  <p className="text-sm text-primary">IP: {device.ipAddress}</p>
                </div>
                <p className="text-xs text-gray-400">
                  Last seen: {new Date(device.lastSeen).toLocaleString()}
                </p>
                {device.htrSystem && (
                  <p className="text-sm text-emerald-400 mt-1">
                    System: {device.htrSystem}
                  </p>
                )}
              </div>
              <div className="flex items-center space-x-4">
                <div
                  className={`px-2.5 py-1 rounded-full text-sm ${
                    device.status === 'online'
                      ? 'bg-primary/20 text-primary'
                      : 'bg-red-500/20 text-red-500'
                  }`}
                >
                  {device.status.toUpperCase()}
                </div>
                <ChevronRightIcon className="h-5 w-5 text-gray-400" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default Devices; 