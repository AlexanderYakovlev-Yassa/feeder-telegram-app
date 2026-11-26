import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Button,
  Cell,
  List,
  Placeholder,
  Section,
  Slider,
  Snackbar,
  Spinner,
} from '@telegram-apps/telegram-ui'
import { Utensils, Volume2 } from 'lucide-react'
import { feedDevice, fetchAudioPresets, playAudioPreset } from '../api/client'
import { useAuth } from '../context/AuthContext'
import type { AudioPresetDto, DeviceDto } from '../types/api'
import { hapticImpact, hapticNotify, hapticSelection } from '../utils/telegram'

const PORTION_PRESETS = [1, 2, 3, 4]

interface FeederPageProps {
  devices: DeviceDto[]
  selectedDevice: DeviceDto | null
  onSelectDevice: (device: DeviceDto) => void
  isLoadingDevices: boolean
}

export function FeederPage({
  devices,
  selectedDevice,
  onSelectDevice,
  isLoadingDevices,
}: FeederPageProps) {
  const { t } = useTranslation()
  const { token } = useAuth()
  const [grams, setGrams] = useState(2)
  const [isFeeding, setIsFeeding] = useState(false)
  const [presets, setPresets] = useState<AudioPresetDto[]>([])
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    fetchAudioPresets(token)
      .then(setPresets)
      .catch(() => setPresets([]))
  }, [token])

  const handleFeed = async () => {
    if (!token || !selectedDevice || isFeeding) return
    hapticImpact('medium')
    setIsFeeding(true)
    try {
      await feedDevice(selectedDevice.serialNumber, grams, token)
      hapticNotify('success')
      setToast(t('feeder.feedSuccess', { grams }))
    } catch {
      hapticNotify('error')
      setToast(t('feeder.feedError'))
    } finally {
      setIsFeeding(false)
    }
  }

  const handlePlayAudio = async (preset: AudioPresetDto) => {
    if (!token || playingId) return
    hapticImpact('light')
    setPlayingId(preset.id)
    try {
      await playAudioPreset(preset.id, token)
      hapticNotify('success')
      setToast(t('feeder.audioPlayed'))
    } catch {
      hapticNotify('error')
    } finally {
      setPlayingId(null)
    }
  }

  if (isLoadingDevices && devices.length === 0) {
    return (
      <Placeholder>
        <Spinner size="l" />
      </Placeholder>
    )
  }

  if (devices.length === 0) {
    return (
      <Placeholder
        header={t('feeder.noDevices')}
        description={selectedDevice?.serialNumber}
      />
    )
  }

  return (
    <>
      <List>
        {devices.length > 1 && (
          <Section header={t('feeder.device')}>
            {devices.map(dev => (
              <Cell
                key={dev.id}
                subtitle={dev.serialNumber}
                after={selectedDevice?.id === dev.id ? '✓' : undefined}
                onClick={() => {
                  hapticSelection()
                  onSelectDevice(dev)
                }}
              >
                {dev.name}
              </Cell>
            ))}
          </Section>
        )}

        <Section header={selectedDevice?.name ?? t('feeder.device')}>
          <Cell
            before={<Utensils size={20} />}
            after={<strong>{grams} г</strong>}
          >
            {t('feeder.portion')}
          </Cell>

          <div style={{ padding: '8px 16px 4px' }}>
            <Slider
              min={1}
              max={30}
              step={1}
              value={grams}
              onChange={val => setGrams(Math.round(val))}
            />
          </div>

          <div style={{ display: 'flex', gap: 8, padding: '8px 16px 12px', flexWrap: 'wrap' }}>
            {PORTION_PRESETS.map(p => (
              <Button
                key={p}
                size="s"
                mode={grams === p ? 'filled' : 'bezeled'}
                onClick={() => {
                  hapticSelection()
                  setGrams(p)
                }}
                style={{ flex: 1, minWidth: 64 }}
              >
                {p} г
              </Button>
            ))}
          </div>

          <div style={{ padding: '0 16px 16px' }}>
            <Button
              size="l"
              stretched
              loading={isFeeding}
              disabled={!selectedDevice}
              onClick={handleFeed}
            >
              {isFeeding ? t('feeder.feeding') : `${t('feeder.feedNow')} (${grams} г)`}
            </Button>
          </div>
        </Section>

        <Section header={t('feeder.audioHeader')}>
          {presets.length === 0 ? (
            <Cell>{t('feeder.audioEmpty')}</Cell>
          ) : (
            presets.map(preset => (
              <Cell
                key={preset.id}
                before={<Volume2 size={20} />}
                subtitle={preset.description}
                after={playingId === preset.id ? <Spinner size="s" /> : undefined}
                onClick={() => void handlePlayAudio(preset)}
              >
                {preset.name}
              </Cell>
            ))
          )}
        </Section>
      </List>

      {toast && (
        <Snackbar onClose={() => setToast(null)} duration={2500}>
          {toast}
        </Snackbar>
      )}
    </>
  )
}
