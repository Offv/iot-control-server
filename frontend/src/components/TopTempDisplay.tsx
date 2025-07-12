import { useEffect, useState } from 'react';
import mqtt from 'mqtt';

const TopTempDisplay = () => {
  const [temperature, setTemperature] = useState<number | null>(null);

  useEffect(() => {
    // Connect to MQTT broker via WebSocket
    const client = mqtt.connect('ws://localhost:9001');

    client.on('connect', () => {
      console.log('Connected to MQTT broker');
      client.subscribe('instruments_ti');
    });

    client.on('message', (topic, message) => {
      if (topic === 'instruments_ti') {
        try {
          const data = JSON.parse(message.toString());
          if (data.data?.payload?.['/processdatamaster/temperature']?.data) {
            setTemperature(data.data.payload['/processdatamaster/temperature'].data);
          }
        } catch (error) {
          console.error('Error parsing MQTT message:', error);
        }
      }
    });

    return () => {
      client.end();
    };
  }, []);

  return (
    <div className="fixed top-4 right-4 bg-gray-800 rounded-lg p-3 shadow-lg">
      <div className="text-sm text-gray-400">Instruments TI</div>
      <div className="text-xl font-bold">
        {temperature !== null ? `${temperature.toFixed(1)}°F` : '--'}
      </div>
    </div>
  );
};

export default TopTempDisplay; 