import { useState, useRef, useEffect } from 'react';
import { Droplets, Check, X, Pencil, GripVertical, EyeOff, Palette, Settings2 } from 'lucide-react';
import { SensorData, MoistureStatus, getStatusLabel } from '../types/ecowitt';
import { MoistureGauge } from './MoistureGauge';

interface PlantThreshold {
  min: number;
  max: number;
}

interface PlantCardProps {
  sensor: SensorData;
  name: string;
  color: string;
  threshold: PlantThreshold;
  moistureStatus: MoistureStatus;
  onNameChange: (name: string) => void;
  onColorChange: (color: string) => void;
  onThresholdChange: (min: number, max: number) => void;
  onClick?: () => void;
  isDragging?: boolean;
  onHide?: () => void;
}

const COLOR_OPTIONS = [
  // Greens
  { name: 'green', from: '#1D6F42', to: '#2D8B57', label: 'Forest' },
  { name: 'sage', from: '#6B8E6F', to: '#8BAA8F', label: 'Sage' },
  // Pinks
  { name: 'rose', from: '#BE6B7B', to: '#D4919D', label: 'Rose' },
  { name: 'blush', from: '#C9929C', to: '#E8B4BC', label: 'Blush' },
  // Browns
  { name: 'terracotta', from: '#A0522D', to: '#CD853F', label: 'Terra' },
  { name: 'coffee', from: '#6F4E37', to: '#8B7355', label: 'Coffee' },
];

export function PlantCard({ sensor, name, color, threshold, moistureStatus, onNameChange, onColorChange, onThresholdChange, onClick, isDragging, onHide }: PlantCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(name);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showThresholdPicker, setShowThresholdPicker] = useState(false);
  const [tempMin, setTempMin] = useState(threshold.min);
  const [tempMax, setTempMax] = useState(threshold.max);
  const [lastUpdatedText, setLastUpdatedText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const colorPickerRef = useRef<HTMLDivElement>(null);
  const thresholdPickerRef = useRef<HTMLDivElement>(null);

  const status = moistureStatus;
  const selectedColor = COLOR_OPTIONS.find(c => c.name === color) || COLOR_OPTIONS[0];

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Calculate seconds since last updated
  useEffect(() => {
    const getSecondsAgo = () => {
      if (!sensor.timestamp) return '';
      const sensorTime = new Date(sensor.timestamp).getTime();
      const seconds = Math.floor((Date.now() - sensorTime) / 1000);
      return `${seconds}s ago`;
    };

    setLastUpdatedText(getSecondsAgo());
    const timer = setInterval(() => setLastUpdatedText(getSecondsAgo()), 1000);
    return () => clearInterval(timer);
  }, [sensor.timestamp]);

  // Sync temp threshold values when prop changes
  useEffect(() => {
    setTempMin(threshold.min);
    setTempMax(threshold.max);
  }, [threshold.min, threshold.max]);

  // Close color picker when clicking outside
  useEffect(() => {
    if (!showColorPicker) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(e.target as Node)) {
        setShowColorPicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside as EventListener);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside as EventListener);
    };
  }, [showColorPicker]);

  // Close threshold picker when clicking outside
  useEffect(() => {
    if (!showThresholdPicker) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (thresholdPickerRef.current && !thresholdPickerRef.current.contains(e.target as Node)) {
        setShowThresholdPicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside as EventListener);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside as EventListener);
    };
  }, [showThresholdPicker]);

  const handleSave = () => {
    if (editValue.trim()) {
      onNameChange(editValue.trim());
    } else {
      setEditValue(name);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(name);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === 'Enter') handleSave();
    else if (e.key === 'Escape') handleCancel();
  };

  const handleCardClick = (e: React.MouseEvent) => {
    if (isEditing || showColorPicker || showThresholdPicker || (e.target as HTMLElement).closest('button')) return;
    onClick?.();
  };

  const handleThresholdSave = () => {
    // Ensure min < max
    const min = Math.min(tempMin, tempMax);
    const max = Math.max(tempMin, tempMax);
    onThresholdChange(min, max);
    setShowThresholdPicker(false);
  };

  const handleThresholdCancel = () => {
    setTempMin(threshold.min);
    setTempMax(threshold.max);
    setShowThresholdPicker(false);
  };

  const getStatusStyles = () => {
    switch (status) {
      case 'dry': return 'bg-red-500/20 text-red-600';
      case 'wet': return 'bg-blue-500/20 text-blue-600';
      case 'ok': return 'bg-green-500/20 text-green-600';
    }
  };

  return (
    <div
      className={`group bg-white/95 backdrop-blur rounded-2xl shadow-lg border border-white/50
                  hover:shadow-xl transition-all duration-200
                  ${isDragging ? 'shadow-2xl scale-105 cursor-grabbing' : 'hover:scale-[1.02] cursor-pointer'}
                  ${onClick ? 'cursor-pointer' : ''}
                  ${showThresholdPicker || showColorPicker ? 'z-50 relative' : ''}`}
      onClick={handleCardClick}
    >
      {/* Header - MOBILE OPTIMIZED with COLOR */}
      <div
        className="relative px-1.5 sm:px-3 py-1.5 sm:py-3"
        style={{
          background: `linear-gradient(to right, ${selectedColor.from}, ${selectedColor.to})`
        }}
      >
        <div className="absolute inset-0 bg-[url('/banana-leaf.png')] bg-[length:150px] opacity-10" />
        {isEditing ? (
          <div className="relative flex items-center gap-1 sm:gap-2" onClick={e => e.stopPropagation()}>
            <input
              ref={inputRef}
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 px-2 py-1 rounded-lg text-sm font-bold bg-white/95 text-bhh-green
                         focus:outline-none min-w-0"
              maxLength={50}
            />
            <button onClick={handleSave} className="p-1 bg-white text-bhh-green rounded-lg hover:bg-bhh-cream">
              <Check className="w-4 h-4" />
            </button>
            <button onClick={handleCancel} className="p-1 bg-white text-bhh-pink-dark rounded-lg hover:bg-bhh-cream">
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="relative flex items-center justify-center">
            <GripVertical className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50 cursor-grab active:cursor-grabbing" />
            <h3 className="font-display text-xs sm:text-2xl font-bold text-white text-center px-4 sm:px-5
                           drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)] leading-tight
                           line-clamp-1 sm:line-clamp-none"
                title={name}>
              {name}
            </h3>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="px-1.5 sm:px-4 py-2 sm:py-4">
        <MoistureGauge moisture={sensor.moisture} />

        {/* Status + AD row - MOBILE OPTIMIZED */}
        <div className="mt-1.5 sm:mt-3 flex items-center justify-center gap-1.5 sm:gap-3 flex-wrap">
          <div
            className="relative"
            ref={thresholdPickerRef}
            onPointerDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setShowThresholdPicker(!showThresholdPicker);
              }}
              className={`inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm font-midcentury font-bold uppercase tracking-wide ${getStatusStyles()} hover:opacity-80 transition-opacity cursor-pointer whitespace-nowrap`}
              title="Click to set moisture thresholds"
            >
              <Droplets className="w-4 h-4 sm:w-5 sm:h-5" />
              {getStatusLabel(status)}
              <Settings2 className="w-3 h-3 sm:w-4 sm:h-4 opacity-60" />
            </button>

            {/* Threshold Picker Dropdown */}
            {showThresholdPicker && (
              <div
                className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 bg-white rounded-xl shadow-2xl p-4 z-[100] w-64 border border-gray-200"
                onClick={e => e.stopPropagation()}
              >
                <h4 className="text-sm font-bold text-bhh-green mb-3">Set Moisture Range</h4>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      "Needs Water" below: {tempMin}%
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={tempMin}
                      onChange={(e) => setTempMin(Number(e.target.value))}
                      className="w-full h-2 bg-bhh-gold/30 rounded-lg appearance-none cursor-pointer accent-bhh-gold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      "Over Watered" above: {tempMax}%
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={tempMax}
                      onChange={(e) => setTempMax(Number(e.target.value))}
                      className="w-full h-2 bg-bhh-green/30 rounded-lg appearance-none cursor-pointer accent-bhh-green"
                    />
                  </div>

                  <div className="text-xs text-center text-gray-500 py-1 bg-bhh-cream rounded">
                    Optimal: {Math.min(tempMin, tempMax)}% - {Math.max(tempMin, tempMax)}%
                  </div>
                </div>

                <div className="flex gap-2 mt-4">
                  <button
                    onClick={handleThresholdSave}
                    className="flex-1 px-3 py-1.5 bg-bhh-green text-white rounded-lg text-sm font-semibold hover:bg-bhh-green-light transition-colors"
                  >
                    Save
                  </button>
                  <button
                    onClick={handleThresholdCancel}
                    className="flex-1 px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-300 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
          {sensor.ad !== null && (
            <span className="text-sm sm:text-base font-semibold text-bhh-pink-dark bg-bhh-cream px-2 sm:px-3 py-1 sm:py-1.5 rounded-full">
              AD:{sensor.ad}
            </span>
          )}
          {lastUpdatedText && (
            <span className="text-xs text-gray-400 italic">
              {lastUpdatedText}
            </span>
          )}
        </div>
      </div>

      {/* Footer - Action buttons */}
      <div className="px-1.5 sm:px-4 py-1 sm:py-2 bg-bhh-cream/50 border-t border-bhh-pink/10 flex justify-center items-center gap-1.5 sm:gap-2">
        {/* Color Picker */}
        <div className="relative" ref={colorPickerRef}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowColorPicker(!showColorPicker);
            }}
            className="p-1.5 text-bhh-green/70 hover:text-bhh-green rounded transition-colors"
            title="Change color"
          >
            <Palette className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          {/* Color Picker Dropdown */}
          {showColorPicker && (
            <div
              className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 bg-white rounded-lg shadow-xl p-2 z-50"
              onClick={e => e.stopPropagation()}
            >
              <div className="grid grid-cols-3 gap-1.5">
                {COLOR_OPTIONS.map((colorOption) => (
                  <button
                    key={colorOption.name}
                    onClick={(e) => {
                      e.stopPropagation();
                      onColorChange(colorOption.name);
                      setShowColorPicker(false);
                    }}
                    className={`flex flex-col items-center gap-1 p-1.5 rounded hover:bg-gray-100 transition-colors
                               ${color === colorOption.name ? 'ring-2 ring-bhh-green ring-offset-1' : ''}`}
                    title={colorOption.label}
                  >
                    <div
                      className="w-8 h-8 rounded-full border-2 border-white shadow-sm"
                      style={{
                        background: `linear-gradient(135deg, ${colorOption.from}, ${colorOption.to})`
                      }}
                    />
                    <span className="text-[10px] text-gray-600 whitespace-nowrap">{colorOption.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsEditing(true);
          }}
          className="p-1.5 text-bhh-green/70 hover:text-bhh-green rounded transition-colors"
          title="Edit name"
        >
          <Pencil className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>

        {onHide && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onHide();
            }}
            className="p-1.5 text-bhh-green/70 hover:text-bhh-green rounded transition-colors"
            title="Hide tile"
          >
            <EyeOff className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        )}
      </div>
    </div>
  );
}
