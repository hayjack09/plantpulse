export interface SensorData {
  id: string;
  accountId: string;
  sensorKey: string;
  moisture: number;
  unit: string;
  ad: number | null;
  timestamp: string;
}

export interface SensorResponse {
  sensors: SensorData[];
  errors?: Array<{ accountId: string; error: string }>;
  lastUpdated: string;
}

export type MoistureStatus = 'dry' | 'ok' | 'wet';

export function getMoistureStatus(moisture: number): MoistureStatus {
  if (moisture < 30) return 'dry';
  if (moisture > 70) return 'wet';
  return 'ok';
}

export function getStatusLabel(status: MoistureStatus): string {
  switch (status) {
    case 'dry':
      return 'Dry';
    case 'wet':
      return 'Wet';
    case 'ok':
      return 'Good';
  }
}
