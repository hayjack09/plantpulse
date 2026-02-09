import { useState, useEffect, useMemo, useCallback } from 'react';
import { X, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { SensorData } from '../types/ecowitt';

type TimePeriod = '1h' | '24h' | '7d' | '30d' | '1y';

interface HistoryModalProps {
  sensor: SensorData;
  sensorName: string;
  isOpen: boolean;
  onClose: () => void;
}

interface HistoryDataPoint {
  timestamp: string;
  moisture: number;
  label: string;
}

interface ChartDataPoint {
  time: number; // Unix timestamp in ms for true time scale
  moisture: number | null; // null for gaps
  timestamp: string;
}

// Custom tooltip component for high-fidelity display
function CustomTooltip({ active, payload, period }: any) {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0].payload as ChartDataPoint;
  const date = new Date(data.time);

  // Format based on period
  let dateStr: string;
  if (period === '1h') {
    dateStr = date.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } else if (period === '24h') {
    dateStr = date.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } else if (period === '7d') {
    dateStr = date.toLocaleString([], {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } else {
    dateStr = date.toLocaleString([], {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return (
    <div className="bg-white border-2 border-bhh-green rounded-lg shadow-xl px-3 py-2 min-w-[160px]">
      <div className="text-xs text-gray-500 mb-1">{dateStr}</div>
      <div className="flex items-baseline gap-2">
        <span className="text-lg font-bold text-bhh-green">
          {data.moisture !== null ? `${data.moisture}%` : '—'}
        </span>
        <span className="text-xs text-gray-400">moisture</span>
      </div>
    </div>
  );
}

// Custom cursor (vertical crosshair line)
function CustomCursor({ points, height }: any) {
  if (!points || !points.length) return null;
  const { x } = points[0];
  return (
    <line
      x1={x}
      y1={0}
      x2={x}
      y2={height}
      stroke="#1D6F42"
      strokeWidth={1}
      strokeDasharray="4 2"
      opacity={0.6}
    />
  );
}

// Get the start of the current clock hour
function getHourStart(date: Date): Date {
  const d = new Date(date);
  d.setMinutes(0, 0, 0);
  return d;
}

// Format hour range for display: "9:00 PM – 10:00 PM"
function formatHourRange(hourStart: Date): string {
  const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000);
  const fmt = (d: Date) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const datePart = hourStart.toLocaleDateString([], { month: 'short', day: 'numeric' });
  return `${datePart}, ${fmt(hourStart)} – ${fmt(hourEnd)}`;
}

export function HistoryModal({ sensor, sensorName, isOpen, onClose }: HistoryModalProps) {
  const [period, setPeriod] = useState<TimePeriod>('24h');
  const [rawData, setRawData] = useState<HistoryDataPoint[]>([]);
  const [loading, setLoading] = useState(false);
  // For hourly view: which clock-hour block to show
  const [hourAnchor, setHourAnchor] = useState<Date>(() => getHourStart(new Date()));

  // Reset hour anchor when switching to hourly or when modal opens
  useEffect(() => {
    if (period === '1h') {
      setHourAnchor(getHourStart(new Date()));
    }
  }, [period]);

  // For hourly mode, the server returns 24h of minute-level local data so we can slice any hour
  const apiPeriod = period === '1h' ? '1h' : period;

  useEffect(() => {
    if (!isOpen) return;

    const fetchHistory = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/sensors/${sensor.id}/history?period=${apiPeriod}`);
        const result = await response.json();
        setRawData(result.data || []);
      } catch (err) {
        console.error('Failed to fetch history:', err);
        setRawData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [sensor.id, apiPeriod, isOpen]);

  // Convert to chart data with numeric timestamps and gap detection
  const chartData = useMemo(() => {
    if (rawData.length === 0) return [];

    // For hourly mode, filter to the selected hour block
    let dataToProcess = rawData;
    if (period === '1h') {
      const hourStart = hourAnchor.getTime();
      const hourEnd = hourStart + 60 * 60 * 1000;
      dataToProcess = rawData.filter(d => {
        const t = new Date(d.timestamp).getTime();
        return t >= hourStart && t < hourEnd;
      });
    }

    if (dataToProcess.length === 0) return [];

    // Expected interval based on period (in ms)
    const expectedInterval = period === '24h' ? 5 * 60 * 1000 : // 5 min
                             period === '7d' ? 30 * 60 * 1000 : // 30 min
                             period === '30d' ? 2 * 60 * 60 * 1000 : // 2 hours
                             24 * 60 * 60 * 1000; // 1 day for annual

    const gapThreshold = expectedInterval * 2.5; // Gap if more than 2.5x expected

    const result: ChartDataPoint[] = [];

    for (let i = 0; i < dataToProcess.length; i++) {
      const point = dataToProcess[i];
      const time = new Date(point.timestamp).getTime();

      // Check for gap before this point (skip for hourly — always connect the line)
      if (period !== '1h' && i > 0) {
        const prevTime = new Date(dataToProcess[i - 1].timestamp).getTime();
        if (time - prevTime > gapThreshold) {
          result.push({
            time: prevTime + (time - prevTime) / 2,
            moisture: null,
            timestamp: '',
          });
        }
      }

      result.push({
        time,
        moisture: point.moisture,
        timestamp: point.timestamp,
      });
    }

    return result;
  }, [rawData, period, hourAnchor]);

  // Calculate time domain for X-axis
  const timeDomain = useMemo(() => {
    if (period === '1h') {
      // Always show the full clock hour
      const start = hourAnchor.getTime();
      return [start, start + 60 * 60 * 1000];
    }
    if (chartData.length === 0) return [0, 1];
    const times = chartData.filter(d => d.moisture !== null).map(d => d.time);
    return [Math.min(...times), Math.max(...times)];
  }, [chartData, period, hourAnchor]);

  // Generate tick values for X-axis based on period - limit to 5-6 readable labels
  const xAxisTicks = useMemo(() => {
    const [minTime, maxTime] = timeDomain;
    if (minTime === maxTime) return [minTime];

    const ticks: number[] = [];

    if (period === '1h') {
      // Ticks every 5 minutes = 12 labels for granular view
      const interval = 5 * 60 * 1000;
      const start = Math.ceil(minTime / interval) * interval;
      for (let t = start; t <= maxTime; t += interval) {
        ticks.push(t);
      }
    } else if (period === '24h') {
      // Ticks every 4 hours = 6 labels max
      const interval = 4 * 60 * 60 * 1000;
      const start = Math.ceil(minTime / interval) * interval;
      for (let t = start; t <= maxTime; t += interval) {
        ticks.push(t);
      }
    } else if (period === '7d') {
      // Ticks every 2 days = ~4 labels
      const interval = 2 * 24 * 60 * 60 * 1000;
      const startDate = new Date(minTime);
      startDate.setHours(0, 0, 0, 0);
      let t = startDate.getTime();
      if (t < minTime) t += 24 * 60 * 60 * 1000;
      for (; t <= maxTime; t += interval) {
        ticks.push(t);
      }
    } else if (period === '30d') {
      // Ticks every 7 days = ~4-5 labels
      const interval = 7 * 24 * 60 * 60 * 1000;
      const startDate = new Date(minTime);
      startDate.setHours(0, 0, 0, 0);
      let t = startDate.getTime();
      if (t < minTime) t += 24 * 60 * 60 * 1000;
      for (; t <= maxTime; t += interval) {
        ticks.push(t);
      }
    } else {
      // Annual: ticks every 2-3 months
      const startDate = new Date(minTime);
      startDate.setDate(1);
      startDate.setHours(0, 0, 0, 0);
      let current = new Date(startDate);
      let count = 0;
      while (current.getTime() <= maxTime) {
        if (current.getTime() >= minTime && count % 2 === 0) {
          ticks.push(current.getTime());
        }
        current.setMonth(current.getMonth() + 1);
        count++;
      }
    }

    // Ensure we never have more than 6 ticks (except hourly which needs 12)
    const maxTicks = period === '1h' ? 13 : 6;
    if (ticks.length > maxTicks) {
      const step = Math.ceil(ticks.length / (maxTicks - 1));
      return ticks.filter((_, i) => i % step === 0);
    }

    return ticks;
  }, [timeDomain, period]);

  // X-axis tick formatter
  const formatXTick = useCallback((value: number) => {
    const date = new Date(value);
    if (period === '1h') {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (period === '24h') {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (period === '7d') {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } else if (period === '30d') {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } else {
      return date.toLocaleDateString([], { month: 'short', year: '2-digit' });
    }
  }, [period]);

  // Y-axis domain and ticks - for 24h, zoom in on actual data range
  const yAxisConfig = useMemo(() => {
    if ((period !== '1h' && period !== '24h') || chartData.length === 0) {
      // For longer periods, use full 0-100 scale
      return {
        domain: [0, 100] as [number, number],
        ticks: [0, 20, 40, 60, 80, 100],
      };
    }

    // For 24h, calculate a zoomed-in range based on actual data
    const values = chartData.filter(d => d.moisture !== null).map(d => d.moisture as number);
    if (values.length === 0) {
      return { domain: [0, 100] as [number, number], ticks: [0, 20, 40, 60, 80, 100] };
    }

    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const range = maxVal - minVal;

    // Add padding: at least 5% above and below, or enough to show ~6 tick marks
    const padding = Math.max(range * 0.2, 3); // At least 3% padding
    let yMin = Math.floor((minVal - padding) / 5) * 5; // Round down to nearest 5
    let yMax = Math.ceil((maxVal + padding) / 5) * 5;  // Round up to nearest 5

    // Ensure we have at least a 10% range for visibility
    if (yMax - yMin < 10) {
      const center = (yMin + yMax) / 2;
      yMin = Math.floor(center - 5);
      yMax = Math.ceil(center + 5);
    }

    // Clamp to valid percentages
    yMin = Math.max(0, yMin);
    yMax = Math.min(100, yMax);

    // Generate ~5-6 ticks within range
    const tickInterval = Math.ceil((yMax - yMin) / 5);
    const ticks: number[] = [];
    for (let t = yMin; t <= yMax; t += tickInterval) {
      ticks.push(t);
    }
    if (ticks[ticks.length - 1] < yMax) {
      ticks.push(yMax);
    }

    return { domain: [yMin, yMax] as [number, number], ticks };
  }, [chartData, period]);

  // Calculate stats
  const stats = useMemo(() => {
    const values = chartData.filter(d => d.moisture !== null).map(d => d.moisture as number);
    if (values.length === 0) return null;
    return {
      min: Math.min(...values),
      max: Math.max(...values),
      avg: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
      current: values[values.length - 1],
    };
  }, [chartData]);

  if (!isOpen) return null;

  const periods: { value: TimePeriod; label: string }[] = [
    { value: '1h', label: 'Hourly' },
    { value: '24h', label: '24h' },
    { value: '7d', label: '7d' },
    { value: '30d', label: '30d' },
    { value: '1y', label: 'Annual' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-bhh-green to-bhh-green-light px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Calendar className="w-6 h-6 text-white" />
            <h2 className="text-xl font-display font-bold text-white drop-shadow">
              {sensorName} History
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-white/70 hover:text-white hover:bg-white/20 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Period tabs + Stats */}
        <div className="px-6 py-3 bg-bhh-cream border-b border-bhh-pink/20">
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              {periods.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setPeriod(p.value)}
                  className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                    period === p.value
                      ? 'bg-bhh-green text-white shadow-lg'
                      : 'bg-white text-bhh-green hover:bg-bhh-pink-light'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {stats && (
              <div className="flex gap-4 text-sm">
                <div className="text-gray-500">
                  Min: <span className="font-semibold text-bhh-green">{stats.min}%</span>
                </div>
                <div className="text-gray-500">
                  Max: <span className="font-semibold text-bhh-green">{stats.max}%</span>
                </div>
                <div className="text-gray-500">
                  Avg: <span className="font-semibold text-bhh-green">{stats.avg}%</span>
                </div>
              </div>
            )}
          </div>

          {/* Hourly navigation */}
          {period === '1h' && (
            <div className="flex items-center justify-center gap-3 mt-3">
              <button
                onClick={() => setHourAnchor(prev => {
                  const d = new Date(prev);
                  d.setHours(d.getHours() - 1);
                  return d;
                })}
                className="p-1.5 bg-bhh-green text-white rounded-lg hover:bg-bhh-green-dark transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-sm font-semibold text-gray-700 min-w-[220px] text-center">
                {formatHourRange(hourAnchor)}
              </span>
              <button
                onClick={() => setHourAnchor(prev => {
                  const d = new Date(prev);
                  d.setHours(d.getHours() + 1);
                  // Don't go past current hour
                  const currentHour = getHourStart(new Date());
                  return d > currentHour ? currentHour : d;
                })}
                disabled={hourAnchor.getTime() >= getHourStart(new Date()).getTime()}
                className="p-1.5 bg-bhh-green text-white rounded-lg hover:bg-bhh-green-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>

        {/* Chart area */}
        <div className="p-6 bg-white">
          {loading ? (
            <div className="h-[400px] flex items-center justify-center">
              <div className="w-12 h-12 border-4 border-bhh-green border-t-transparent rounded-full animate-spin" />
            </div>
          ) : chartData.length === 0 ? (
            <div className="h-[400px] flex flex-col items-center justify-center text-bhh-pink-dark">
              <Calendar className="w-16 h-16 opacity-30 mb-4" />
              <p className="font-semibold">No historical data available</p>
              <p className="text-sm opacity-70">Data will appear as the sensor collects readings</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={400}>
              <LineChart
                data={chartData}
                margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
              >
                {/* Grid lines */}
                <CartesianGrid
                  strokeDasharray="1 0"
                  stroke="#E5E7EB"
                  strokeOpacity={0.8}
                  vertical={false}
                />

                {/* Secondary vertical grid at tick positions */}
                {xAxisTicks.map((tick) => (
                  <ReferenceLine
                    key={tick}
                    x={tick}
                    stroke="#E5E7EB"
                    strokeDasharray="2 4"
                    strokeOpacity={0.5}
                  />
                ))}

                {/* X-Axis: True time scale */}
                <XAxis
                  dataKey="time"
                  type="number"
                  domain={timeDomain}
                  scale="time"
                  ticks={xAxisTicks}
                  tickFormatter={formatXTick}
                  stroke="#6B7280"
                  fontSize={12}
                  tickLine={{ stroke: '#9CA3AF', strokeWidth: 1 }}
                  axisLine={{ stroke: '#D1D5DB', strokeWidth: 1 }}
                  tick={{ fill: '#374151' }}
                  tickMargin={10}
                />

                {/* Y-Axis: Dynamic for 24h, fixed 0-100 for longer periods */}
                <YAxis
                  domain={yAxisConfig.domain}
                  ticks={yAxisConfig.ticks}
                  stroke="#6B7280"
                  fontSize={11}
                  tickLine={{ stroke: '#9CA3AF', strokeWidth: 1 }}
                  axisLine={{ stroke: '#D1D5DB', strokeWidth: 1 }}
                  tickFormatter={(value) => `${value}%`}
                  tick={{ fill: '#374151' }}
                  width={45}
                />

                {/* Tooltip with crosshair */}
                <Tooltip
                  content={<CustomTooltip period={period} />}
                  cursor={<CustomCursor />}
                  isAnimationActive={false}
                />

                {/* Data line */}
                <Line
                  type="monotone"
                  dataKey="moisture"
                  stroke="#1D6F42"
                  strokeWidth={2}
                  dot={period === '1h' ? {
                    fill: '#1D6F42',
                    stroke: '#fff',
                    strokeWidth: 2,
                    r: 3,
                  } : false}
                  activeDot={{
                    fill: '#1D6F42',
                    stroke: '#fff',
                    strokeWidth: 2,
                    r: 5,
                  }}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-bhh-cream/50 border-t border-bhh-pink/10 flex justify-between items-center">
          <span className="text-sm text-gray-500">
            {sensor.sensorKey} • {sensor.accountId === 'account1' ? 'Hub 1' : 'Hub 2'}
            {chartData.length > 0 && (
              <span className="ml-2 text-gray-400">
                • {chartData.filter(d => d.moisture !== null).length} data points
              </span>
            )}
          </span>
          <span className="text-sm font-semibold text-bhh-green">
            Current: {sensor.moisture}%
          </span>
        </div>
      </div>
    </div>
  );
}
