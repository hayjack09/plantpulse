import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

// Setup for storing historical data
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const HISTORY_FILE = path.join(__dirname, 'sensor_history.json');
const SETTINGS_FILE = path.join(__dirname, 'plant_settings.json');

// Load existing history or create empty structure
function loadHistory() {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'));
    }
  } catch (err) {
    console.error('Error loading history:', err);
  }
  return {};
}

// Load plant settings
function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
      // Ensure thresholds exists for backwards compatibility
      if (!settings.thresholds) settings.thresholds = {};
      return settings;
    }
  } catch (err) {
    console.error('Error loading settings:', err);
  }
  return { names: {}, colors: {}, order: [], hidden: [], thresholds: {} };
}

// Save plant settings
function saveSettings(settings) {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
  } catch (err) {
    console.error('Error saving settings:', err);
  }
}

// Save history to file
function saveHistory(history) {
  try {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
  } catch (err) {
    console.error('Error saving history:', err);
  }
}

// Store a sensor reading
function storeReading(sensorId, moisture, timestamp) {
  const history = loadHistory();
  if (!history[sensorId]) {
    history[sensorId] = [];
  }

  history[sensorId].push({
    moisture,
    timestamp,
  });

  // Keep only last 365 days of data (at 1 reading per minute = ~525,600 readings max)
  // But realistically we read every minute, so keep last 50,000 readings (~35 days)
  if (history[sensorId].length > 50000) {
    history[sensorId] = history[sensorId].slice(-50000);
  }

  saveHistory(history);
}

// Get historical readings for a sensor
function getHistory(sensorId, period) {
  const history = loadHistory();
  const readings = history[sensorId] || [];

  if (readings.length === 0) {
    return [];
  }

  const now = new Date();
  let cutoffTime;
  let labelFormat;

  switch (period) {
    case '1h':
      // Return full 24h of local data at full resolution so frontend can slice any hour
      cutoffTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      labelFormat = (d) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      break;
    case '24h':
      cutoffTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      labelFormat = (d) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      break;
    case '7d':
      cutoffTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      labelFormat = (d) => d.toLocaleDateString([], { weekday: 'short', hour: '2-digit' });
      break;
    case '30d':
      cutoffTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      labelFormat = (d) => d.toLocaleDateString([], { month: 'short', day: 'numeric' });
      break;
    case '1y':
      cutoffTime = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      labelFormat = (d) => d.toLocaleDateString([], { month: 'long' });
      break;
    default:
      cutoffTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      labelFormat = (d) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  // Filter readings within the time period
  const filtered = readings.filter(r => new Date(r.timestamp) >= cutoffTime);

  // Reduce data points for display (too many points = slow chart)
  // For 24h: ~1440 readings, show every 5th (~288 points)
  // For 7d: ~10080 readings, show every 60th (~168 points)
  // For 30d: ~43200 readings, show every 360th (~120 points)
  // For 1y: show every 1440th (~365 points)
  let skipFactor = 1;
  if (period === '1h') skipFactor = 1; // Every reading (~60 points)
  else if (period === '24h') skipFactor = 5;
  else if (period === '7d') skipFactor = 60;
  else if (period === '30d') skipFactor = 360;
  else if (period === '1y') skipFactor = 1440;

  let reduced = filtered.filter((_, i) => i % skipFactor === 0);

  // For hourly view, deduplicate to one reading per minute and sort chronologically
  if (period === '1h') {
    const seen = new Map();
    for (const r of reduced) {
      const d = new Date(r.timestamp);
      // Key by minute (ignore seconds/ms)
      const minuteKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}-${d.getMinutes()}`;
      if (!seen.has(minuteKey)) {
        seen.set(minuteKey, r);
      }
    }
    reduced = Array.from(seen.values());
    reduced.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  return reduced.map(r => ({
    timestamp: r.timestamp,
    moisture: r.moisture,
    label: labelFormat(new Date(r.timestamp)),
  }));
}

const app = express();
const PORT = process.env.PORT || 3001;
const USE_MOCK_DATA = process.env.USE_MOCK_DATA === 'true';

app.use(cors());
app.use(express.json());

// Mock data generator for development
function generateMockSensors() {
  const mockSensors = [
    { id: 'account1_soil_ch1', accountId: 'account1', sensorKey: 'Channel 1', moisture: 45 + Math.random() * 10 },
    { id: 'account1_soil_ch2', accountId: 'account1', sensorKey: 'Channel 2', moisture: 62 + Math.random() * 8 },
    { id: 'account1_soil_ch3', accountId: 'account1', sensorKey: 'Channel 3', moisture: 28 + Math.random() * 5 },
    { id: 'account1_soil_ch4', accountId: 'account1', sensorKey: 'Channel 4', moisture: 55 + Math.random() * 12 },
    { id: 'account2_soil_ch1', accountId: 'account2', sensorKey: 'Channel 1', moisture: 72 + Math.random() * 6 },
    { id: 'account2_soil_ch2', accountId: 'account2', sensorKey: 'Channel 2', moisture: 38 + Math.random() * 10 },
    { id: 'account2_soil_ch3', accountId: 'account2', sensorKey: 'Channel 3', moisture: 51 + Math.random() * 8 },
    { id: 'account2_soil_ch4', accountId: 'account2', sensorKey: 'Channel 4', moisture: 18 + Math.random() * 7 },
  ];

  return mockSensors.map(s => ({
    ...s,
    moisture: Math.round(s.moisture),
    unit: '%',
    ad: Math.floor(Math.random() * 100) + 150,
    timestamp: new Date().toISOString(),
  }));
}

// Ecowitt API configuration
const accounts = [
  {
    id: 'account1',
    appKey: process.env.ECOWITT_APP_KEY_1,
    apiKey: process.env.ECOWITT_API_KEY_1,
    mac: process.env.ECOWITT_MAC_1,
  },
  {
    id: 'account2',
    appKey: process.env.ECOWITT_APP_KEY_2,
    apiKey: process.env.ECOWITT_API_KEY_2,
    mac: process.env.ECOWITT_MAC_2,
  },
].filter(acc => acc.appKey && acc.apiKey && acc.mac);

// Format date for Ecowitt API (YYYY-MM-DD HH:MM:SS format)
function formatEcowittDate(date) {
  const pad = (n) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

// Fetch historical data from Ecowitt cloud API
async function fetchEcowittHistory(account, startDate, endDate, channel) {
  const url = new URL('https://api.ecowitt.net/api/v3/device/history');
  url.searchParams.set('application_key', account.appKey);
  url.searchParams.set('api_key', account.apiKey);
  url.searchParams.set('mac', account.mac);
  url.searchParams.set('start_date', formatEcowittDate(startDate));
  url.searchParams.set('end_date', formatEcowittDate(endDate));
  // Request soil moisture data for specific channel
  url.searchParams.set('call_back', `soil_ch${channel}`);

  try {
    const response = await fetch(url.toString());
    const data = await response.json();

    if (data.code !== 0) {
      console.error(`Ecowitt History API error for ${account.id}:`, data);
      return { error: data.msg || 'API error', data: [] };
    }

    return { data: data.data || {}, raw: data };
  } catch (error) {
    console.error(`Failed to fetch history from ${account.id}:`, error);
    return { error: error.message, data: [] };
  }
}

async function fetchEcowittData(account) {
  const url = new URL('https://api.ecowitt.net/api/v3/device/real_time');
  url.searchParams.set('application_key', account.appKey);
  url.searchParams.set('api_key', account.apiKey);
  url.searchParams.set('mac', account.mac);
  url.searchParams.set('call_back', 'all');

  try {
    const response = await fetch(url.toString());
    const data = await response.json();

    if (data.code !== 0) {
      console.error(`Ecowitt API error for ${account.id}:`, data);
      return { accountId: account.id, error: data.msg || 'API error', sensors: [] };
    }

    // Extract soil moisture sensors from soil_ch1, soil_ch2, etc.
    const sensors = [];
    const deviceData = data.data || {};

    for (const [key, value] of Object.entries(deviceData)) {
      if (key.startsWith('soil_ch') && value?.soilmoisture) {
        const channelNum = key.replace('soil_ch', '');
        sensors.push({
          id: `${account.id}_soil_ch${channelNum}`,
          accountId: account.id,
          sensorKey: `Channel ${channelNum}`,
          moisture: parseFloat(value.soilmoisture.value),
          unit: value.soilmoisture.unit,
          ad: value.ad ? parseInt(value.ad.value) : null,
          timestamp: new Date(parseInt(value.soilmoisture.time) * 1000).toISOString(),
        });
      }
    }

    return { accountId: account.id, sensors, raw: deviceData };
  } catch (error) {
    console.error(`Failed to fetch from ${account.id}:`, error);
    return { accountId: account.id, error: error.message, sensors: [] };
  }
}

// Server-side cache for sensor data (avoids hammering Ecowitt API on frequent polls)
let sensorCache = null;
let sensorCacheTime = 0;
const SENSOR_CACHE_TTL = 5000; // 5 seconds

// API endpoint to get all sensor data
app.get('/api/sensors', async (req, res) => {
  try {
    // Use mock data if enabled or no accounts configured
    if (USE_MOCK_DATA || accounts.length === 0) {
      console.log('Using mock sensor data');
      return res.json({
        sensors: generateMockSensors(),
        mock: true,
        lastUpdated: new Date().toISOString(),
      });
    }

    // Return cached response if fresh
    if (sensorCache && (Date.now() - sensorCacheTime) < SENSOR_CACHE_TTL) {
      return res.json(sensorCache);
    }

    const results = await Promise.all(accounts.map(fetchEcowittData));

    // Combine all sensors from all accounts
    const allSensors = results.flatMap(r => r.sensors);
    const errors = results.filter(r => r.error).map(r => ({ accountId: r.accountId, error: r.error }));

    // Store each sensor reading for historical tracking
    const now = new Date().toISOString();
    for (const sensor of allSensors) {
      storeReading(sensor.id, sensor.moisture, sensor.timestamp || now);
    }
    console.log(`Stored ${allSensors.length} sensor readings at ${now}`);

    // If all accounts failed, fall back to mock data
    if (allSensors.length === 0 && errors.length > 0) {
      console.log('API unreachable, falling back to mock data');
      const fallback = {
        sensors: generateMockSensors(),
        mock: true,
        errors: errors,
        lastUpdated: new Date().toISOString(),
      };
      return res.json(fallback);
    }

    // Use the most recent sensor report timestamp as lastUpdated
    const latestSensorTime = allSensors.reduce((latest, sensor) => {
      if (!sensor.timestamp) return latest;
      const t = new Date(sensor.timestamp).getTime();
      return t > latest ? t : latest;
    }, 0);

    const response = {
      sensors: allSensors,
      errors: errors.length > 0 ? errors : undefined,
      lastUpdated: latestSensorTime > 0 ? new Date(latestSensorTime).toISOString() : new Date().toISOString(),
    };

    // Cache the response
    sensorCache = response;
    sensorCacheTime = Date.now();

    res.json(response);
  } catch (error) {
    console.error('Error fetching sensor data:', error);
    // Fall back to mock data on error
    console.log('Error occurred, falling back to mock data');
    res.json({
      sensors: generateMockSensors(),
      mock: true,
      lastUpdated: new Date().toISOString(),
    });
  }
});

// Generate mock historical data
function generateMockHistory(period) {
  const now = new Date();
  const data = [];
  let points, interval, labelFormat;

  switch (period) {
    case '24h':
      points = 24;
      interval = 60 * 60 * 1000; // 1 hour
      labelFormat = (d) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      break;
    case '7d':
      points = 7 * 4; // 4 readings per day
      interval = 6 * 60 * 60 * 1000; // 6 hours
      labelFormat = (d) => d.toLocaleDateString([], { weekday: 'short', hour: '2-digit' });
      break;
    case '30d':
      points = 30;
      interval = 24 * 60 * 60 * 1000; // 1 day
      labelFormat = (d) => d.toLocaleDateString([], { month: 'short', day: 'numeric' });
      break;
    case '1y':
      // Annual view - only show months where sensors have been active
      // Assuming sensors started ~2-3 months ago, show only those months
      points = 3; // Only 3 months of real data so far
      interval = 30 * 24 * 60 * 60 * 1000; // ~1 month
      labelFormat = (d) => d.toLocaleDateString([], { month: 'long' });
      break;
    default:
      points = 24;
      interval = 60 * 60 * 1000;
      labelFormat = (d) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  // Generate realistic moisture data with watering pattern
  // Simulates: gradual decline -> drops to 40s -> watering spike -> repeat
  let baseMoisture = 65 + Math.random() * 10; // Start between 65-75%
  let daysSinceWatering = 0;

  for (let i = points - 1; i >= 0; i--) {
    const timestamp = new Date(now.getTime() - i * interval);

    // Simulate gradual moisture decline (plants lose moisture over time)
    baseMoisture -= (Math.random() * 3 + 1); // Lose 1-4% per interval

    // If moisture drops into low 40s, simulate watering (spike up)
    if (baseMoisture < 42 + Math.random() * 5) {
      baseMoisture = 68 + Math.random() * 10; // Spike to 68-78% after watering
    }

    // Keep within realistic bounds
    baseMoisture = Math.max(38, Math.min(80, baseMoisture));

    data.push({
      timestamp: timestamp.toISOString(),
      moisture: Math.round(baseMoisture),
      label: labelFormat(timestamp),
    });
  }

  return data;
}

// API endpoint for sensor history - fetches from Ecowitt cloud
app.get('/api/sensors/:sensorId/history', async (req, res) => {
  const { sensorId } = req.params;
  const { period = '24h' } = req.query;

  // Parse sensorId to get account and channel (format: account1_soil_ch1)
  const match = sensorId.match(/^(account\d+)_soil_ch(\d+)$/);
  if (!match) {
    return res.json({ sensorId, period, data: [], error: 'Invalid sensor ID format' });
  }

  const [, accountId, channel] = match;
  const account = accounts.find(a => a.id === accountId);

  if (!account) {
    return res.json({ sensorId, period, data: [], error: 'Account not found' });
  }

  // Calculate date range based on period
  const now = new Date();
  let startDate;
  let labelFormat;
  let skipFactor = 1;

  switch (period) {
    case '1h':
      startDate = new Date(now.getTime() - 60 * 60 * 1000);
      labelFormat = (d) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      skipFactor = 1; // Show all readings for 1h
      break;
    case '24h':
      startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      labelFormat = (d) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      skipFactor = 1; // Show all 5-min intervals for 24h
      break;
    case '7d':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      labelFormat = (d) => d.toLocaleDateString([], { weekday: 'short', hour: '2-digit' });
      skipFactor = 6; // Every 30 min for 7d
      break;
    case '30d':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      labelFormat = (d) => d.toLocaleDateString([], { month: 'short', day: 'numeric' });
      skipFactor = 24; // Every 2 hours for 30d
      break;
    case '1y':
      startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      labelFormat = (d) => d.toLocaleDateString([], { month: 'long' });
      skipFactor = 288; // Daily for 1y
      break;
    default:
      startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      labelFormat = (d) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  // For hourly view, always use local data — it has minute-by-minute readings
  // (Ecowitt cloud API only returns 5-min intervals)
  if (period === '1h') {
    const localData = getHistory(sensorId, '1h');
    return res.json({ sensorId, period, data: localData, source: 'local' });
  }

  try {
    const result = await fetchEcowittHistory(account, startDate, now, channel);

    if (result.error) {
      // Fall back to locally stored data if API fails
      console.log(`Ecowitt history API failed, using local data: ${result.error}`);
      const localData = getHistory(sensorId, period);
      return res.json({ sensorId, period, data: localData, source: 'local' });
    }

    // Parse the Ecowitt history response
    // The data structure is typically: { soil_ch1: { soilmoisture: { list: [...] } } }
    const channelKey = `soil_ch${channel}`;
    const channelData = result.data[channelKey];

    if (!channelData?.soilmoisture?.list) {
      console.log('No history data in Ecowitt response, trying local storage');
      const localData = getHistory(sensorId, period);
      return res.json({ sensorId, period, data: localData, source: 'local' });
    }

    // Ecowitt returns list as an object with timestamp keys: { "1768775100": "64", ... }
    const listObj = channelData.soilmoisture.list;
    const readings = Object.entries(listObj)
      .map(([timestamp, value]) => ({
        time: parseInt(timestamp),
        value: parseFloat(value),
      }))
      .sort((a, b) => a.time - b.time); // Sort by time ascending

    // Smart downsampling that preserves peaks/valleys (min/max in each bucket)
    // This ensures watering spikes and low points are never averaged away
    let reduced;
    const maxPoints = period === '1h' ? 100 : period === '24h' ? 300 : period === '7d' ? 400 : period === '30d' ? 300 : 200;

    if (readings.length <= maxPoints) {
      // No downsampling needed - keep all points
      reduced = readings;
    } else {
      // Use Largest-Triangle-Three-Buckets (LTTB) inspired approach
      // that preserves local min/max in each bucket
      const bucketSize = Math.ceil(readings.length / maxPoints);
      reduced = [];

      for (let i = 0; i < readings.length; i += bucketSize) {
        const bucket = readings.slice(i, Math.min(i + bucketSize, readings.length));
        if (bucket.length === 0) continue;

        // Find min and max in bucket
        let minPoint = bucket[0];
        let maxPoint = bucket[0];
        for (const point of bucket) {
          if (point.value < minPoint.value) minPoint = point;
          if (point.value > maxPoint.value) maxPoint = point;
        }

        // Add both min and max if they differ significantly (preserves spikes)
        if (minPoint.time < maxPoint.time) {
          reduced.push(minPoint);
          if (maxPoint.value - minPoint.value >= 2) reduced.push(maxPoint);
        } else {
          reduced.push(maxPoint);
          if (maxPoint.value - minPoint.value >= 2) reduced.push(minPoint);
        }
      }

      // Re-sort by time after adding min/max pairs
      reduced.sort((a, b) => a.time - b.time);
    }

    const data = reduced.map(r => ({
      timestamp: new Date(r.time * 1000).toISOString(),
      moisture: r.value,
      label: labelFormat(new Date(r.time * 1000)),
    }));

    res.json({
      sensorId,
      period,
      data,
      source: 'ecowitt',
    });
  } catch (error) {
    console.error('Error fetching history:', error);
    // Fall back to local data
    const localData = getHistory(sensorId, period);
    res.json({ sensorId, period, data: localData, source: 'local', error: error.message });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    configuredAccounts: accounts.length,
    mockMode: USE_MOCK_DATA,
    timestamp: new Date().toISOString(),
  });
});

// Get plant settings (names, colors, order, hidden)
app.get('/api/settings', (req, res) => {
  const settings = loadSettings();
  res.json(settings);
});

// Update plant settings
app.post('/api/settings', (req, res) => {
  const { names, colors, order, hidden, thresholds } = req.body;
  const currentSettings = loadSettings();

  // Merge with existing settings
  const newSettings = {
    names: names !== undefined ? names : currentSettings.names,
    colors: colors !== undefined ? colors : currentSettings.colors,
    order: order !== undefined ? order : currentSettings.order,
    hidden: hidden !== undefined ? hidden : currentSettings.hidden,
    thresholds: thresholds !== undefined ? thresholds : currentSettings.thresholds,
  };

  saveSettings(newSettings);
  res.json(newSettings);
});

// Update single plant name
app.post('/api/settings/name', (req, res) => {
  const { sensorId, name } = req.body;
  const settings = loadSettings();
  settings.names[sensorId] = name;
  saveSettings(settings);
  res.json({ success: true, names: settings.names });
});

// Update single plant color
app.post('/api/settings/color', (req, res) => {
  const { sensorId, color } = req.body;
  const settings = loadSettings();
  settings.colors[sensorId] = color;
  saveSettings(settings);
  res.json({ success: true, colors: settings.colors });
});

// Update sensor order
app.post('/api/settings/order', (req, res) => {
  const { order } = req.body;
  const settings = loadSettings();
  settings.order = order;
  saveSettings(settings);
  res.json({ success: true, order: settings.order });
});

// Update hidden sensors
app.post('/api/settings/hidden', (req, res) => {
  const { hidden } = req.body;
  const settings = loadSettings();
  settings.hidden = hidden;
  saveSettings(settings);
  res.json({ success: true, hidden: settings.hidden });
});

// Update single plant threshold
app.post('/api/settings/threshold', (req, res) => {
  const { sensorId, min, max } = req.body;
  const settings = loadSettings();
  if (!settings.thresholds) settings.thresholds = {};
  settings.thresholds[sensorId] = { min, max };
  saveSettings(settings);
  res.json({ success: true, thresholds: settings.thresholds });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`PlantPulse server running on http://0.0.0.0:${PORT}`);
  console.log(`Configured Ecowitt accounts: ${accounts.length}`);
  if (USE_MOCK_DATA) {
    console.log('🔧 Mock data mode enabled (USE_MOCK_DATA=true)');
  }
});
