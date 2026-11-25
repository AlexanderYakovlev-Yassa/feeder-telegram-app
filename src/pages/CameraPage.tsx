import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Hls from 'hls.js'
import {
  Badge,
  Cell,
  List,
  Placeholder,
  Section,
  SegmentedControl,
  Spinner,
} from '@telegram-apps/telegram-ui'
import { Calendar, Video } from 'lucide-react'
import {
  fetchCameraReachability,
  fetchCameraStatus,
  fetchRecordingDays,
  fetchUserCameras,
  getLivePlaylistUrl,
  getVodPlaylistUrl,
} from '../api/client'
import { useAuth } from '../context/AuthContext'
import type { CameraDto, RecordingDayDto } from '../types/api'
import { hapticSelection } from '../utils/telegram'
import { formatBytes } from '../utils/time'

type ViewMode = 'live' | 'recordings'

export function CameraPage() {
  const { t } = useTranslation()
  const { token, userId } = useAuth()
  const [cameras, setCameras] = useState<CameraDto[]>([])
  const [selectedCamera, setSelectedCamera] = useState<CameraDto | null>(null)
  const [statuses, setStatuses] = useState<Record<string, boolean>>({})
  const [reachabilities, setReachabilities] = useState<Record<string, boolean>>({})
  const [mode, setMode] = useState<ViewMode>('live')
  const [days, setDays] = useState<RecordingDayDto[]>([])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [streamError, setStreamError] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  const loadCameras = useCallback(async () => {
    if (!token || !userId) return
    setIsLoading(true)
    try {
      const [list, st, reach] = await Promise.all([
        fetchUserCameras(userId, token),
        fetchCameraStatus(token).catch(() => ({})),
        fetchCameraReachability(token).catch(() => ({})),
      ])
      setCameras(list)
      setStatuses(st)
      setReachabilities(reach)
      if (list.length > 0 && !selectedCamera) {
        setSelectedCamera(list[0])
      }
    } finally {
      setIsLoading(false)
    }
  }, [token, userId, selectedCamera])

  useEffect(() => {
    void loadCameras()
  }, [loadCameras])

  useEffect(() => {
    if (!token || !selectedCamera || mode !== 'recordings') return
    fetchRecordingDays(selectedCamera.name, token)
      .then(data => {
        setDays(data)
        if (data.length > 0 && !selectedDate) {
          setSelectedDate(data[0].date)
        }
      })
      .catch(() => setDays([]))
  }, [token, selectedCamera, mode, selectedDate])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !token || !selectedCamera) return
    if (mode === 'recordings' && !selectedDate) return

    const url =
      mode === 'live'
        ? getLivePlaylistUrl(selectedCamera.name)
        : getVodPlaylistUrl(selectedCamera.name, selectedDate!)

    setStreamError(null)
    let hls: Hls | null = null

    if (Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: mode === 'live',
        xhrSetup: xhr => {
          xhr.setRequestHeader('Authorization', `Bearer ${token}`)
        },
      })
      hls.loadSource(url)
      hls.attachMedia(video)
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        void video.play().catch(() => undefined)
      })
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          setStreamError(t('camera.streamError'))
        }
      })
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = url
      void video.play().catch(() => undefined)
    }

    return () => {
      hls?.destroy()
    }
  }, [token, selectedCamera, mode, selectedDate, t])

  if (isLoading && cameras.length === 0) {
    return (
      <Placeholder>
        <Spinner size="l" />
      </Placeholder>
    )
  }

  if (cameras.length === 0) {
    return <Placeholder header={t('camera.noCameras')} />
  }

  const isOnline = selectedCamera
    ? Boolean(statuses[selectedCamera.name] || reachabilities[selectedCamera.name])
    : false

  return (
    <List>
      {cameras.length > 1 && (
        <Section header={t('camera.title')}>
          {cameras.map(cam => (
            <Cell
              key={cam.id}
              before={<Video size={18} />}
              after={selectedCamera?.id === cam.id ? '✓' : undefined}
              onClick={() => {
                hapticSelection()
                setSelectedCamera(cam)
                setSelectedDate(null)
              }}
            >
              {cam.name}
            </Cell>
          ))}
        </Section>
      )}

      <Section
        header={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <span>{selectedCamera?.name ?? t('camera.title')}</span>
            <Badge type="number" mode={isOnline ? 'primary' : 'secondary'}>
              {isOnline ? t('camera.online') : t('camera.offline')}
            </Badge>
          </div>
        }
      >
        <div style={{ padding: '8px 16px' }}>
          <SegmentedControl>
            <SegmentedControl.Item
              selected={mode === 'live'}
              onClick={() => {
                hapticSelection()
                setMode('live')
              }}
            >
              {t('camera.live')}
            </SegmentedControl.Item>
            <SegmentedControl.Item
              selected={mode === 'recordings'}
              onClick={() => {
                hapticSelection()
                setMode('recordings')
              }}
            >
              {t('camera.recordings')}
            </SegmentedControl.Item>
          </SegmentedControl>
        </div>

        <div style={{ padding: '0 12px 12px' }}>
          <video
            ref={videoRef}
            controls
            muted
            playsInline
            style={{
              width: '100%',
              aspectRatio: '16 / 9',
              backgroundColor: '#000',
              borderRadius: 12,
              display: 'block',
            }}
          />
          {streamError && (
            <div style={{ color: 'var(--tgui--destructive_text_color)', fontSize: 13, marginTop: 6 }}>
              {streamError}
            </div>
          )}
        </div>
      </Section>

      {mode === 'recordings' && (
        <Section header={t('camera.selectDay')}>
          {days.length === 0 ? (
            <Cell>{t('camera.noRecordings')}</Cell>
          ) : (
            days.map(day => (
              <Cell
                key={day.date}
                before={<Calendar size={18} />}
                subtitle={`${t('camera.segmentsCount', { count: day.segmentCount })} · ${formatBytes(day.totalSizeBytes)}`}
                after={selectedDate === day.date ? '▶' : undefined}
                onClick={() => {
                  hapticSelection()
                  setSelectedDate(day.date)
                }}
              >
                {day.date}
              </Cell>
            ))
          )}
        </Section>
      )}
    </List>
  )
}
