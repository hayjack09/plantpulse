import { useState, useEffect } from 'react';

// Beverly Hills 90048 coordinates
const LAT = 34.0736;
const LON = -118.3765;

interface WeatherData {
  temperature: number;
  weatherCode: number;
  isDay: boolean;
}

interface BackgroundStyle {
  gradient: string;
  overlay: string;
  description: string;
}

// Weather codes from Open-Meteo API
// 0: Clear, 1-3: Partly cloudy, 45-48: Fog, 51-57: Drizzle, 61-67: Rain, 71-77: Snow, 80-82: Showers, 95-99: Thunderstorm
function getWeatherDescription(code: number): string {
  if (code === 0) return 'clear';
  if (code <= 3) return 'cloudy';
  if (code <= 48) return 'foggy';
  if (code <= 67) return 'rainy';
  if (code <= 77) return 'snowy';
  if (code <= 82) return 'rainy';
  return 'stormy';
}

function getTimeOfDay(): 'dawn' | 'morning' | 'afternoon' | 'evening' | 'night' {
  // Get current time in LA
  const now = new Date();
  const laTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  const hour = laTime.getHours();

  if (hour >= 5 && hour < 7) return 'dawn';
  if (hour >= 7 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 20) return 'evening';
  return 'night';
}

function getBackgroundStyle(timeOfDay: string, weather: string, isDay: boolean): BackgroundStyle {
  // Night time backgrounds
  if (!isDay || timeOfDay === 'night') {
    if (weather === 'clear') {
      return {
        gradient: 'linear-gradient(to bottom, #0f0c29, #302b63, #24243e)',
        overlay: 'rgba(0, 0, 0, 0.3)',
        description: 'Clear night sky'
      };
    }
    if (weather === 'cloudy') {
      return {
        gradient: 'linear-gradient(to bottom, #1a1a2e, #16213e, #0f3460)',
        overlay: 'rgba(0, 0, 0, 0.4)',
        description: 'Cloudy night'
      };
    }
    return {
      gradient: 'linear-gradient(to bottom, #141e30, #243b55)',
      overlay: 'rgba(0, 0, 0, 0.35)',
      description: 'Night'
    };
  }

  // Dawn
  if (timeOfDay === 'dawn') {
    return {
      gradient: 'linear-gradient(to bottom, #ff9a9e, #fecfef, #fecfef)',
      overlay: 'rgba(255, 200, 200, 0.2)',
      description: 'Dawn in Beverly Hills'
    };
  }

  // Morning
  if (timeOfDay === 'morning') {
    if (weather === 'clear') {
      return {
        gradient: 'linear-gradient(to bottom, #a8edea, #fed6e3)',
        overlay: 'rgba(255, 255, 255, 0.1)',
        description: 'Clear morning'
      };
    }
    if (weather === 'foggy') {
      return {
        gradient: 'linear-gradient(to bottom, #d7d2cc, #bdc3c7, #c9d6df)',
        overlay: 'rgba(200, 200, 200, 0.3)',
        description: 'Foggy morning'
      };
    }
    return {
      gradient: 'linear-gradient(to bottom, #89f7fe, #66a6ff)',
      overlay: 'rgba(255, 255, 255, 0.15)',
      description: 'Morning'
    };
  }

  // Afternoon
  if (timeOfDay === 'afternoon') {
    if (weather === 'clear') {
      return {
        gradient: 'linear-gradient(to bottom, #56ccf2, #2f80ed)',
        overlay: 'rgba(255, 255, 255, 0.1)',
        description: 'Sunny afternoon'
      };
    }
    if (weather === 'cloudy') {
      return {
        gradient: 'linear-gradient(to bottom, #bdc3c7, #a6b1c4, #8e99a4)',
        overlay: 'rgba(150, 150, 150, 0.2)',
        description: 'Cloudy afternoon'
      };
    }
    if (weather === 'rainy') {
      return {
        gradient: 'linear-gradient(to bottom, #606c88, #3f4c6b)',
        overlay: 'rgba(100, 100, 120, 0.3)',
        description: 'Rainy afternoon'
      };
    }
    return {
      gradient: 'linear-gradient(to bottom, #74ebd5, #acb6e5)',
      overlay: 'rgba(255, 255, 255, 0.1)',
      description: 'Afternoon'
    };
  }

  // Evening / Sunset
  if (timeOfDay === 'evening') {
    if (weather === 'clear') {
      return {
        gradient: 'linear-gradient(to bottom, #fa709a, #fee140, #f6d365)',
        overlay: 'rgba(255, 150, 100, 0.15)',
        description: 'Golden hour sunset'
      };
    }
    return {
      gradient: 'linear-gradient(to bottom, #c06c84, #6c5b7b, #355c7d)',
      overlay: 'rgba(100, 80, 120, 0.2)',
      description: 'Evening'
    };
  }

  // Default
  return {
    gradient: 'linear-gradient(to bottom, #74ebd5, #acb6e5)',
    overlay: 'rgba(255, 255, 255, 0.1)',
    description: 'Beverly Hills'
  };
}

export function useDynamicBackground() {
  const [background, setBackground] = useState<BackgroundStyle>({
    gradient: 'linear-gradient(to bottom, #74ebd5, #acb6e5)',
    overlay: 'rgba(255, 255, 255, 0.1)',
    description: 'Loading...'
  });
  const [weather, setWeather] = useState<WeatherData | null>(null);

  useEffect(() => {
    async function fetchWeather() {
      try {
        // Using Open-Meteo free API (no key required)
        const response = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,weather_code,is_day&timezone=America/Los_Angeles`
        );
        const data = await response.json();

        if (data.current) {
          setWeather({
            temperature: data.current.temperature_2m,
            weatherCode: data.current.weather_code,
            isDay: data.current.is_day === 1
          });
        }
      } catch (err) {
        console.error('Error fetching weather:', err);
        // Use time-based fallback
        const timeOfDay = getTimeOfDay();
        const isDay = !['night'].includes(timeOfDay);
        setBackground(getBackgroundStyle(timeOfDay, 'clear', isDay));
      }
    }

    fetchWeather();
    // Refresh weather every 10 minutes
    const interval = setInterval(fetchWeather, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (weather) {
      const timeOfDay = getTimeOfDay();
      const weatherDesc = getWeatherDescription(weather.weatherCode);
      setBackground(getBackgroundStyle(timeOfDay, weatherDesc, weather.isDay));
    }
  }, [weather]);

  // Also update every minute for time changes
  useEffect(() => {
    const interval = setInterval(() => {
      if (weather) {
        const timeOfDay = getTimeOfDay();
        const weatherDesc = getWeatherDescription(weather.weatherCode);
        setBackground(getBackgroundStyle(timeOfDay, weatherDesc, weather.isDay));
      }
    }, 60 * 1000);
    return () => clearInterval(interval);
  }, [weather]);

  return { background, weather };
}
