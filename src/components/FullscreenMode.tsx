import { useState, useEffect } from 'react';
import { Minimize, Thermometer, Clock } from 'lucide-react';
import { SensorData, MoistureStatus } from '../types/ecowitt';
import { AnimatedBackground } from './AnimatedBackground';
import { MoistureGauge } from './MoistureGauge';

interface PlantThreshold {
  min: number;
  max: number;
}

interface FullscreenModeProps {
  sensors: SensorData[];
  getName: (sensorId: string, index: number) => string;
  getColor: (sensorId: string) => string;
  getThreshold: (sensorId: string) => PlantThreshold;
  getMoistureStatus: (sensorId: string, moisture: number) => MoistureStatus;
  lastUpdated: string | null;
}

const COLOR_OPTIONS: Record<string, { from: string; to: string }> = {
  green: { from: '#1D6F42', to: '#2D8B57' },
  sage: { from: '#6B8E6F', to: '#8BAA8F' },
  rose: { from: '#BE6B7B', to: '#D4919D' },
  blush: { from: '#C9929C', to: '#E8B4BC' },
  terracotta: { from: '#A0522D', to: '#CD853F' },
  coffee: { from: '#6F4E37', to: '#8B7355' },
};

// Component for individual tile with its own seconds ticker
function FullscreenTile({
  sensor,
  name,
  colors,
  status
}: {
  sensor: SensorData;
  name: string;
  colors: { from: string; to: string };
  status: MoistureStatus;
}) {
  const [secondsAgo, setSecondsAgo] = useState(0);

  useEffect(() => {
    const getSecondsAgo = () => {
      if (!sensor.timestamp) return 0;
      const sensorTime = new Date(sensor.timestamp).getTime();
      return Math.floor((Date.now() - sensorTime) / 1000);
    };

    setSecondsAgo(getSecondsAgo());
    const timer = setInterval(() => setSecondsAgo(getSecondsAgo()), 1000);
    return () => clearInterval(timer);
  }, [sensor.timestamp]);

  return (
    <div className="flex-shrink-0 w-[380px] h-[calc(100%-2rem)] bg-white/95 backdrop-blur rounded-3xl shadow-2xl overflow-hidden flex flex-col">
      {/* Header with color */}
      <div
        className="px-6 py-5 relative"
        style={{
          background: `linear-gradient(to right, ${colors.from}, ${colors.to})`
        }}
      >
        <div className="absolute inset-0 bg-[url('/banana-leaf.png')] bg-[length:200px] opacity-10" />
        <h3 className="relative font-display text-3xl font-bold text-white text-center drop-shadow-md truncate">
          {name}
        </h3>
      </div>

      {/* Body */}
      <div className="px-4 py-2 flex-1 flex flex-col justify-center">
        <div className="scale-[1.6] origin-center">
          <MoistureGauge moisture={sensor.moisture} />
        </div>

        {/* Status badge and info row - pushed down with margin */}
        <div className="mt-12 flex items-center justify-center gap-3 flex-wrap">
          <span className={`px-4 py-1.5 rounded-full text-base font-bold uppercase tracking-wide
            ${status === 'dry' ? 'bg-red-500/20 text-red-600' :
              status === 'wet' ? 'bg-blue-500/20 text-blue-600' :
              'bg-green-500/20 text-green-600'}`}
          >
            {status === 'dry' ? 'Needs Water' : status === 'wet' ? 'Over Watered' : 'Good'}
          </span>
          {sensor.ad !== null && (
            <span className="text-base font-semibold text-bhh-pink-dark bg-bhh-cream px-3 py-1.5 rounded-full">
              AD:{sensor.ad}
            </span>
          )}
          <span className="text-sm text-gray-400 italic">
            {secondsAgo}s ago
          </span>
        </div>
      </div>
    </div>
  );
}

export function FullscreenMode({ sensors, getName, getColor, getThreshold, getMoistureStatus, lastUpdated }: FullscreenModeProps) {
  const [temperature, setTemperature] = useState<number | null>(null);

  const exitFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    }
  };

  // Fetch temperature
  useEffect(() => {
    async function fetchTemp() {
      try {
        const response = await fetch(
          'https://api.open-meteo.com/v1/forecast?latitude=34.0736&longitude=-118.3765&current=temperature_2m&temperature_unit=fahrenheit&timezone=America/Los_Angeles'
        );
        const data = await response.json();
        if (data.current) {
          setTemperature(Math.round(data.current.temperature_2m));
        }
      } catch (err) {
        console.error('Error fetching temperature:', err);
      }
    }
    fetchTemp();
    const interval = setInterval(fetchTemp, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };

  // Duplicate sensors for seamless loop
  const scrollingSensors = [...sensors, ...sensors];

  return (
    <div className="fixed inset-0 overflow-hidden bg-black">
      {/* Full animated background - pass fullscreen prop */}
      <div className="absolute inset-0">
        <AnimatedBackground fullscreen />
      </div>

      {/* Large logo in upper portion - positioned high in the sky above hills */}
      <div className="absolute top-[-40%] left-0 right-0 flex justify-center pointer-events-none z-30">
        <img
          src="/logo.png"
          alt="PlantPulse"
          className="w-auto"
          style={{
            height: '28vh',
            transform: 'scale(5)',
            transformOrigin: 'top center',
            filter: 'drop-shadow(0 20px 50px rgba(0,0,0,0.5)) drop-shadow(0 10px 20px rgba(232,160,160,0.4))',
          }}
        />
      </div>

      {/* Top right controls: weather, time, exit */}
      <div className="absolute top-6 right-6 z-50 flex items-center gap-4">
        {temperature !== null && (
          <div className="flex items-center gap-2 text-white text-lg font-semibold
                          bg-bhh-gold/80 backdrop-blur-sm px-5 py-2.5 rounded-full shadow-xl">
            <Thermometer className="w-5 h-5" />
            <span>{temperature}°F</span>
          </div>
        )}
        {lastUpdated && (
          <div className="flex items-center gap-2 text-white text-lg font-semibold
                          bg-bhh-green/80 backdrop-blur-sm px-5 py-2.5 rounded-full shadow-xl">
            <Clock className="w-5 h-5" />
            <span>{formatTime(lastUpdated)}</span>
          </div>
        )}
        <button
          onClick={exitFullscreen}
          className="flex items-center gap-2 text-white text-lg font-semibold
                     bg-black/40 hover:bg-black/60 px-5 py-2.5 rounded-full shadow-xl transition-colors cursor-pointer backdrop-blur-sm"
        >
          <Minimize className="w-5 h-5" />
          <span>Exit</span>
        </button>
      </div>

      {/* Large scrolling tiles at bottom - takes up ~45% of screen */}
      <div className="absolute bottom-0 left-0 right-0 h-[45vh] overflow-hidden z-20">
        <div
          className="flex gap-8 animate-scroll-tiles h-full items-start pt-4"
          style={{
            width: 'max-content',
          }}
        >
          {scrollingSensors.map((sensor, index) => {
            const colorName = getColor(sensor.id);
            const colors = COLOR_OPTIONS[colorName] || COLOR_OPTIONS.green;
            const name = getName(sensor.id, index % sensors.length);
            const status = getMoistureStatus(sensor.id, sensor.moisture);

            return (
              <FullscreenTile
                key={`${sensor.id}-${index}`}
                sensor={sensor}
                name={name}
                colors={colors}
                status={status}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
