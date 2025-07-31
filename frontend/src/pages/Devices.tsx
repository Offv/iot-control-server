import React from 'react';

interface Device {
  id: string;
  name: string;
  deviceId: string;
  ipAddress: string;
  status: 'online' | 'offline' | 'error';
  lastSeen: string;
}

const Devices: React.FC = () => {
  // TODO: Replace with actual API call
  const devices: Device[] = [
    {
      id: 'htr-a',
      name: 'HTR-A',
      deviceId: import.meta.env.VITE_HTR_A_DEVICE_ID || '00-02-01-6D-55-8A',
      ipAddress: import.meta.env.VITE_HTR_A_IP || '192.168.30.29',
      status: 'online',
      lastSeen: new Date().toISOString(),
    },
    {
      id: 'htr-b',
      name: 'HTR-B',
      deviceId: import.meta.env.VITE_HTR_B_DEVICE_ID || '00-02-01-6D-55-86',
      ipAddress: import.meta.env.VITE_HTR_B_IP || '192.168.30.33',
      status: 'online',
      lastSeen: new Date().toISOString(),
    },
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Connected Devices</h1>
      
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Device ID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">IP Address</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Seen</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {devices.map((device) => (
              <tr key={device.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{device.name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{device.deviceId}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{device.ipAddress}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    device.status === 'online' ? 'bg-green-100 text-green-800' :
                    device.status === 'error' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {device.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(device.lastSeen).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Devices; 