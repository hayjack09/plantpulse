import { getMoistureStatus } from '../types/ecowitt';

interface MoistureGaugeProps {
  moisture: number;
}

export function MoistureGauge({ moisture }: MoistureGaugeProps) {
  const status = getMoistureStatus(moisture);

  const angle = (moisture / 100) * 180 - 90;

  const getGaugeColor = () => {
    switch (status) {
      case 'dry': return '#C9A227';
      case 'wet': return '#1D6F42';
      case 'ok': return '#2D8B57';
    }
  };

  const gradientId = `g-${moisture}-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div className="flex flex-col items-center">
      {/* Gauge SVG */}
      <div className="relative w-24 h-16 sm:w-32 sm:h-20">
        <svg className="w-full h-full" viewBox="0 0 64 40">
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#C9A227" />
              <stop offset="30%" stopColor="#E8A0A0" />
              <stop offset="70%" stopColor="#2D8B57" />
              <stop offset="100%" stopColor="#1D6F42" />
            </linearGradient>
          </defs>

          {/* Background arc */}
          <path d="M 6 36 A 26 26 0 0 1 58 36" fill="none" stroke="#F5D5D5" strokeWidth="6" strokeLinecap="round" />

          {/* Progress arc */}
          <path
            d="M 6 36 A 26 26 0 0 1 58 36"
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={`${(moisture / 100) * 82} 82`}
            className="transition-all duration-500"
          />

          {/* Needle */}
          <g transform={`rotate(${angle} 32 36)`} className="transition-transform duration-500">
            <line x1="32" y1="36" x2="32" y2="14" stroke="#1D6F42" strokeWidth="2" strokeLinecap="round" />
            <circle cx="32" cy="36" r="3" fill="#1D6F42" />
            <circle cx="32" cy="36" r="1.5" fill="#FFF" />
          </g>
        </svg>
      </div>

      {/* Percentage below gauge */}
      <span className="text-3xl sm:text-4xl font-midcentury font-extrabold mt-0.5 sm:mt-1 tracking-tight" style={{ color: getGaugeColor() }}>
        {moisture}%
      </span>
    </div>
  );
}
