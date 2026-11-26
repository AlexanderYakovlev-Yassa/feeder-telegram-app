import type {
  AudioPresetDto,
  CameraDto,
  DailySchedulerDto,
  DeviceDto,
  RecordingDayDto,
  SegmentInfoDto,
  SmartPlugsOverviewDto,
  SuspensionDto,
} from '../types/api'

const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ''
const API_PREFIX = '/feeder-service/api'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export function getApiUrl(path: string): string {
  return `${BASE_URL}${API_PREFIX}${path}`
}

async function apiRequest<T>(
  path: string,
  token: string | null,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(getApiUrl(path), {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  })

  if (!res.ok) {
    let message = `Request failed (${res.status})`
    try {
      const data = (await res.json()) as { message?: string }
      if (data?.message) message = data.message
    } catch {
      // ignore non-json error bodies
    }
    throw new ApiError(res.status, message)
  }

  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

export async function loginWithTelegram(initData: string): Promise<string> {
  const res = await apiRequest<{ token: string }>('/auth/telegram', null, {
    method: 'POST',
    body: JSON.stringify({ initData }),
  })
  return res.token
}

export async function loginWithPassword(username: string, password: string): Promise<string> {
  const res = await apiRequest<{ token: string }>('/auth/login', null, {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
  return res.token
}

export function fetchUserDevices(userId: number, token: string): Promise<DeviceDto[]> {
  return apiRequest<DeviceDto[]>(`/users/${userId}/devices`, token)
}

export function feedDevice(serialNumber: string, amountInGrams: number, token: string): Promise<void> {
  return apiRequest<void>('/feed', token, {
    method: 'POST',
    body: JSON.stringify({ serialNumber, amountInGrams }),
  })
}

export function fetchDeviceSchedules(deviceId: number, token: string): Promise<DailySchedulerDto[]> {
  return apiRequest<DailySchedulerDto[]>(`/schedulers/device/${deviceId}`, token)
}

export function updateDeviceSchedule(
  id: number,
  scheduler: DailySchedulerDto,
  token: string,
): Promise<DailySchedulerDto> {
  return apiRequest<DailySchedulerDto>(`/schedulers/${id}`, token, {
    method: 'PUT',
    body: JSON.stringify(scheduler),
  })
}

export function fetchDeviceSuspensions(deviceId: number, token: string): Promise<SuspensionDto[]> {
  return apiRequest<SuspensionDto[]>(`/suspensions/device/${deviceId}`, token)
}

export function createSuspension(
  deviceId: number,
  startSuspension: number,
  endSuspension: number,
  token: string,
): Promise<SuspensionDto> {
  return apiRequest<SuspensionDto>('/suspensions', token, {
    method: 'POST',
    body: JSON.stringify({ deviceId, startSuspension, endSuspension }),
  })
}

export function deleteSuspension(id: number, token: string): Promise<void> {
  return apiRequest<void>(`/suspensions/${id}`, token, { method: 'DELETE' })
}

export function fetchAudioPresets(token: string): Promise<AudioPresetDto[]> {
  return apiRequest<AudioPresetDto[]>('/audio/presets', token)
}

export function playAudioPreset(presetId: string, token: string): Promise<void> {
  return apiRequest<void>(`/audio/play/${encodeURIComponent(presetId)}`, token, {
    method: 'POST',
  })
}

export function fetchUserCameras(userId: number, token: string): Promise<CameraDto[]> {
  return apiRequest<CameraDto[]>(`/users/${userId}/cameras`, token)
}

export function fetchCameraStatus(token: string): Promise<Record<string, boolean>> {
  return apiRequest<Record<string, boolean>>('/camera/status', token)
}

export function fetchCameraReachability(token: string): Promise<Record<string, boolean>> {
  return apiRequest<Record<string, boolean>>('/camera/reachability', token)
}

export function fetchRecordingDays(cameraName: string, token: string): Promise<RecordingDayDto[]> {
  return apiRequest<RecordingDayDto[]>(`/camera/${encodeURIComponent(cameraName)}/recordings`, token)
}

export function fetchRecordingSegments(
  cameraName: string,
  date: string,
  token: string,
): Promise<SegmentInfoDto[]> {
  return apiRequest<SegmentInfoDto[]>(
    `/camera/${encodeURIComponent(cameraName)}/recordings/${encodeURIComponent(date)}`,
    token,
  )
}

export async function fetchCameraSnapshotUrl(cameraName: string, token: string): Promise<string> {
  const res = await fetch(getApiUrl(`/camera/${encodeURIComponent(cameraName)}/snapshot?t=${Date.now()}`), {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    throw new ApiError(res.status, `Snapshot failed (${res.status})`)
  }
  const blob = await res.blob()
  return URL.createObjectURL(blob)
}

export async function downloadRecordingSegment(
  cameraName: string,
  filename: string,
  token: string,
): Promise<void> {
  const res = await fetch(
    getApiUrl(`/camera/${encodeURIComponent(cameraName)}/segments/${encodeURIComponent(filename)}/download`),
    { headers: { Authorization: `Bearer ${token}` } },
  )
  if (!res.ok) {
    throw new ApiError(res.status, `Download failed (${res.status})`)
  }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function fetchSmartPlugsOverview(token: string): Promise<SmartPlugsOverviewDto> {
  return apiRequest<SmartPlugsOverviewDto>('/smart-plugs', token)
}

export function setSmartPlugPower(
  plugName: 'phone' | 'camera',
  on: boolean,
  token: string,
): Promise<SmartPlugsOverviewDto> {
  return apiRequest<SmartPlugsOverviewDto>(`/smart-plugs/${plugName}/power`, token, {
    method: 'POST',
    body: JSON.stringify({ on }),
  })
}

export function updatePhonePlugSettings(
  autoMode: boolean,
  minBattery: number,
  maxBattery: number,
  token: string,
): Promise<SmartPlugsOverviewDto> {
  return apiRequest<SmartPlugsOverviewDto>('/smart-plugs/phone/settings', token, {
    method: 'PUT',
    body: JSON.stringify({ autoMode, minBattery, maxBattery }),
  })
}
