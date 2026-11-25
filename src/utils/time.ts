import type { DailySchedulerDto } from '../types/api'

function shiftTime(time: string, offsetMinutes: number): string {
  const [hStr, mStr] = time.split(':')
  const h = Number(hStr)
  const m = Number(mStr)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return time
  const total = ((h * 60 + m + offsetMinutes) % 1440 + 1440) % 1440
  const outH = Math.floor(total / 60).toString().padStart(2, '0')
  const outM = (total % 60).toString().padStart(2, '0')
  return `${outH}:${outM}`
}

export function scheduleToLocal(scheduler: DailySchedulerDto): DailySchedulerDto {
  // getTimezoneOffset() is (UTC - local) in minutes, so local = UTC - offset
  const offset = -new Date().getTimezoneOffset()
  return {
    ...scheduler,
    scheduledTimes: scheduler.scheduledTimes.map(t => ({
      ...t,
      feedingTime: shiftTime(t.feedingTime, offset),
    })),
  }
}

export function scheduleToUtc(scheduler: DailySchedulerDto): DailySchedulerDto {
  const offset = new Date().getTimezoneOffset()
  return {
    ...scheduler,
    scheduledTimes: scheduler.scheduledTimes.map(t => ({
      ...t,
      feedingTime: shiftTime(t.feedingTime, offset),
    })),
  }
}

export function formatEpochDateTime(epochSeconds: number, locale = 'ru'): string {
  return new Date(epochSeconds * 1000).toLocaleString(locale, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
