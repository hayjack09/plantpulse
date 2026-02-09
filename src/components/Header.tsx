import { useState, useEffect } from 'react';
import { Clock, WifiOff, Thermometer, Maximize, Minimize } from 'lucide-react';

interface HeaderProps {
  onRefresh: () => void;
  loading: boolean;
  lastUpdated: string | null;
}

export function Header({ onRefresh: _onRefresh, loading: _loading, lastUpdated }: HeaderProps) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [temperature, setTemperature] = useState<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement);

  useEffect(() => {
    const handleChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleChange);
    return () => document.removeEventListener('fullscreenchange', handleChange);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen();
    }
  };

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Fetch current temperature for Beverly Hills
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
    const interval = setInterval(fetchTemp, 10 * 60 * 1000); // Refresh every 10 min
    return () => clearInterval(interval);
  }, []);

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };

  return (
    <header className="relative overflow-visible">
      {/* Controls - top-right on desktop only */}
      <div className="hidden sm:flex absolute sm:top-5 sm:right-6 items-center gap-2 z-10">
        {!isOnline && (
          <div className="flex items-center gap-1.5 text-white text-sm font-semibold
                          bg-bhh-gold px-4 py-2 rounded-full shadow-xl animate-pulse">
            <WifiOff className="w-4 h-4" />
            <span>Offline</span>
          </div>
        )}
        {temperature !== null && (
          <div className="flex items-center gap-1.5 text-white text-sm font-semibold
                          bg-bhh-gold px-4 py-2 rounded-full shadow-xl">
            <Thermometer className="w-4 h-4" />
            <span>{temperature}°F</span>
          </div>
        )}
        {lastUpdated && (
          <div className="flex items-center gap-1.5 text-white text-sm font-semibold
                          bg-bhh-green px-4 py-2 rounded-full shadow-xl">
            <Clock className="w-4 h-4" />
            <span>{formatTime(lastUpdated)}</span>
          </div>
        )}
        <button
          onClick={toggleFullscreen}
          className="flex items-center gap-1.5 text-white text-sm font-semibold
                     bg-bhh-green-dark px-4 py-2 rounded-full shadow-xl hover:opacity-90 transition-opacity cursor-pointer"
        >
          {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
        </button>
      </div>

      {/* Centered logo - large logo */}
      <div className="flex items-center justify-center -mt-24 sm:mt-0 pt-0 pb-0 sm:pt-12 sm:pb-10 sm:h-[320px]">
        <div className="relative">
          <img
            src="/logo.png"
            alt="PlantPulse"
            className="h-[450px] sm:h-auto sm:max-h-[600px] w-auto pointer-events-none sm:scale-[2]"
            style={{
              filter: 'drop-shadow(0 15px 35px rgba(0,0,0,0.4)) drop-shadow(0 8px 15px rgba(232,160,160,0.4))',
              transformOrigin: 'center center',
            }}
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              const fallback = e.currentTarget.nextElementSibling as HTMLElement;
              if (fallback) fallback.style.display = 'flex';
            }}
          />
        </div>
        {/* Fallback logo */}
        <div className="flex-col items-center gap-2" style={{ display: 'none' }}>
          <h1 className="font-display text-6xl font-bold text-white tracking-wide drop-shadow-lg">
            PlantPulse
          </h1>
          <p className="text-white/90 text-lg tracking-[0.4em] uppercase">
            Luxury Soil Monitoring
          </p>
        </div>
      </div>

      {/* Mobile controls - centered below logo */}
      <div className="flex sm:hidden items-center justify-center gap-1.5 -mt-48 mb-16">
        {!isOnline && (
          <div className="flex items-center gap-1 text-white text-xs font-semibold
                          bg-bhh-gold px-2.5 py-1 rounded-full shadow-lg animate-pulse">
            <WifiOff className="w-3 h-3" />
            <span>Offline</span>
          </div>
        )}
        {temperature !== null && (
          <div className="flex items-center gap-1 text-white text-xs font-semibold
                          bg-bhh-gold px-2.5 py-1 rounded-full shadow-lg">
            <Thermometer className="w-3 h-3" />
            <span>{temperature}°F</span>
          </div>
        )}
        {lastUpdated && (
          <div className="flex items-center gap-1 text-white text-xs font-semibold
                          bg-bhh-green px-2.5 py-1 rounded-full shadow-lg">
            <Clock className="w-3 h-3" />
            <span>{formatTime(lastUpdated)}</span>
          </div>
        )}
      </div>
    </header>
  );
}
