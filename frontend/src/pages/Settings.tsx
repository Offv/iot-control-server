import { useState } from 'react';
import { ArrowPathIcon } from '@heroicons/react/24/solid';

interface SettingsForm {
  mqttHost: string;
  mqttPort: string;
  plcHost: string;
  plcPort: string;
  ioLinkHost: string;
  ioLinkPort: string;
}

const Settings = () => {
  const [settings, setSettings] = useState<SettingsForm>({
    mqttHost: 'localhost',
    mqttPort: '1883',
    plcHost: '192.168.1.100',
    plcPort: '44818',
    ioLinkHost: '192.168.1.200',
    ioLinkPort: '502',
  });

  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    // TODO: Implement actual API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setSaving(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSettings((prev) => ({ ...prev, [name]: value }));
  };

  const InputField = ({ label, name, value }: { label: string; name: keyof SettingsForm; value: string }) => (
    <div className="mb-3">
      <label htmlFor={name} className="block text-sm font-medium text-gray-300 mb-1">
        {label}
      </label>
      <input
        type="text"
        id={name}
        name={name}
        value={value}
        onChange={handleChange}
        className="w-full px-3 py-1.5 bg-white/5 rounded-lg border border-white/10 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors text-sm"
      />
    </div>
  );

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">System Settings</h1>
      <form onSubmit={handleSubmit}>
        <div className="bg-white/5 rounded-lg p-4 mb-4">
          <h2 className="text-lg font-semibold mb-3">MQTT Broker</h2>
          <div className="grid grid-cols-2 gap-3">
            <InputField label="Host" name="mqttHost" value={settings.mqttHost} />
            <InputField label="Port" name="mqttPort" value={settings.mqttPort} />
          </div>
        </div>

        <div className="bg-white/5 rounded-lg p-4 mb-4">
          <h2 className="text-lg font-semibold mb-3">PLC Connection</h2>
          <div className="grid grid-cols-2 gap-3">
            <InputField label="Host" name="plcHost" value={settings.plcHost} />
            <InputField label="Port" name="plcPort" value={settings.plcPort} />
          </div>
        </div>

        <div className="bg-white/5 rounded-lg p-4 mb-4">
          <h2 className="text-lg font-semibold mb-3">IO-Link Master</h2>
          <div className="grid grid-cols-2 gap-3">
            <InputField label="Host" name="ioLinkHost" value={settings.ioLinkHost} />
            <InputField label="Port" name="ioLinkPort" value={settings.ioLinkPort} />
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="flex items-center space-x-2 px-4 py-1.5 bg-primary rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 text-sm"
        >
          {saving && <ArrowPathIcon className="h-4 w-4 animate-spin" />}
          <span>{saving ? 'Saving...' : 'Save Settings'}</span>
        </button>
      </form>
    </div>
  );
};

export default Settings; 