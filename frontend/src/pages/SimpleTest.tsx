import React from 'react';

const SimpleTest: React.FC = () => {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-center mb-8">
        🔥 Dual Heater Control System
      </h1>
      
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* HTR-A */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="bg-blue-600 text-white px-4 py-3 rounded-t-lg -mx-6 -mt-6 mb-6">
            <h2 className="text-xl font-semibold">HTR-A Primary Heater</h2>
            <p className="text-blue-100 text-sm">IP: 192.168.30.29 | Max: 750°F</p>
          </div>
          
          <div className="space-y-4">
            <div className="flex justify-between">
              <span>Current Temperature:</span>
              <span className="font-bold">75.2°F</span>
            </div>
            <div className="flex justify-between">
              <span>Setpoint:</span>
              <span className="font-bold">150°F</span>
            </div>
            <div className="flex justify-between">
              <span>Status:</span>
              <span className="text-green-600 font-bold">ONLINE</span>
            </div>
            
            <button className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700">
              Control HTR-A
            </button>
          </div>
        </div>

        {/* HTR-B */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="bg-green-600 text-white px-4 py-3 rounded-t-lg -mx-6 -mt-6 mb-6">
            <h2 className="text-xl font-semibold">HTR-B Secondary Heater</h2>
            <p className="text-green-100 text-sm">IP: 192.168.30.33 | Max: 800°F</p>
          </div>
          
          <div className="space-y-4">
            <div className="flex justify-between">
              <span>Current Temperature:</span>
              <span className="font-bold">68.5°F</span>
            </div>
            <div className="flex justify-between">
              <span>Setpoint:</span>
              <span className="font-bold">120°F</span>
            </div>
            <div className="flex justify-between">
              <span>Status:</span>
              <span className="text-green-600 font-bold">ONLINE</span>
            </div>
            
            <button className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700">
              Control HTR-B
            </button>
          </div>
        </div>
      </div>
      
      <div className="mt-8 text-center">
        <p className="text-gray-600">
          System Status: <span className="text-green-600 font-bold">All Systems Operational</span>
        </p>
      </div>
    </div>
  );
};

export default SimpleTest; 