import { useEffect, useState } from 'react';

// Beverly Hills 90048 coordinates
const LAT = 34.0736;
const LON = -118.3765;

interface WeatherData {
  temperature: number;
  weatherCode: number;
  isDay: boolean;
  cloudCover: number;
  windSpeed: number;
  sunrise: string;
  sunset: string;
}

// Calculate sun position: 0 = midnight, 0.25 = sunrise, 0.5 = solar noon, 0.75 = sunset, 1 = midnight
function getSunPosition(sunrise: string, sunset: string): number {
  const now = new Date();
  const laTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));

  const sunriseTime = new Date(sunrise);
  const sunsetTime = new Date(sunset);

  const currentMinutes = laTime.getHours() * 60 + laTime.getMinutes();
  const sunriseMinutes = sunriseTime.getHours() * 60 + sunriseTime.getMinutes();
  const sunsetMinutes = sunsetTime.getHours() * 60 + sunsetTime.getMinutes();

  // Before sunrise
  if (currentMinutes < sunriseMinutes) {
    const midnightToSunrise = sunriseMinutes;
    return 0.25 * (currentMinutes / midnightToSunrise);
  }

  // Between sunrise and sunset (daytime)
  if (currentMinutes <= sunsetMinutes) {
    const dayLength = sunsetMinutes - sunriseMinutes;
    const dayProgress = (currentMinutes - sunriseMinutes) / dayLength;
    return 0.25 + (dayProgress * 0.5); // 0.25 to 0.75
  }

  // After sunset
  const sunsetToMidnight = 1440 - sunsetMinutes;
  const afterSunset = currentMinutes - sunsetMinutes;
  return 0.75 + (0.25 * (afterSunset / sunsetToMidnight));
}

// Get time period based on sun position
// 0.25 = sunrise, 0.5 = solar noon, 0.75 = sunset
function getTimeOfDay(sunPosition: number): 'night' | 'dawn' | 'morning' | 'afternoon' | 'evening' {
  if (sunPosition < 0.2) return 'night';       // Before dawn
  if (sunPosition < 0.3) return 'dawn';        // Around sunrise
  if (sunPosition < 0.5) return 'morning';     // Morning until noon
  if (sunPosition < 0.7) return 'afternoon';   // Noon until ~2hrs before sunset
  if (sunPosition < 0.8) return 'evening';     // Last ~1hr before sunset
  return 'night';                              // After dusk
}

function getWeatherType(code: number): 'clear' | 'cloudy' | 'foggy' | 'rainy' | 'stormy' {
  if (code === 0) return 'clear';
  if (code <= 3) return 'cloudy';
  if (code <= 48) return 'foggy';
  if (code <= 82) return 'rainy';
  return 'stormy';
}

// Calculate moon phase (0 = new moon, 0.5 = full moon, 1 = new moon again)
function getMoonPhase(): number {
  const now = new Date();
  // Known new moon: January 29, 2025
  const knownNewMoon = new Date('2025-01-29T12:36:00Z');
  const lunarCycle = 29.53059; // days

  const daysSinceNewMoon = (now.getTime() - knownNewMoon.getTime()) / (1000 * 60 * 60 * 24);
  const phase = (daysSinceNewMoon % lunarCycle) / lunarCycle;

  return phase;
}

// Get moon phase name for accessibility
function getMoonPhaseName(phase: number): string {
  if (phase < 0.03 || phase > 0.97) return 'New Moon';
  if (phase < 0.22) return 'Waxing Crescent';
  if (phase < 0.28) return 'First Quarter';
  if (phase < 0.47) return 'Waxing Gibbous';
  if (phase < 0.53) return 'Full Moon';
  if (phase < 0.72) return 'Waning Gibbous';
  if (phase < 0.78) return 'Last Quarter';
  return 'Waning Crescent';
}

// Seeded random number generator for consistent star positions
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}

// Pre-generate fixed star positions spread naturally across the sky
function generateStarPositions(count: number) {
  const random = seededRandom(42); // Fixed seed for consistency
  const stars = [];

  for (let i = 0; i < count; i++) {
    stars.push({
      left: random() * 100,           // 0-100%
      top: random() * 60,             // 0-60% (upper portion of sky)
      size: 1.5 + random() * 2.5,     // 1.5-4px
      delay: random() * 3,            // 0-3s animation delay
      duration: 2 + random() * 2,     // 2-4s twinkle duration
      isBright: i < 15,               // First 15 are brighter
    });
  }
  return stars;
}

// Fixed star positions - computed once
const STARS = generateStarPositions(80);

interface AnimatedBackgroundProps {
  fullscreen?: boolean;
}

export function AnimatedBackground({ fullscreen = false }: AnimatedBackgroundProps) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [_sunPosition, setSunPosition] = useState(0.5);
  const [timeOfDay, setTimeOfDay] = useState<'night' | 'dawn' | 'morning' | 'afternoon' | 'evening'>('afternoon');
  const [shootingStar, setShootingStar] = useState<{ startX: number; startY: number; angle: number } | null>(null);
  const [activeHeli, setActiveHeli] = useState<{ top: number; direction: number; drift: number; key: number } | null>(null);
  const [hoveringHeli, setHoveringHeli] = useState<{ top: number; left: number; key: number; phase: 'enter' | 'hover' | 'exit'; fromDirection: 'left' | 'right' } | null>(null);
  const [contrails, setContrails] = useState<{ id: number; top: number; direction: number; speed: number }[]>([]);

  useEffect(() => {
    async function fetchWeather() {
      try {
        // Fetch current weather AND daily sunrise/sunset
        const response = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,weather_code,is_day,cloud_cover,wind_speed_10m&daily=sunrise,sunset&timezone=America/Los_Angeles`
        );
        const data = await response.json();

        if (data.current && data.daily) {
          const newWeather = {
            temperature: data.current.temperature_2m,
            weatherCode: data.current.weather_code,
            isDay: data.current.is_day === 1,
            cloudCover: data.current.cloud_cover || 0,
            windSpeed: data.current.wind_speed_10m || 5,
            sunrise: data.daily.sunrise[0],
            sunset: data.daily.sunset[0]
          };
          setWeather(newWeather);

          // Calculate initial sun position
          const pos = getSunPosition(newWeather.sunrise, newWeather.sunset);
          setSunPosition(pos);
          setTimeOfDay(getTimeOfDay(pos));
        }
      } catch (err) {
        console.error('Error fetching weather:', err);
        // Fallback with approximate times
        setWeather({
          temperature: 72,
          weatherCode: 0,
          isDay: true,
          cloudCover: 20,
          windSpeed: 5,
          sunrise: new Date().toISOString().split('T')[0] + 'T06:50',
          sunset: new Date().toISOString().split('T')[0] + 'T17:20'
        });
      }
    }

    fetchWeather();
    // Refresh weather data every 10 minutes
    const weatherInterval = setInterval(fetchWeather, 10 * 60 * 1000);

    return () => {
      clearInterval(weatherInterval);
    };
  }, []);

  // Update sun position every 30 seconds for smooth real-time transitions
  useEffect(() => {
    if (!weather?.sunrise || !weather?.sunset) return;

    const updateSunPosition = () => {
      const pos = getSunPosition(weather.sunrise, weather.sunset);
      setSunPosition(pos);
      setTimeOfDay(getTimeOfDay(pos));
    };

    updateSunPosition();
    const interval = setInterval(updateSunPosition, 30 * 1000); // Every 30 seconds

    return () => clearInterval(interval);
  }, [weather?.sunrise, weather?.sunset]);

  // Shooting star effect - appears every ~2 minutes at night
  useEffect(() => {
    const triggerShootingStar = () => {
      // Random starting position across the sky
      const isMobile = window.innerWidth < 640;
      const startX = 5 + Math.random() * 75;  // 5-80% from left
      const startY = isMobile ? (2 + Math.random() * 10) : (3 + Math.random() * 35);  // Mobile: 2-12%, Desktop: 3-38%
      const angle = 20 + Math.random() * 40;  // 20-60 degree angle

      setShootingStar({ startX, startY, angle });

      // Clear after animation completes (1.5 seconds)
      setTimeout(() => setShootingStar(null), 1500);
    };

    // Trigger first one after 15 seconds, then every 60 seconds
    const initialTimeout = setTimeout(triggerShootingStar, 15 * 1000);
    const interval = setInterval(triggerShootingStar, 60 * 1000);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, []);

  // Helicopter flyby - every 30 seconds in fullscreen, every 60 seconds otherwise
  useEffect(() => {
    let keyCounter = 0;
    const triggerHeli = () => {
      const isMobile = window.innerWidth < 640;
      // In fullscreen mode, fly lower (right above hills ~25-35%)
      // Normal mode: Mobile 5-15% (above hills), Desktop 3-21%
      const top = fullscreen
        ? (25 + Math.random() * 10)  // Fullscreen: 25-35%
        : isMobile ? (5 + Math.random() * 10) : (3 + Math.random() * 18);
      const direction = Math.random() > 0.5 ? 1 : -1;
      const drift = -4 + Math.random() * 8; // vertical drift during flight (-4% to +4%)
      keyCounter++;
      setActiveHeli({ top, direction, drift, key: keyCounter });
      // Clear after it flies across (~20s)
      setTimeout(() => setActiveHeli(null), 20000);
    };

    const heliInterval = fullscreen ? 30 * 1000 : 60 * 1000; // 30s in fullscreen, 60s otherwise
    const initialTimeout = setTimeout(triggerHeli, 10 * 1000);
    const interval = setInterval(triggerHeli, heliInterval);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, [fullscreen]);

  // Hovering helicopter - every 2 minutes, hovers for 60 seconds
  useEffect(() => {
    let keyCounter = 0;
    const triggerHoveringHeli = () => {
      const isMobile = window.innerWidth < 640;
      keyCounter++;
      // Direction helicopter comes from
      const fromDirection: 'left' | 'right' = Math.random() > 0.5 ? 'left' : 'right';
      // Where it stops to hover (as percentage from left)
      // Keep well away from center where logo is (avoid 30-70% range)
      // Mobile: 5-15% or 85-95%, Desktop: 5-20% or 80-95%
      const left = isMobile
        ? (fromDirection === 'left' ? (5 + Math.random() * 10) : (85 + Math.random() * 10))
        : (fromDirection === 'left' ? (5 + Math.random() * 15) : (80 + Math.random() * 15));
      // Position: fullscreen 25-40%, mobile 10-18%, desktop 15-25%
      const top = fullscreen
        ? (25 + Math.random() * 15)
        : isMobile ? (10 + Math.random() * 8) : (15 + Math.random() * 10);

      setHoveringHeli({ top, left, key: keyCounter, phase: 'enter', fromDirection });

      // After flying in (8s), start hovering
      setTimeout(() => {
        setHoveringHeli(prev => prev ? { ...prev, phase: 'hover' } : null);
      }, 8000);

      // After hovering for 60s, exit
      setTimeout(() => {
        setHoveringHeli(prev => prev ? { ...prev, phase: 'exit' } : null);
      }, 68000); // 8s enter + 60s hover

      // Clear after exiting (10s)
      setTimeout(() => {
        setHoveringHeli(null);
      }, 78000); // 8s enter + 60s hover + 10s exit
    };

    // First hovering heli after 30 seconds, then every 2 minutes
    const initialTimeout = setTimeout(triggerHoveringHeli, 30 * 1000);
    const interval = setInterval(triggerHoveringHeli, 2 * 60 * 1000);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, [fullscreen]);

  // Contrails - tiny distant planes leaving trails
  // Max 3 on screen, spawn one at a time with alternating directions
  useEffect(() => {
    let idCounter = 0;
    let lastDirection = 1;
    let timeoutId: ReturnType<typeof setTimeout>;

    const triggerContrail = () => {
      // Check current count - only add if under 3
      setContrails(prev => {
        if (prev.length >= 3) return prev;

        idCounter++;
        const id = idCounter;
        // Alternate directions and vary heights to avoid collisions
        const direction = lastDirection === 1 ? -1 : 1;
        lastDirection = direction;

        // Stagger vertical positions based on direction to avoid crossing
        // Left-to-right: upper portion (5-12%), Right-to-left: lower portion (12-20%)
        const top = direction === 1
          ? 5 + Math.random() * 7   // 5-12%
          : 12 + Math.random() * 8; // 12-20%

        const speed = 50 + Math.random() * 30; // 50-80 seconds

        // Schedule removal
        setTimeout(() => {
          setContrails(p => p.filter(c => c.id !== id));
        }, (speed + 155) * 1000);

        return [...prev, { id, top, direction, speed }];
      });

      // Schedule next contrail (60-90 seconds apart)
      timeoutId = setTimeout(triggerContrail, (60 + Math.random() * 30) * 1000);
    };

    // First contrail after 30-60 seconds
    const initialDelay = 30000 + Math.random() * 30000;
    timeoutId = setTimeout(triggerContrail, initialDelay);

    return () => {
      clearTimeout(timeoutId);
    };
  }, []);

  const isDay = weather?.isDay ?? timeOfDay !== 'night';
  const weatherType = weather ? getWeatherType(weather.weatherCode) : 'clear';
  const cloudCover = weather?.cloudCover ?? 20;
  const windSpeed = weather?.windSpeed ?? 5;

  // Calculate number of clouds based on actual cloud cover percentage
  // 0-10%: 0 clouds (clear)
  // 10-25%: 1-2 clouds (few clouds)
  // 25-50%: 2-4 clouds (partly cloudy)
  // 50-75%: 4-6 clouds (mostly cloudy)
  // 75-100%: 6-8 clouds (overcast)
  const getCloudCount = (cover: number): number => {
    if (cover < 10) return 0;
    if (cover < 25) return Math.round(1 + (cover - 10) / 15);
    if (cover < 50) return Math.round(2 + (cover - 25) / 12.5);
    if (cover < 75) return Math.round(4 + (cover - 50) / 12.5);
    return Math.round(6 + (cover - 75) / 12.5);
  };
  const numClouds = getCloudCount(cloudCover);

  // Calculate cloud speed based on wind
  const cloudSpeedBase = Math.max(30, 80 - windSpeed * 2);

  // Sky gradient based on time of day - simple and realistic
  const getSkyGradient = () => {
    if (!isDay) {
      return 'linear-gradient(to bottom, #0a0a1a 0%, #1a1a3a 30%, #2d2d5a 100%)';
    }
    switch (timeOfDay) {
      case 'dawn':
        return 'linear-gradient(to bottom, #1e3c72 0%, #ff9a9e 40%, #fecfef 70%, #ffecd2 100%)';
      case 'morning':
        return 'linear-gradient(to bottom, #1e90ff 0%, #87ceeb 40%, #b0e0e6 100%)';
      case 'afternoon':
        return 'linear-gradient(to bottom, #0984e3 0%, #74b9ff 50%, #81ecec 100%)';
      case 'evening':
        // Sunset sky - warm orange/pink at top fading down
        return 'linear-gradient(to bottom, #e17055 0%, #fdcb6e 25%, #fab1a0 50%, #74b9ff 80%, #2d3436 100%)';
      default:
        return 'linear-gradient(to bottom, #0984e3 0%, #74b9ff 50%, #81ecec 100%)';
    }
  };

  return (
    <div className="fixed inset-0 overflow-hidden">
      {/* Sky gradient */}
      <div
        className="absolute inset-0 transition-all duration-[3000ms]"
        style={{ background: getSkyGradient() }}
      />

      {/* Stars (night only) - fixed positions, just twinkle in place */}
      {!isDay && (
        <div className="absolute inset-0">
          {STARS.map((star, i) => (
            <div
              key={`star-${i}`}
              className="absolute rounded-full animate-twinkle"
              style={{
                width: star.size + 'px',
                height: star.size + 'px',
                left: star.left + '%',
                top: star.top + '%',
                animationDelay: star.delay + 's',
                animationDuration: star.duration + 's',
                backgroundColor: star.isBright ? '#ffffff' : 'rgba(255, 255, 255, 0.9)',
                boxShadow: star.isBright
                  ? '0 0 6px 2px rgba(255, 255, 255, 0.8), 0 0 12px 4px rgba(200, 220, 255, 0.5)'
                  : '0 0 4px 1px rgba(255, 255, 255, 0.6)'
              }}
            />
          ))}
        </div>
      )}

      {/* Shooting star (night only) */}
      {!isDay && shootingStar && (
        <div
          className="absolute animate-shooting-star"
          style={{
            left: `${shootingStar.startX}%`,
            top: `${shootingStar.startY}%`,
          }}
        >
          {/* Star head - bright glowing point */}
          <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-white shadow-[0_0_10px_4px_rgba(255,255,255,0.9),0_0_20px_8px_rgba(200,220,255,0.5)]" />
          {/* Long trail behind */}
          <div
            className="absolute top-1/2 right-full h-1 sm:h-1.5 -translate-y-1/2 bg-gradient-to-l from-white via-white/60 to-transparent rounded-full"
            style={{ width: '100px' }}
          />
        </div>
      )}

      {/* Moon with accurate phase (night only) */}
      {!isDay && <Moon />}

      {/* Sun (day only) */}
      {isDay && timeOfDay !== 'evening' && (
        <div
          className="absolute w-20 h-20 sm:w-32 sm:h-32"
          style={{
            top: timeOfDay === 'dawn' ? '40%' : timeOfDay === 'morning' ? '15%' : '10%',
            right: timeOfDay === 'dawn' ? '10%' : timeOfDay === 'morning' ? '20%' : '25%',
          }}
        >
          <div className="relative w-full h-full animate-pulse-slow">
            {/* Sun glow */}
            <div className="absolute inset-[-50%] rounded-full bg-gradient-radial from-yellow-200/50 via-orange-200/20 to-transparent" />
            {/* Sun rays */}
            <div className="absolute inset-[-20%] animate-spin-slow">
              {[...Array(12)].map((_, i) => (
                <div
                  key={`ray-${i}`}
                  className="absolute top-1/2 left-1/2 w-1 bg-gradient-to-t from-yellow-300/60 to-transparent"
                  style={{
                    height: '150%',
                    transform: `translate(-50%, -100%) rotate(${i * 30}deg)`,
                    transformOrigin: 'bottom center'
                  }}
                />
              ))}
            </div>
            {/* Sun core */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-yellow-200 via-yellow-400 to-orange-400 shadow-[0_0_80px_20px_rgba(255,200,50,0.6)]" />
          </div>
        </div>
      )}

      {/* Sunset sun - stays at top like other times, just with sunset colors */}
      {isDay && timeOfDay === 'evening' && (
        <div
          className="absolute w-20 h-20 sm:w-32 sm:h-32"
          style={{ top: '10%', right: '25%' }}
        >
          <div className="relative w-full h-full animate-pulse-slow">
            {/* Sunset glow */}
            <div className="absolute inset-[-50%] rounded-full bg-gradient-radial from-orange-400/60 via-red-400/30 to-transparent" />
            {/* Sun core - sunset colors */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-b from-yellow-400 via-orange-500 to-red-500 shadow-[0_0_80px_20px_rgba(255,150,50,0.6)]" />
          </div>
        </div>
      )}

      {/* Clouds */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(numClouds)].map((_, i) => (
          <Cloud
            key={`cloud-${i}`}
            index={i}
            speed={cloudSpeedBase + Math.random() * 20}
            isDay={isDay}
            weatherType={weatherType}
          />
        ))}
      </div>

      {/* Birds (day only, clear/cloudy weather) */}
      {isDay && (weatherType === 'clear' || weatherType === 'cloudy') && (
        <div className="absolute inset-0 overflow-hidden">
          {[...Array(6)].map((_, i) => (
            <Bird key={`bird-${i}`} index={i} fullscreen={fullscreen} />
          ))}
        </div>
      )}

      {/* Helicopter flyby */}
      {activeHeli && (
        <div className="absolute inset-0">
          <Helicopter key={`heli-${activeHeli.key}`} top={activeHeli.top} direction={activeHeli.direction} drift={activeHeli.drift} isDay={isDay} />
        </div>
      )}

      {/* Contrails - distant planes with fading trails */}
      {contrails.map(contrail => (
        <Contrail
          key={`contrail-${contrail.id}`}
          top={contrail.top}
          direction={contrail.direction}
          speed={contrail.speed}
          isDay={isDay}
        />
      ))}

      {/* Hovering helicopter */}
      {hoveringHeli && (
        <div className="absolute inset-0 overflow-hidden">
          <HoveringHelicopter
            key={`hover-heli-${hoveringHeli.key}`}
            top={hoveringHeli.top}
            left={hoveringHeli.left}
            phase={hoveringHeli.phase}
            isDay={isDay}
            fullscreen={fullscreen}
            fromDirection={hoveringHeli.fromDirection}
          />
        </div>
      )}


      {/* Rain (rainy/stormy weather) */}
      {(weatherType === 'rainy' || weatherType === 'stormy') && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(100)].map((_, i) => (
            <div
              key={`rain-${i}`}
              className="absolute w-0.5 bg-gradient-to-b from-transparent via-blue-300/40 to-blue-400/60 animate-rain"
              style={{
                height: 15 + Math.random() * 20 + 'px',
                left: Math.random() * 100 + '%',
                animationDelay: Math.random() * 2 + 's',
                animationDuration: 0.5 + Math.random() * 0.5 + 's'
              }}
            />
          ))}
        </div>
      )}

      {/* Fog overlay */}
      {weatherType === 'foggy' && (
        <div className="absolute inset-0 bg-gradient-to-b from-gray-300/40 via-gray-400/50 to-gray-300/30 animate-fog" />
      )}

      {/* Hollywood Hills photo */}
      <HillsPhoto isDay={isDay} fullscreen={fullscreen} />

      {/* Banana leaf pattern overlay */}
      <div
        className="absolute inset-0 bg-[url('/banana-leaf.png')] bg-repeat bg-[length:400px_400px] transition-opacity duration-1000"
        style={{ opacity: isDay ? 0.15 : 0.08 }}
      />
    </div>
  );
}

// Cloud shapes as simple CSS - 5 variations
const cloudShapes = [
  // Shape 0: Wide fluffy
  { puffs: [{x:0,y:8,w:60,h:40},{x:40,y:0,w:80,h:55},{x:100,y:5,w:65,h:45},{x:55,y:12,w:50,h:35}] },
  // Shape 1: Tall cumulus
  { puffs: [{x:20,y:20,w:70,h:45},{x:50,y:5,w:60,h:50},{x:30,y:0,w:50,h:40},{x:70,y:15,w:45,h:35}] },
  // Shape 2: Long stratus
  { puffs: [{x:0,y:10,w:50,h:30},{x:35,y:5,w:70,h:40},{x:90,y:8,w:55,h:35},{x:130,y:12,w:45,h:28}] },
  // Shape 3: Small puff
  { puffs: [{x:10,y:10,w:50,h:35},{x:40,y:5,w:55,h:40},{x:25,y:0,w:40,h:30}] },
  // Shape 4: Wispy
  { puffs: [{x:0,y:12,w:45,h:25},{x:30,y:8,w:55,h:32},{x:70,y:5,w:50,h:30},{x:105,y:10,w:40,h:25}] },
];

function Cloud({ index, isDay, weatherType }: { index: number; speed: number; isDay: boolean; weatherType: string }) {
  // Fixed positions based on index - no randomness
  const positions = [
    { top: 5, duration: 200, delay: 0 },
    { top: 18, duration: 240, delay: -80 },
    { top: 8, duration: 180, delay: -40 },
    { top: 25, duration: 220, delay: -120 },
    { top: 12, duration: 260, delay: -160 },
    { top: 30, duration: 190, delay: -60 },
  ];

  const pos = positions[index % positions.length];
  const shape = cloudShapes[index % cloudShapes.length];
  const scale = 0.6 + (index % 3) * 0.25;

  const opacity = weatherType === 'cloudy' ? 0.9 : weatherType === 'rainy' || weatherType === 'stormy' ? 0.95 : 0.75;

  const cloudColor = isDay
    ? weatherType === 'rainy' || weatherType === 'stormy'
      ? 'rgb(156, 163, 175)'
      : 'rgb(255, 255, 255)'
    : 'rgb(120, 130, 145)';

  return (
    <div
      className="absolute left-0 animate-cloud-gentle"
      style={{
        top: `${pos.top}%`,
        animationDuration: `${pos.duration}s`,
        animationDelay: `${pos.delay}s`,
        opacity,
      }}
    >
      {/* Scale wrapper - separate from translation animation */}
      <div style={{ transform: `scale(${scale})` }}>
        <div className="relative" style={{ filter: 'blur(1px)' }}>
          {shape.puffs.map((puff, i) => (
            <div
              key={i}
              className="absolute rounded-full"
              style={{
                left: puff.x,
                top: puff.y,
                width: puff.w,
                height: puff.h,
                backgroundColor: cloudColor,
                boxShadow: isDay ? '0 4px 8px rgba(0,0,0,0.1)' : 'none',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// Pre-generated bird configurations for consistent positioning
const BIRD_CONFIGS = [
  { top: 8, duration: 45, delay: 0, scale: 0.5, mobileScale: 0.3, flapSpeed: 0.25 },
  { top: 15, duration: 55, delay: -20, scale: 0.42, mobileScale: 0.25, flapSpeed: 0.3 },
  { top: 22, duration: 40, delay: -35, scale: 0.55, mobileScale: 0.32, flapSpeed: 0.22 },
  { top: 12, duration: 50, delay: -15, scale: 0.45, mobileScale: 0.28, flapSpeed: 0.28 },
  { top: 28, duration: 60, delay: -40, scale: 0.4, mobileScale: 0.24, flapSpeed: 0.32 },
  { top: 18, duration: 48, delay: -25, scale: 0.52, mobileScale: 0.3, flapSpeed: 0.26 },
];

// Bird component - simple flying V-shape silhouette with prominent wings
function Bird({ index, fullscreen = false }: { index: number; fullscreen?: boolean }) {
  const config = BIRD_CONFIGS[index % BIRD_CONFIGS.length];
  // In fullscreen mode, birds fly lower (right above hills ~20-35%)
  const topPosition = fullscreen ? (20 + config.top * 0.5) : config.top;

  return (
    <div
      className="absolute animate-bird-fly"
      style={{
        top: `${topPosition}%`,
        animationDuration: `${config.duration}s`,
        animationDelay: `${config.delay}s`,
      }}
    >
      {/* Scale wrapper separate from flight animation */}
      <div className="bird-scale" style={{ '--bird-scale-sm': config.mobileScale, '--bird-scale-lg': config.scale } as React.CSSProperties}>
        {/* Bird - simple V-shape with flapping wings */}
        <div className="relative" style={{ width: '40px', height: '20px' }}>
          {/* Left wing - long and prominent */}
          <div
            className="absolute bg-gray-800 origin-right animate-wing-left"
            style={{
              width: '18px',
              height: '3px',
              left: '0px',
              top: '10px',
              borderRadius: '3px',
              animationDuration: `${config.flapSpeed}s`,
            }}
          />
          {/* Right wing - long and prominent */}
          <div
            className="absolute bg-gray-800 origin-left animate-wing-right"
            style={{
              width: '18px',
              height: '3px',
              left: '22px',
              top: '10px',
              borderRadius: '3px',
              animationDuration: `${config.flapSpeed}s`,
            }}
          />
          {/* Small body/center point */}
          <div
            className="absolute bg-gray-800 rounded-full"
            style={{
              width: '5px',
              height: '5px',
              left: '17px',
              top: '8px',
            }}
          />
        </div>
      </div>
    </div>
  );
}

// Moon component with accurate phase
function Moon() {
  const phase = getMoonPhase();
  const phaseName = getMoonPhaseName(phase);

  // Calculate the shadow position based on phase
  // phase 0 = new moon (fully dark), 0.5 = full moon (fully lit), 1 = new moon
  const isWaxing = phase < 0.5;
  const illumination = isWaxing ? phase * 2 : (1 - phase) * 2; // 0 to 1 to 0

  return (
    <div
      className="absolute top-[7%] right-[5%] w-12 h-12 sm:top-[8%] sm:right-[12%] sm:w-28 sm:h-28"
      title={phaseName}
    >
      <div className="relative w-full h-full">
        {/* Moon glow */}
        <div
          className="absolute inset-[-50%] rounded-full"
          style={{
            background: `radial-gradient(circle, rgba(255,255,255,${0.15 * illumination}) 0%, transparent 70%)`
          }}
        />

        {/* Moon base (lit portion) */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-gray-100 via-gray-200 to-gray-300" />

        {/* Moon craters (subtle) */}
        <div className="absolute top-[20%] left-[25%] w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-gray-300/40" />
        <div className="absolute top-[50%] left-[15%] w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-gray-300/30" />
        <div className="absolute top-[35%] right-[20%] w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 rounded-full bg-gray-300/25" />
        <div className="absolute top-[60%] right-[30%] w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-gray-300/35" />

        {/* Shadow overlay for phase */}
        {illumination < 0.97 && (
          <div
            className="absolute inset-0 rounded-full overflow-hidden"
            style={{
              background: isWaxing
                ? `linear-gradient(to right,
                    rgba(10,10,26,0.95) 0%,
                    rgba(10,10,26,0.95) ${(1 - illumination) * 100}%,
                    transparent ${(1 - illumination) * 100}%)`
                : `linear-gradient(to left,
                    rgba(10,10,26,0.95) 0%,
                    rgba(10,10,26,0.95) ${(1 - illumination) * 100}%,
                    transparent ${(1 - illumination) * 100}%)`
            }}
          />
        )}
      </div>
    </div>
  );
}

function Helicopter({ top, direction, drift, isDay }: { top: number; direction: number; drift: number; isDay: boolean }) {
  const bodyColor = isDay ? '#374151' : '#4b5563';
  const flipped = direction === -1;
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Smaller on mobile
  const scale = isMobile ? 0.18 : 0.45;

  return (
    <div
      className="absolute transition-all"
      style={{
        top: `${top}%`,
        animation: `heli-flyby 18s linear forwards`,
        animationDirection: flipped ? 'reverse' : 'normal',
      }}
    >
    {/* Outer wrapper applies vertical drift during flight */}
    <div style={{
      animation: `heli-drift 18s ease-in-out forwards`,
      ['--drift' as string]: `${drift}vh`,
    }}>
      <div style={{ transform: `scale(${scale})${flipped ? ' scaleX(-1)' : ''}` }}>
        <div className="relative" style={{ width: '80px', height: '40px' }}>
          {/* Main rotor - spinning */}
          <div
            style={{
              position: 'absolute',
              width: '70px',
              height: '3px',
              left: '5px',
              top: '2px',
              backgroundColor: bodyColor,
              borderRadius: '2px',
              transformOrigin: 'center center',
              animation: 'heli-rotor 0.15s linear infinite',
            }}
          />
          {/* Rotor mast */}
          <div
            style={{
              position: 'absolute',
              width: '3px',
              height: '6px',
              left: '38px',
              top: '3px',
              backgroundColor: bodyColor,
            }}
          />
          {/* Body / fuselage */}
          <div
            style={{
              position: 'absolute',
              width: '40px',
              height: '16px',
              left: '16px',
              top: '9px',
              backgroundColor: bodyColor,
              borderRadius: '8px 12px 6px 6px',
            }}
          />
          {/* Cockpit window */}
          <div
            style={{
              position: 'absolute',
              width: '10px',
              height: '8px',
              left: '44px',
              top: '11px',
              backgroundColor: isDay ? '#93c5fd' : '#60a5fa',
              borderRadius: '2px 6px 4px 2px',
              opacity: 0.8,
            }}
          />
          {/* Tail boom */}
          <div
            style={{
              position: 'absolute',
              width: '25px',
              height: '5px',
              left: '-5px',
              top: '14px',
              backgroundColor: bodyColor,
              clipPath: 'polygon(0% 0%, 100% 20%, 100% 80%, 0% 100%)',
            }}
          />
          {/* Tail rotor */}
          <div
            style={{
              position: 'absolute',
              width: '3px',
              height: '14px',
              left: '-7px',
              top: '10px',
              backgroundColor: bodyColor,
              borderRadius: '2px',
              transformOrigin: 'center center',
              animation: 'heli-rotor 0.1s linear infinite',
            }}
          />
          {/* Landing skids */}
          <div
            style={{
              position: 'absolute',
              width: '35px',
              height: '2px',
              left: '18px',
              top: '28px',
              backgroundColor: bodyColor,
              borderRadius: '1px',
            }}
          />
          {/* Skid struts */}
          <div
            style={{
              position: 'absolute',
              width: '2px',
              height: '5px',
              left: '24px',
              top: '24px',
              backgroundColor: bodyColor,
            }}
          />
          <div
            style={{
              position: 'absolute',
              width: '2px',
              height: '5px',
              left: '44px',
              top: '24px',
              backgroundColor: bodyColor,
            }}
          />
          {/* Red police light - left side of body */}
          <div
            style={{
              position: 'absolute',
              width: '4px',
              height: '4px',
              left: '22px',
              top: '8px',
              backgroundColor: '#ef4444',
              borderRadius: '50%',
              animation: 'heli-blink 0.6s ease-in-out infinite',
              boxShadow: isDay ? '0 0 4px 1px rgba(239,68,68,0.4)' : '0 0 8px 3px rgba(239,68,68,0.7)',
            }}
          />
          {/* Blue police light - right side of body */}
          <div
            style={{
              position: 'absolute',
              width: '4px',
              height: '4px',
              left: '46px',
              top: '8px',
              backgroundColor: '#3b82f6',
              borderRadius: '50%',
              animation: 'heli-blink 0.6s ease-in-out infinite',
              animationDelay: '0.3s',
              boxShadow: isDay ? '0 0 4px 1px rgba(59,130,246,0.4)' : '0 0 8px 3px rgba(59,130,246,0.7)',
            }}
          />
          {/* Tail nav light */}
          <div
            style={{
              position: 'absolute',
              width: '3px',
              height: '3px',
              left: '-5px',
              top: '12px',
              backgroundColor: '#ffffff',
              borderRadius: '50%',
              animation: 'heli-blink 1.2s ease-in-out infinite',
              boxShadow: '0 0 4px 1px rgba(255,255,255,0.5)',
            }}
          />
        </div>
      </div>
    </div>
    </div>
  );
}

function Contrail({ top, direction, speed, isDay }: { top: number; direction: number; speed: number; isDay: boolean }) {
  const goingRight = direction === 1;
  const [phase, setPhase] = useState<'flying' | 'fading'>('flying');

  useEffect(() => {
    // After plane finishes crossing, switch to fading phase
    const fadeTimer = setTimeout(() => {
      setPhase('fading');
    }, speed * 1000);

    return () => clearTimeout(fadeTimer);
  }, [speed]);

  // Slight angle as it crosses - opposite angles for opposite directions
  // Going right: slight upward angle (-8), Going left: slight upward angle (8)
  const angle = goingRight ? -8 : 8;

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        top: `${top}%`,
        left: goingRight ? '-5%' : 'auto',
        right: goingRight ? 'auto' : '-5%',
        transform: `rotate(${angle}deg)`,
        transformOrigin: goingRight ? 'left center' : 'right center',
        animation: goingRight
          ? `contrail-fly ${speed}s linear forwards`
          : `contrail-fly-reverse ${speed}s linear forwards`,
      }}
    >
      {/* Container for plane and trail - flip for right-to-left so plane leads */}
      <div className="relative" style={{ transform: goingRight ? 'none' : 'scaleX(-1)' }}>
        {/* Tiny distant plane - just a small bright dot/speck */}
        {phase === 'flying' && (
          <div
            className="absolute z-10"
            style={{
              width: '3px',
              height: '3px',
              backgroundColor: isDay ? '#ffffff' : '#d0d0d0',
              borderRadius: '50%',
              boxShadow: isDay
                ? '0 0 3px 2px rgba(255,255,255,0.7)'
                : '0 0 3px 2px rgba(180,180,180,0.5)',
              right: 0,
              top: '50%',
              transform: 'translateY(-50%)',
            }}
          />
        )}

        {/* Contrail - fading trail behind the plane */}
        <div
          className="absolute"
          style={{
            right: '4px',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '250px',
            height: '4px',
            background: isDay
              ? 'linear-gradient(to left, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.4) 40%, rgba(255,255,255,0.15) 80%, transparent 100%)'
              : 'linear-gradient(to left, rgba(200,200,200,0.5) 0%, rgba(200,200,200,0.25) 40%, rgba(200,200,200,0.08) 80%, transparent 100%)',
            borderRadius: '2px',
            opacity: phase === 'fading' ? 0 : 1,
            transition: phase === 'fading' ? 'opacity 150s ease-out' : 'none',
          }}
        />

        {/* Secondary contrail line (twin engine effect) */}
        <div
          className="absolute"
          style={{
            right: '4px',
            top: '50%',
            transform: 'translateY(-50%) translateY(6px)',
            width: '220px',
            height: '3px',
            background: isDay
              ? 'linear-gradient(to left, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.25) 40%, transparent 80%)'
              : 'linear-gradient(to left, rgba(200,200,200,0.35) 0%, rgba(200,200,200,0.15) 40%, transparent 80%)',
            borderRadius: '2px',
            opacity: phase === 'fading' ? 0 : 1,
            transition: phase === 'fading' ? 'opacity 150s ease-out' : 'none',
          }}
        />
      </div>
    </div>
  );
}

function HoveringHelicopter({ top, left, phase, isDay, fullscreen = false, fromDirection }: { top: number; left: number; phase: 'enter' | 'hover' | 'exit'; isDay: boolean; fullscreen?: boolean; fromDirection: 'left' | 'right' }) {
  const bodyColor = isDay ? '#374151' : '#4b5563';
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);
  const [hasStarted, setHasStarted] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Trigger the enter animation after component mounts
  useEffect(() => {
    const timer = setTimeout(() => setHasStarted(true), 50);
    return () => clearTimeout(timer);
  }, []);

  // Mobile: much smaller (0.12), Desktop non-fullscreen: 0.28, Fullscreen: 0.4
  const scale = isMobile ? 0.12 : fullscreen ? 0.4 : 0.28;

  // Flip helicopter based on direction it's coming from
  // When entering from left, face right. When exiting (always to right), face right.
  // When entering from right, face left. When exiting, flip to face right.
  const flipped = fromDirection === 'right' && phase !== 'exit';

  // Calculate position based on phase and animation state
  const getLeftPosition = () => {
    if (phase === 'enter') {
      if (!hasStarted) {
        // Initial position: off-screen
        return fromDirection === 'left' ? '-100px' : 'calc(100vw + 100px)';
      }
      // After starting: animate to hover position
      return `${left}vw`;
    } else if (phase === 'hover') {
      return `${left}vw`;
    } else {
      // Exit phase - fly off to the right
      return 'calc(100vw + 100px)';
    }
  };

  // Get transition based on phase
  const getTransition = () => {
    if (phase === 'enter' && hasStarted) {
      return 'left 8s ease-out';
    } else if (phase === 'exit') {
      return 'left 10s linear';
    }
    return 'none';
  };

  return (
    <div
      className="absolute"
      style={{
        top: `${top}%`,
        left: getLeftPosition(),
        transition: getTransition(),
      }}
    >
      {/* Gentle hover bob animation */}
      <div
        className={phase === 'hover' ? 'animate-hover-bob' : ''}
        style={{ transform: `scale(${scale})${flipped ? ' scaleX(-1)' : ''}` }}
      >
        <div className="relative" style={{ width: '80px', height: '40px' }}>
          {/* Main rotor - spinning */}
          <div
            style={{
              position: 'absolute',
              width: '70px',
              height: '3px',
              left: '5px',
              top: '2px',
              backgroundColor: bodyColor,
              borderRadius: '2px',
              transformOrigin: 'center center',
              animation: 'heli-rotor 0.15s linear infinite',
            }}
          />
          {/* Rotor mast */}
          <div
            style={{
              position: 'absolute',
              width: '3px',
              height: '6px',
              left: '38px',
              top: '3px',
              backgroundColor: bodyColor,
            }}
          />
          {/* Body / fuselage */}
          <div
            style={{
              position: 'absolute',
              width: '40px',
              height: '16px',
              left: '16px',
              top: '9px',
              backgroundColor: bodyColor,
              borderRadius: '8px 12px 6px 6px',
            }}
          />
          {/* Cockpit window */}
          <div
            style={{
              position: 'absolute',
              width: '10px',
              height: '8px',
              left: '44px',
              top: '11px',
              backgroundColor: isDay ? '#93c5fd' : '#60a5fa',
              borderRadius: '2px 6px 4px 2px',
              opacity: 0.8,
            }}
          />
          {/* Tail boom */}
          <div
            style={{
              position: 'absolute',
              width: '25px',
              height: '5px',
              left: '-5px',
              top: '14px',
              backgroundColor: bodyColor,
              clipPath: 'polygon(0% 0%, 100% 20%, 100% 80%, 0% 100%)',
            }}
          />
          {/* Tail rotor */}
          <div
            style={{
              position: 'absolute',
              width: '3px',
              height: '14px',
              left: '-7px',
              top: '10px',
              backgroundColor: bodyColor,
              borderRadius: '2px',
              transformOrigin: 'center center',
              animation: 'heli-rotor 0.1s linear infinite',
            }}
          />
          {/* Landing skids */}
          <div
            style={{
              position: 'absolute',
              width: '35px',
              height: '2px',
              left: '18px',
              top: '28px',
              backgroundColor: bodyColor,
              borderRadius: '1px',
            }}
          />
          {/* Skid struts */}
          <div
            style={{
              position: 'absolute',
              width: '2px',
              height: '5px',
              left: '24px',
              top: '24px',
              backgroundColor: bodyColor,
            }}
          />
          <div
            style={{
              position: 'absolute',
              width: '2px',
              height: '5px',
              left: '44px',
              top: '24px',
              backgroundColor: bodyColor,
            }}
          />
          {/* Red police light - left side of body */}
          <div
            style={{
              position: 'absolute',
              width: '4px',
              height: '4px',
              left: '22px',
              top: '8px',
              backgroundColor: '#ef4444',
              borderRadius: '50%',
              animation: 'heli-blink 0.6s ease-in-out infinite',
              boxShadow: isDay ? '0 0 4px 1px rgba(239,68,68,0.4)' : '0 0 8px 3px rgba(239,68,68,0.7)',
            }}
          />
          {/* Blue police light - right side of body */}
          <div
            style={{
              position: 'absolute',
              width: '4px',
              height: '4px',
              left: '46px',
              top: '8px',
              backgroundColor: '#3b82f6',
              borderRadius: '50%',
              animation: 'heli-blink 0.6s ease-in-out infinite',
              animationDelay: '0.3s',
              boxShadow: isDay ? '0 0 4px 1px rgba(59,130,246,0.4)' : '0 0 8px 3px rgba(59,130,246,0.7)',
            }}
          />
          {/* Tail nav light */}
          <div
            style={{
              position: 'absolute',
              width: '3px',
              height: '3px',
              left: '-5px',
              top: '12px',
              backgroundColor: '#ffffff',
              borderRadius: '50%',
              animation: 'heli-blink 1.2s ease-in-out infinite',
              boxShadow: '0 0 4px 1px rgba(255,255,255,0.5)',
            }}
          />
        </div>
      </div>
    </div>
  );
}

function HillsPhoto({ isDay, fullscreen = false }: { isDay: boolean; fullscreen?: boolean }) {
  // PNG images with sky already removed (transparent). Only need a subtle
  // bottom fade so hills blend into the content below.
  const maskGradient = 'linear-gradient(to bottom, black 0%, black 75%, transparent 100%)';

  return (
    <>
      <div
        className={`absolute left-0 right-0 pointer-events-none overflow-hidden ${
          fullscreen
            ? 'top-[28%] h-[28%]'
            : 'top-[12%] h-[22%] sm:top-[10%] sm:h-[28%]'
        }`}
        style={{ zIndex: 2 }}
      >
        {/* Day hills (transparent sky PNG) - no stretching, maintain quality */}
        <img
          src="/hills-day.png?v=2"
          alt=""
          className={`absolute left-0 transition-opacity duration-[3000ms] origin-bottom ${
            fullscreen ? 'scale-100' : 'scale-[3] sm:scale-100'
          }`}
          style={{
            opacity: isDay ? 0.85 : 0,
            width: '100vw',
            height: 'auto',
            bottom: 0,
            maskImage: maskGradient,
            WebkitMaskImage: maskGradient,
          }}
        />
        {/* Night hills (transparent sky PNG) */}
        <img
          src="/hills-night.png?v=3"
          alt=""
          className={`absolute left-0 transition-opacity duration-[3000ms] origin-bottom ${
            fullscreen ? 'scale-100' : 'scale-[3] sm:scale-100'
          }`}
          style={{
            opacity: isDay ? 0 : 0.85,
            width: '100vw',
            height: 'auto',
            bottom: 0,
            maskImage: maskGradient,
            WebkitMaskImage: maskGradient,
          }}
        />
      </div>

      {/* Hollywood Sign - desktop only, positioned on the hillside */}
      <div
        className={`absolute pointer-events-none hidden sm:block ${
          fullscreen ? 'top-[42%] right-[6%]' : 'top-[24%] right-[4%]'
        }`}
        style={{ zIndex: 3 }}
      >
        <div
          className="flex transition-opacity duration-[3000ms]"
          style={{
            opacity: isDay ? 0.85 : 0.35,
            transform: fullscreen ? 'scale(0.5)' : 'scale(0.28)',
            transformOrigin: 'top right',
          }}
        >
          {['H', 'O', 'L', 'L', 'Y', 'W', 'O', 'O', 'D'].map((letter, i) => (
            <div
              key={i}
              style={{
                fontSize: '32px',
                fontFamily: 'Arial Narrow, Arial, sans-serif',
                fontWeight: 400,
                fontStretch: 'condensed',
                color: isDay ? '#f5f5f5' : '#a0a0a0',
                letterSpacing: '1px',
                textShadow: isDay
                  ? '0 1px 1px rgba(0,0,0,0.2)'
                  : '0 0 3px rgba(255,255,255,0.2)',
                marginRight: '2px',
              }}
            >
              {letter}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
