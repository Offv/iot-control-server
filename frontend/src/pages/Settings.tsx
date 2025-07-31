import React, { useState } from 'react';

interface Settings {
  mqttHost: string;
  mqttPort: string;
  plcHost: string;
  ioLinkHost: string;
}

const InputField: React.FC<{
  label: string;
  name: string;
  value: string;
  onChange?: (value: string) => void;
}> = ({ label, name, value, onChange }) => (
  <div className="mb-4">
    <label htmlFor={name} className="block text-sm font-medium text-gray-700">
      {label}
    </label>
    <input
      type="text"
      name={name}
      id={name}
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
    />
  </div>
);

const Settings: React.FC = () => {
  const [settings, setSettings] = useState<Settings>({
    mqttHost: import.meta.env.VITE_MQTT_HOST || 'localhost',
    mqttPort: import.meta.env.VITE_MQTT_PORT || '1883',
    plcHost: import.meta.env.VITE_PLC_HOST || '192.168.1.100',
    ioLinkHost: import.meta.env.VITE_IOLINK_IP || '192.168.1.200',
  });

  const handleSave = async () => {
    // TODO: Implement actual API call
    console.log('Saving settings:', settings);
  };

  const handleChange = (key: keyof Settings) => (value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>
      
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold mb-3">MQTT Broker</h2>
        <div className="space-y-4">
          <InputField label="Host" name="mqttHost" value={settings.mqttHost} onChange={handleChange('mqttHost')} />
          <InputField label="Port" name="mqttPort" value={settings.mqttPort} onChange={handleChange('mqttPort')} />
        </div>
      </div>

      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold mb-3">PLC Settings</h2>
        <InputField label="Host" name="plcHost" value={settings.plcHost} onChange={handleChange('plcHost')} />
      </div>

      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold mb-3">IO-Link Settings</h2>
        <InputField label="Host" name="ioLinkHost" value={settings.ioLinkHost} onChange={handleChange('ioLinkHost')} />
      </div>

      <button
        onClick={handleSave}
        className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
      >
        Save Changes
      </button>
    </div>
  );
};

export default Settings; 