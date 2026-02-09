import { useState, useEffect } from 'react'
import { Header } from './components/Header'
import { Dashboard } from './components/Dashboard'
import { HistoryModal } from './components/HistoryModal'
import { AnimatedBackground } from './components/AnimatedBackground'
import { FullscreenMode } from './components/FullscreenMode'
import { useEcowittData, usePlantNames, usePlantColors, usePlantThresholds } from './hooks/useEcowittData'
import { SensorData } from './types/ecowitt'

function App() {
  const { sensors, loading, error, lastUpdated, refresh } = useEcowittData()
  const { getName } = usePlantNames()
  const { getColor } = usePlantColors()
  const { getThreshold, getMoistureStatus } = usePlantThresholds()
  const [selectedSensor, setSelectedSensor] = useState<SensorData | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    const handleChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handleChange)
    return () => document.removeEventListener('fullscreenchange', handleChange)
  }, [])

  const handleSensorClick = (sensor: SensorData) => {
    setSelectedSensor(sensor)
  }

  const handleCloseModal = () => {
    setSelectedSensor(null)
  }

  // Fullscreen display mode
  if (isFullscreen) {
    return (
      <FullscreenMode
        sensors={sensors}
        getName={getName}
        getColor={getColor}
        getThreshold={getThreshold}
        getMoistureStatus={getMoistureStatus}
        lastUpdated={lastUpdated}
      />
    )
  }

  return (
    <div className="min-h-screen">
      {/* Animated atmospheric background */}
      <AnimatedBackground />

      {/* Content */}
      <div className="relative overflow-visible z-10">
        <Header
          onRefresh={refresh}
          loading={loading}
          lastUpdated={lastUpdated}
        />

        <main className="max-w-[1920px] mx-auto px-4 pb-6 mt-4 sm:-mt-8">
          <Dashboard
            sensors={sensors}
            loading={loading}
            error={error}
            onSensorClick={handleSensorClick}
          />
        </main>

        {/* Gold footer */}
        <footer className="h-3 bg-gradient-to-r from-bhh-gold via-bhh-gold-light to-bhh-gold shadow-lg" />
      </div>

      {/* History Modal */}
      {selectedSensor && (
        <HistoryModal
          sensor={selectedSensor}
          sensorName={getName(selectedSensor.id, sensors.findIndex(s => s.id === selectedSensor.id))}
          isOpen={!!selectedSensor}
          onClose={handleCloseModal}
        />
      )}
    </div>
  )
}

export default App
