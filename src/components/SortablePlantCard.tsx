import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { PlantCard } from './PlantCard';
import { SensorData, MoistureStatus } from '../types/ecowitt';

interface PlantThreshold {
  min: number;
  max: number;
}

interface SortablePlantCardProps {
  sensor: SensorData;
  name: string;
  color: string;
  threshold: PlantThreshold;
  moistureStatus: MoistureStatus;
  onNameChange: (name: string) => void;
  onColorChange: (color: string) => void;
  onThresholdChange: (min: number, max: number) => void;
  onClick?: () => void;
  onHide?: () => void;
}

export function SortablePlantCard({ sensor, name, color, threshold, moistureStatus, onNameChange, onColorChange, onThresholdChange, onClick, onHide }: SortablePlantCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: sensor.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.9 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <PlantCard
        sensor={sensor}
        name={name}
        color={color}
        threshold={threshold}
        moistureStatus={moistureStatus}
        onNameChange={onNameChange}
        onColorChange={onColorChange}
        onThresholdChange={onThresholdChange}
        onClick={onClick}
        isDragging={isDragging}
        onHide={onHide}
      />
    </div>
  );
}
