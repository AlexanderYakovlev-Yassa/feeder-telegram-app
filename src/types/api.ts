export interface DeviceDto {
  id: number
  name: string
  serialNumber: string
  userId: number
  feedConsumption: number
}

export interface ScheduledTime {
  amountInGrams: number
  feedingTime: string // HH:mm
}

export interface DailySchedulerDto {
  id: number
  taskName: string
  userId: number
  deviceId: number
  scheduledTimes: ScheduledTime[]
  active: boolean
}

export interface SuspensionDto {
  id: number
  deviceId: number
  startSuspension: number // Unix epoch seconds, UTC
  endSuspension: number // Unix epoch seconds, UTC
}

export interface CameraDto {
  id: number
  name: string
  rtspUrl: string
  storagePath: string
  autoStart: boolean
  userIds: number[]
}

export interface SegmentInfoDto {
  filename: string
  date: string
  startTime: string
  sizeBytes: number
}

export interface RecordingDayDto {
  date: string
  segmentCount: number
  totalSizeBytes: number
  segments: SegmentInfoDto[]
}

export interface AudioPresetDto {
  id: string
  name: string
  description?: string
  durationSeconds?: number
  icon?: string
  custom?: boolean
}

export interface PlugStateDto {
  online: boolean
  on: boolean | null
  voltageV: number | null
  powerW: number | null
  currentMa: number | null
  error: string | null
}

export interface PhoneBatteryDto {
  online: boolean
  percentage: number | null
  plugged: string | null
  status: string | null
}

export interface PhonePlugSettingsDto {
  autoMode: boolean
  minBattery: number
  maxBattery: number
}

export interface CameraPlugSettingsDto {
  scheduleEnabled: boolean
  startTime: string | null
  endTime: string | null
  week1Days: string[]
  week2Days: string[]
  currentWeek: number
}

export interface SmartPlugsOverviewDto {
  phonePlug: PlugStateDto | null
  cameraPlug: PlugStateDto | null
  phoneBattery: PhoneBatteryDto | null
  phoneSettings: PhonePlugSettingsDto | null
  cameraSettings: CameraPlugSettingsDto | null
}
