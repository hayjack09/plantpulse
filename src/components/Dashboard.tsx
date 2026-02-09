import { useMemo } from 'react';
import { AlertCircle, Loader2, Leaf, Eye } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { SensorData } from '../types/ecowitt';
import { SortablePlantCard } from './SortablePlantCard';
import { usePlantNames, useSensorOrder, useHiddenSensors, usePlantColors, usePlantThresholds } from '../hooks/useEcowittData';

interface DashboardProps {
  sensors: SensorData[];
  loading: boolean;
  error: string | null;
  onSensorClick?: (sensor: SensorData) => void;
}

export function Dashboard({ sensors, loading, error, onSensorClick }: DashboardProps) {
  const { getName, updateName } = usePlantNames();
  const { sortSensors, updateOrder } = useSensorOrder();
  const { hidden: _hidden, hideSensor, unhideSensor, isHidden } = useHiddenSensors();
  const { getColor, updateColor } = usePlantColors();
  const { getThreshold, updateThreshold, getMoistureStatus } = usePlantThresholds();

  const sortedSensors = useMemo(() => sortSensors(sensors), [sensors, sortSensors]);
  const visibleSensors = useMemo(() => sortedSensors.filter(s => !isHidden(s.id)), [sortedSensors, isHidden]);
  const hiddenSensors = useMemo(() => sortedSensors.filter(s => isHidden(s.id)), [sortedSensors, isHidden]);

  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: {
      distance: 8,
    },
  });
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: {
      delay: 200,
      tolerance: 8,
    },
  });
  const keyboardSensor = useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates,
  });
  const dndSensors = useSensors(pointerSensor, touchSensor, keyboardSensor);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = visibleSensors.findIndex(s => s.id === active.id);
      const newIndex = visibleSensors.findIndex(s => s.id === over.id);
      const newOrder = arrayMove(visibleSensors, oldIndex, newIndex).map(s => s.id);
      updateOrder(newOrder);
    }
  };

  if (loading && sensors.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="relative">
          <div className="w-16 h-16 rounded-full bg-bhh-pink/50 animate-ping absolute" />
          <div className="relative w-16 h-16 rounded-full bg-bhh-green flex items-center justify-center shadow-2xl">
            <Loader2 className="w-8 h-8 text-white animate-spin" />
          </div>
        </div>
        <p className="mt-4 text-white font-display text-2xl font-bold drop-shadow-lg">
          Loading sensors...
        </p>
      </div>
    );
  }

  if (error && sensors.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="bg-white/95 backdrop-blur border-2 border-bhh-pink rounded-2xl p-6 max-w-md text-center shadow-2xl">
          <AlertCircle className="w-12 h-12 text-bhh-pink-hot mx-auto" />
          <h3 className="mt-3 font-display text-xl font-bold text-bhh-green">Connection Error</h3>
          <p className="mt-2 text-bhh-pink-dark">{error}</p>
        </div>
      </div>
    );
  }

  if (sensors.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="bg-white/95 backdrop-blur border-2 border-bhh-green rounded-2xl p-6 max-w-md text-center shadow-2xl">
          <Leaf className="w-12 h-12 text-bhh-green mx-auto" />
          <h3 className="mt-3 font-display text-xl font-bold text-bhh-green">No Sensors Found</h3>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <DndContext
        sensors={dndSensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={visibleSensors.map(s => s.id)}
          strategy={rectSortingStrategy}
        >
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-6">
            {visibleSensors.map((sensor, index) => (
              <SortablePlantCard
                key={sensor.id}
                sensor={sensor}
                name={getName(sensor.id, index)}
                color={getColor(sensor.id)}
                threshold={getThreshold(sensor.id)}
                moistureStatus={getMoistureStatus(sensor.id, sensor.moisture)}
                onNameChange={(name) => updateName(sensor.id, name)}
                onColorChange={(color) => updateColor(sensor.id, color)}
                onThresholdChange={(min, max) => updateThreshold(sensor.id, min, max)}
                onClick={() => onSensorClick?.(sensor)}
                onHide={() => hideSensor(sensor.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {error && (
        <div className="bg-white/90 border border-bhh-gold rounded-xl p-3 flex items-center gap-3 max-w-md mx-auto">
          <AlertCircle className="w-5 h-5 text-bhh-gold shrink-0" />
          <p className="text-bhh-green text-sm font-semibold">Partial data: {error}</p>
        </div>
      )}

      {hiddenSensors.length > 0 && (
        <div className="mt-8 pt-6 border-t border-white/20">
          <h3 className="text-white/80 font-semibold text-sm mb-3 flex items-center gap-2">
            <Eye className="w-4 h-4" />
            Hidden Tiles ({hiddenSensors.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {hiddenSensors.map((sensor, index) => (
              <button
                key={sensor.id}
                onClick={() => unhideSensor(sensor.id)}
                className="bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-2"
              >
                <Eye className="w-3.5 h-3.5" />
                {getName(sensor.id, index)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
