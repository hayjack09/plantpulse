import { SensorResponse } from '../types/ecowitt';

const API_BASE = '/api';

export async function fetchSensors(): Promise<SensorResponse> {
  const response = await fetch(`${API_BASE}/sensors?_t=${Date.now()}`, {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

export async function checkHealth(): Promise<{ status: string; configuredAccounts: number }> {
  const response = await fetch(`${API_BASE}/health`);
  return response.json();
}
