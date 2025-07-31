import React from 'react';
import { Link, useLocation } from 'react-router-dom';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const location = useLocation();

  const menuItems = [
    { 
      path: '/', 
      label: 'Heater Control', 
      description: 'Control both HTR-A & HTR-B',
      isSpecial: true
    }
  ];

  return (
    <div className="min-h-screen bg-gray-900 text-white flex">
      {/* Side Menu */}
      <div className="w-64 bg-gray-800 min-h-screen p-4 border-r border-gray-700">
        <Link to="/" className="block mb-8">
          <h1 className="text-xl font-bold">Heater Control</h1>
        </Link>
        <div className="space-y-2">
          {menuItems.map((item) => (
            <Link 
              key={item.path} 
              to={item.path}
              className={`block w-full p-3 rounded-lg transition-colors ${
                location.pathname === item.path 
                  ? 'bg-primary text-white' 
                  : item.isSpecial 
                    ? 'bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700'
                    : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              <div className="font-semibold">{item.label}</div>
              {item.isSpecial ? (
                <div className="text-sm opacity-90">{item.description}</div>
              ) : (
                <>
                  <div className="text-sm opacity-75">IP: {item.ip}</div>
                  <div className="text-sm opacity-75 truncate">ID: {item.deviceId}</div>
                </>
              )}
            </Link>
          ))}
        </div>
      </div>
      
      {/* Main Content */}
      <main className="flex-1 p-6 overflow-auto">
        {children}
      </main>
    </div>
  );
};

export default Layout; 