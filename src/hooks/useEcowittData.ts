import { useState, useEffect, useCallback, useRef } from 'react';
import { SensorData, SensorResponse } from '../types/ecowitt';
import { fetchSensors } from '../lib/api';

interface UseEcowittDataResult {
  sensors: SensorData[];
  loading: boolean;
  error: string | null;
  lastUpdated: string | null;
  refresh: () => Promise<void>;
}

interface PlantThreshold {
  min: number;
  max: number;
}

interface PlantSettings {
  names: Record<string, string>;
  colors: Record<string, string>;
  order: string[];
  hidden: string[];
  thresholds: Record<string, PlantThreshold>;
}

// Fetch settings from server
async function fetchSettings(): Promise<PlantSettings> {
  try {
    const res = await fetch('/api/settings');
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.error('Error fetching settings:', err);
  }
  return { names: {}, colors: {}, order: [], hidden: [], thresholds: {} };
}

export function useEcowittData(): UseEcowittDataResult {
  const [sensors, setSensors] = useState<SensorData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const refreshingRef = useRef(false);
  const hasLoadedRef = useRef(false);

  const refresh = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;

    try {
      if (!hasLoadedRef.current) {
        setLoading(true);
      }
      const data: SensorResponse = await fetchSensors();
      // Update sensors if we got data (keep prev only if response is empty)
      if (data.sensors.length > 0) {
        setSensors(data.sensors);
      }
      setLastUpdated(data.lastUpdated);
      setError(null);
      hasLoadedRef.current = true;

      if (data.errors && data.errors.length > 0) {
        console.warn('Some accounts had errors:', data.errors);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
      refreshingRef.current = false;
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Poll for new data every 10 seconds unconditionally
  useEffect(() => {
    const pollTimer = setInterval(() => {
      if (!refreshingRef.current) {
        refresh();
      }
    }, 10000);
    return () => clearInterval(pollTimer);
  }, [refresh]);

  return { sensors, loading, error, lastUpdated, refresh };
}

export function usePlantNames() {
  const [names, setNames] = useState<Record<string, string>>({});
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    fetchSettings().then(settings => {
      setNames(settings.names || {});
      setIsLoaded(true);
    });
  }, []);

  const updateName = useCallback((sensorId: string, name: string) => {
    setNames(prev => {
      const updated = { ...prev, [sensorId]: name };
      // Save to server
      fetch('/api/settings/name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sensorId, name }),
      }).catch(err => console.error('Error saving name:', err));
      return updated;
    });
  }, []);

  const getName = useCallback((sensorId: string, index: number): string => {
    return names[sensorId] || `Plant ${index + 1}`;
  }, [names]);

  return { names, updateName, getName, isLoaded };
}

export function useSensorOrder() {
  const [order, setOrder] = useState<string[]>([]);

  useEffect(() => {
    fetchSettings().then(settings => {
      setOrder(settings.order || []);
    });
  }, []);

  const updateOrder = useCallback((newOrder: string[]) => {
    setOrder(newOrder);
    // Save to server
    fetch('/api/settings/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order: newOrder }),
    }).catch(err => console.error('Error saving order:', err));
  }, []);

  const sortSensors = useCallback((sensors: SensorData[]): SensorData[] => {
    if (order.length === 0) return sensors;
    const sensorMap = new Map(sensors.map(s => [s.id, s]));
    const sorted: SensorData[] = [];
    for (const id of order) {
      const sensor = sensorMap.get(id);
      if (sensor) {
        sorted.push(sensor);
        sensorMap.delete(id);
      }
    }
    for (const sensor of sensorMap.values()) {
      sorted.push(sensor);
    }
    return sorted;
  }, [order]);

  return { order, updateOrder, sortSensors };
}

export function useHiddenSensors() {
  const [hidden, setHidden] = useState<string[]>([]);

  useEffect(() => {
    fetchSettings().then(settings => {
      setHidden(settings.hidden || []);
    });
  }, []);

  const hideSensor = useCallback((sensorId: string) => {
    setHidden(prev => {
      const updated = [...prev, sensorId];
      // Save to server
      fetch('/api/settings/hidden', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hidden: updated }),
      }).catch(err => console.error('Error saving hidden:', err));
      return updated;
    });
  }, []);

  const unhideSensor = useCallback((sensorId: string) => {
    setHidden(prev => {
      const updated = prev.filter(id => id !== sensorId);
      // Save to server
      fetch('/api/settings/hidden', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hidden: updated }),
      }).catch(err => console.error('Error saving hidden:', err));
      return updated;
    });
  }, []);

  const isHidden = useCallback((sensorId: string): boolean => {
    return hidden.includes(sensorId);
  }, [hidden]);

  return { hidden, hideSensor, unhideSensor, isHidden };
}

export function usePlantColors() {
  const [colors, setColors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchSettings().then(settings => {
      setColors(settings.colors || {});
    });
  }, []);

  const updateColor = useCallback((sensorId: string, color: string) => {
    setColors(prev => {
      const updated = { ...prev, [sensorId]: color };
      // Save to server
      fetch('/api/settings/color', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sensorId, color }),
      }).catch(err => console.error('Error saving color:', err));
      return updated;
    });
  }, []);

  const getColor = useCallback((sensorId: string): string => {
    return colors[sensorId] || 'green';
  }, [colors]);

  return { colors, updateColor, getColor };
}

// Default thresholds
const DEFAULT_THRESHOLD = { min: 30, max: 70 };

export function usePlantThresholds() {
  const [thresholds, setThresholds] = useState<Record<string, PlantThreshold>>({});

  useEffect(() => {
    fetchSettings().then(settings => {
      setThresholds(settings.thresholds || {});
    });
  }, []);

  const updateThreshold = useCallback((sensorId: string, min: number, max: number) => {
    setThresholds(prev => {
      const updated = { ...prev, [sensorId]: { min, max } };
      // Save to server
      fetch('/api/settings/threshold', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sensorId, min, max }),
      }).catch(err => console.error('Error saving threshold:', err));
      return updated;
    });
  }, []);

  const getThreshold = useCallback((sensorId: string): PlantThreshold => {
    return thresholds[sensorId] || DEFAULT_THRESHOLD;
  }, [thresholds]);

  const getMoistureStatus = useCallback((sensorId: string, moisture: number): 'dry' | 'ok' | 'wet' => {
    const { min, max } = getThreshold(sensorId);
    if (moisture < min) return 'dry';
    if (moisture > max) return 'wet';
    return 'ok';
  }, [getThreshold]);

  return { thresholds, updateThreshold, getThreshold, getMoistureStatus };
}
