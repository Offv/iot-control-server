import { Link, useLocation } from 'react-router-dom';
import TopTempDisplay from './TopTempDisplay';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const location = useLocation();

  const menuItems = [
    { path: '/htr-a', label: 'HTR-A', deviceId: '00-02-01-6D-55-8A', ip: '192.168.30.29' },
    { path: '/htr-b', label: 'HTR-B', deviceId: '00-02-01-6D-55-86', ip: '192.168.30.33' }
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
                  : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              <div className="font-semibold">{item.label}</div>
              <div className="text-sm opacity-75">IP: {item.ip}</div>
              <div className="text-sm opacity-75 truncate">ID: {item.deviceId}</div>
            </Link>
          ))}
        </div>
      </div>
      
      {/* Main Content */}
      <main className="flex-1 p-6 overflow-auto">
        <TopTempDisplay />
        {children}
      </main>
    </div>
  );
};

export default Layout; 