import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Badge,
  Button,
  Cell,
  List,
  Placeholder,
  Section,
  SegmentedControl,
  Spinner,
  Switch,
} from '@telegram-apps/telegram-ui'
import { ArrowLeft, Calendar, Download, RefreshCw, Video } from 'lucide-react'
import {
  downloadRecordingSegment,
  fetchCameraReachability,
  fetchCameraSnapshotUrl,
  fetchCameraStatus,
  fetchRecordingDays,
  fetchRecordingSegments,
  fetchUserCameras,
} from '../api/client'
import { useAuth } from '../context/AuthContext'
import type { CameraDto, RecordingDayDto, SegmentInfoDto } from '../types/api'
import { hapticImpact, hapticNotify, hapticSelection } from '../utils/telegram'
import { formatBytes } from '../utils/time'

type ViewMode = 'live' | 'recordings'

function formatSegmentTime(seg: SegmentInfoDto): string {
  const ts = Number(seg.startTime)
  if (Number.isFinite(ts) && ts > 0) {
    return new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }
  return seg.filename
}

export function CameraPage() {
  const { t } = useTranslation()
  const { token, userId } = useAuth()
  const [cameras, setCameras] = useState<CameraDto[]>([])
  const [selectedCamera, setSelectedCamera] = useState<CameraDto | null>(null)
  const [statuses, setStatuses] = useState<Record<string, boolean>>({})
  const [reachabilities, setReachabilities] = useState<Record<string, boolean>>({})
  const [mode, setMode] = useState<ViewMode>('live')

  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null)
  const [snapshotError, setSnapshotError] = useState<string | null>(null)
  const [isLoadingSnapshot, setIsLoadingSnapshot] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const prevUrlRef = useRef<string | null>(null)

  const [days, setDays] = useState<RecordingDayDto[]>([])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [segments, setSegments] = useState<SegmentInfoDto[]>([])
  const [isLoadingSegments, setIsLoadingSegments] = useState(false)
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

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

  const refreshSnapshot = useCallback(async () => {
    if (!token || !selectedCamera) return
    setIsLoadingSnapshot(true)
    try {
      const nextUrl = await fetchCameraSnapshotUrl(selectedCamera.name, token)
      if (prevUrlRef.current) {
        URL.revokeObjectURL(prevUrlRef.current)
      }
      prevUrlRef.current = nextUrl
      setSnapshotUrl(nextUrl)
      setSnapshotError(null)
    } catch {
      setSnapshotError(t('camera.streamError'))
    } finally {
      setIsLoadingSnapshot(false)
    }
  }, [token, selectedCamera, t])

  useEffect(() => {
    if (mode !== 'live' || !selectedCamera) return
    void refreshSnapshot()
    if (!autoRefresh) return
    const timer = window.setInterval(() => {
      void refreshSnapshot()
    }, 3000)
    return () => window.clearInterval(timer)
  }, [mode, selectedCamera, autoRefresh, refreshSnapshot])

  useEffect(() => {
    return () => {
      if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current)
    }
  }, [])

  useEffect(() => {
    if (!token || !selectedCamera || mode !== 'recordings') return
    fetchRecordingDays(selectedCamera.name, token)
      .then(setDays)
      .catch(() => setDays([]))
  }, [token, selectedCamera, mode])

  useEffect(() => {
    if (!token || !selectedCamera || mode !== 'recordings' || !selectedDate) return
    setIsLoadingSegments(true)
    fetchRecordingSegments(selectedCamera.name, selectedDate, token)
      .then(setSegments)
      .catch(() => setSegments([]))
      .finally(() => setIsLoadingSegments(false))
  }, [token, selectedCamera, mode, selectedDate])

  const handleDownload = async (filename: string) => {
    if (!token || !selectedCamera || downloadingFile) return
    hapticImpact('light')
    setDownloadingFile(filename)
    try {
      await downloadRecordingSegment(selectedCamera.name, filename, token)
      hapticNotify('success')
    } catch {
      hapticNotify('error')
    } finally {
      setDownloadingFile(null)
    }
  }

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
                setSegments([])
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

        {mode === 'live' && (
          <>
            <div style={{ padding: '0 12px 8px' }}>
              {snapshotUrl ? (
                <img
                  src={snapshotUrl}
                  alt={selectedCamera?.name ?? 'Camera'}
                  style={{
                    width: '100%',
                    aspectRatio: '16 / 9',
                    objectFit: 'contain',
                    backgroundColor: '#000',
                    borderRadius: 12,
                    display: 'block',
                  }}
                />
              ) : (
                <div
                  style={{
                    width: '100%',
                    aspectRatio: '16 / 9',
                    backgroundColor: '#000',
                    borderRadius: 12,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {isLoadingSnapshot && <Spinner size="m" />}
                </div>
              )}
              {snapshotError && (
                <div style={{ color: 'var(--tgui--destructive_text_color)', fontSize: 13, marginTop: 6 }}>
                  {snapshotError}
                </div>
              )}
            </div>

            <Cell
              after={
                <Switch
                  checked={autoRefresh}
                  onChange={() => {
                    hapticSelection()
                    setAutoRefresh(v => !v)
                  }}
                />
              }
            >
              {t('camera.autoRefresh')}
            </Cell>

            <div style={{ padding: '8px 16px 14px' }}>
              <Button
                size="m"
                mode="bezeled"
                stretched
                before={<RefreshCw size={16} />}
                loading={isLoadingSnapshot}
                onClick={() => {
                  hapticSelection()
                  void refreshSnapshot()
                }}
              >
                {t('camera.refreshFrame')}
              </Button>
            </div>
          </>
        )}
      </Section>

      {mode === 'recordings' && (
        <Section header={selectedDate ?? t('camera.selectDay')} footer={t('camera.hevcNotice')}>
          {selectedDate ? (
            <>
              <Cell
                before={<ArrowLeft size={18} />}
                onClick={() => {
                  hapticSelection()
                  setSelectedDate(null)
                  setSegments([])
                }}
              >
                {t('camera.backToDays')}
              </Cell>
              {isLoadingSegments ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 16 }}>
                  <Spinner size="m" />
                </div>
              ) : segments.length === 0 ? (
                <Cell>{t('camera.noSegments')}</Cell>
              ) : (
                segments.map(seg => (
                  <Cell
                    key={seg.filename}
                    before={<Download size={18} />}
                    subtitle={formatBytes(seg.sizeBytes)}
                    after={downloadingFile === seg.filename ? <Spinner size="s" /> : undefined}
                    onClick={() => void handleDownload(seg.filename)}
                  >
                    {formatSegmentTime(seg)}
                  </Cell>
                ))
              )}
            </>
          ) : days.length === 0 ? (
            <Cell>{t('camera.noRecordings')}</Cell>
          ) : (
            days.map(day => (
              <Cell
                key={day.date}
                before={<Calendar size={18} />}
                subtitle={`${t('camera.segmentsCount', { count: day.segmentCount })} · ${formatBytes(day.totalSizeBytes)}`}
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
