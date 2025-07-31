import React from 'react';
import HtrDeviceDetail from './HtrDeviceDetail';

const DualHtrControl: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-900">
      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* HTR-A Control */}
          <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden border border-gray-700">
            <div className="bg-blue-600 text-white px-4 py-3">
              <h2 className="text-xl font-semibold">HTR-A Primary Heater</h2>
              <p className="text-blue-100 text-sm">IP: 192.168.30.29 | Max: 750°F</p>
            </div>
            <div className="p-1 bg-gray-800">
              <HtrDeviceDetail 
                deviceType="HTR-A" 
                ioLinkIp="192.168.30.29"
              />
            </div>
          </div>

          {/* HTR-B Control */}
          <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden border border-gray-700">
            <div className="bg-green-600 text-white px-4 py-3">
              <h2 className="text-xl font-semibold">HTR-B Secondary Heater</h2>
              <p className="text-green-100 text-sm">IP: 192.168.30.33 | Max: 750°F</p>
            </div>
            <div className="p-1 bg-gray-800">
              <HtrDeviceDetail 
                deviceType="HTR-B" 
                ioLinkIp="192.168.30.33"
              />
            </div>
          </div>
        </div>
        
        {/* System Status Footer */}
        <div className="mt-6 bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex justify-center items-center space-x-8 text-white">
            <div className="text-center">
              <div className="text-sm text-gray-300">System Status</div>
              <div className="text-lg font-semibold text-green-400">ONLINE</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-300">MQTT Broker</div>
              <div className="text-lg font-semibold text-blue-400">Connected</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-300">Database</div>
              <div className="text-lg font-semibold text-purple-400">Active</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DualHtrControl; 