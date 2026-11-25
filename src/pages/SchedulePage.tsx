import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Button,
  Cell,
  IconButton,
  Input,
  List,
  Placeholder,
  Section,
  Spinner,
  Switch,
} from '@telegram-apps/telegram-ui'
import { Clock, PauseCircle, Plus, Trash2 } from 'lucide-react'
import {
  createSuspension,
  deleteSuspension,
  fetchDeviceSchedules,
  fetchDeviceSuspensions,
  updateDeviceSchedule,
} from '../api/client'
import { useAuth } from '../context/AuthContext'
import type { DailySchedulerDto, DeviceDto, SuspensionDto } from '../types/api'
import { hapticImpact, hapticNotify, hapticSelection } from '../utils/telegram'
import { formatEpochDateTime, scheduleToLocal, scheduleToUtc } from '../utils/time'

interface SchedulePageProps {
  device: DeviceDto | null
}

export function SchedulePage({ device }: SchedulePageProps) {
  const { t, i18n } = useTranslation()
  const { token } = useAuth()
  const [schedules, setSchedules] = useState<DailySchedulerDto[]>([])
  const [suspensions, setSuspensions] = useState<SuspensionDto[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [newTime, setNewTime] = useState('08:00')
  const [newGrams, setNewGrams] = useState('20')
  const [addingToId, setAddingToId] = useState<number | null>(null)

  const loadData = useCallback(async () => {
    if (!token || !device) return
    setIsLoading(true)
    try {
      const [schedRaw, suspRaw] = await Promise.all([
        fetchDeviceSchedules(device.id, token),
        fetchDeviceSuspensions(device.id, token),
      ])
      setSchedules(schedRaw.map(scheduleToLocal))
      setSuspensions(suspRaw)
    } finally {
      setIsLoading(false)
    }
  }, [token, device])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const saveSchedule = async (updatedLocal: DailySchedulerDto) => {
    if (!token) return
    const payload = scheduleToUtc(updatedLocal)
    const saved = await updateDeviceSchedule(updatedLocal.id, payload, token)
    const savedLocal = scheduleToLocal(saved)
    setSchedules(prev => prev.map(s => (s.id === savedLocal.id ? savedLocal : s)))
  }

  const handleToggleActive = async (sched: DailySchedulerDto) => {
    hapticSelection()
    try {
      await saveSchedule({ ...sched, active: !sched.active })
      hapticNotify('success')
    } catch {
      hapticNotify('error')
    }
  }

  const handleAddTime = async (sched: DailySchedulerDto) => {
    const grams = Math.max(5, Math.min(200, Number(newGrams) || 20))
    if (!/^\d{2}:\d{2}$/.test(newTime)) return
    hapticImpact('light')
    try {
      const nextTimes = [...sched.scheduledTimes, { feedingTime: newTime, amountInGrams: grams }]
        .sort((a, b) => a.feedingTime.localeCompare(b.feedingTime))
      await saveSchedule({ ...sched, scheduledTimes: nextTimes })
      setAddingToId(null)
      hapticNotify('success')
    } catch {
      hapticNotify('error')
    }
  }

  const handleRemoveTime = async (sched: DailySchedulerDto, index: number) => {
    hapticImpact('medium')
    try {
      const nextTimes = sched.scheduledTimes.filter((_, idx) => idx !== index)
      await saveSchedule({ ...sched, scheduledTimes: nextTimes })
      hapticNotify('success')
    } catch {
      hapticNotify('error')
    }
  }

  const handleQuickPause = async (days: number | 'today') => {
    if (!token || !device) return
    hapticImpact('medium')
    const now = Math.floor(Date.now() / 1000)
    let end: number
    if (days === 'today') {
      const endOfDay = new Date()
      endOfDay.setHours(23, 59, 59, 0)
      end = Math.floor(endOfDay.getTime() / 1000)
    } else {
      end = now + days * 86400
    }
    try {
      const created = await createSuspension(device.id, now, end, token)
      setSuspensions(prev => [...prev, created])
      hapticNotify('success')
    } catch {
      hapticNotify('error')
    }
  }

  const handleDeleteSuspension = async (id: number) => {
    if (!token) return
    hapticImpact('light')
    try {
      await deleteSuspension(id, token)
      setSuspensions(prev => prev.filter(s => s.id !== id))
      hapticNotify('success')
    } catch {
      hapticNotify('error')
    }
  }

  if (!device) {
    return <Placeholder header={t('feeder.noDevices')} />
  }

  if (isLoading && schedules.length === 0) {
    return (
      <Placeholder>
        <Spinner size="l" />
      </Placeholder>
    )
  }

  return (
    <List>
      {schedules.map(sched => (
        <Section key={sched.id} header={sched.taskName || t('schedule.title')}>
          <Cell
            after={
              <Switch
                checked={sched.active}
                onChange={() => void handleToggleActive(sched)}
              />
            }
          >
            {sched.active ? t('schedule.active') : t('schedule.inactive')}
          </Cell>

          {sched.scheduledTimes.length === 0 ? (
            <Cell>{t('schedule.empty')}</Cell>
          ) : (
            sched.scheduledTimes.map((item, idx) => (
              <Cell
                key={`${item.feedingTime}-${idx}`}
                before={<Clock size={18} />}
                subtitle={`${item.amountInGrams} г`}
                after={
                  <IconButton
                    size="s"
                    mode="plain"
                    onClick={() => void handleRemoveTime(sched, idx)}
                  >
                    <Trash2 size={18} />
                  </IconButton>
                }
              >
                {item.feedingTime}
              </Cell>
            ))
          )}

          {addingToId === sched.id ? (
            <div style={{ padding: '8px 16px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <Input
                  type="time"
                  value={newTime}
                  onChange={e => setNewTime(e.target.value)}
                  style={{ flex: 1 }}
                />
                <Input
                  type="number"
                  min={5}
                  max={200}
                  step={5}
                  value={newGrams}
                  onChange={e => setNewGrams(e.target.value)}
                  placeholder={t('schedule.grams')}
                  style={{ width: 96 }}
                />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button size="s" mode="filled" stretched onClick={() => void handleAddTime(sched)}>
                  {t('schedule.add')}
                </Button>
                <Button size="s" mode="bezeled" onClick={() => setAddingToId(null)}>
                  ✕
                </Button>
              </div>
            </div>
          ) : (
            <Cell
              before={<Plus size={18} />}
              onClick={() => {
                hapticSelection()
                setAddingToId(sched.id)
              }}
            >
              {t('schedule.addTime')}
            </Cell>
          )}
        </Section>
      ))}

      <Section header={t('schedule.suspensions')}>
        <div style={{ display: 'flex', gap: 8, padding: '12px 16px' }}>
          <Button size="s" mode="bezeled" stretched onClick={() => void handleQuickPause('today')}>
            {t('schedule.pauseToday')}
          </Button>
          <Button size="s" mode="bezeled" stretched onClick={() => void handleQuickPause(3)}>
            {t('schedule.pause3Days')}
          </Button>
        </div>

        {suspensions.length === 0 ? (
          <Cell>{t('schedule.noSuspensions')}</Cell>
        ) : (
          suspensions.map(susp => (
            <Cell
              key={susp.id}
              before={<PauseCircle size={18} />}
              after={
                <IconButton
                  size="s"
                  mode="plain"
                  onClick={() => void handleDeleteSuspension(susp.id)}
                >
                  <Trash2 size={18} />
                </IconButton>
              }
            >
              {t('schedule.fromTo', {
                from: formatEpochDateTime(susp.startSuspension, i18n.language),
                to: formatEpochDateTime(susp.endSuspension, i18n.language),
              })}
            </Cell>
          ))
        )}
      </Section>
    </List>
  )
}
