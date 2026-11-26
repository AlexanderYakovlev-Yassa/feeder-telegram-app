import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Badge,
  Button,
  Cell,
  List,
  Placeholder,
  Section,
  Spinner,
  Switch,
} from '@telegram-apps/telegram-ui'
import { BatteryCharging, Camera, Plug, RefreshCw, Smartphone } from 'lucide-react'
import {
  fetchSmartPlugsOverview,
  setSmartPlugPower,
  updatePhonePlugSettings,
} from '../api/client'
import { useAuth } from '../context/AuthContext'
import type { PlugStateDto, SmartPlugsOverviewDto } from '../types/api'
import { hapticImpact, hapticNotify, hapticSelection } from '../utils/telegram'

function formatTelemetry(plug: PlugStateDto | null): string | undefined {
  if (!plug) return undefined
  if (plug.error) return plug.error
  const parts: string[] = []
  if (plug.powerW !== null && plug.powerW !== undefined) parts.push(`${plug.powerW.toFixed(1)} W`)
  if (plug.voltageV !== null && plug.voltageV !== undefined) parts.push(`${plug.voltageV.toFixed(0)} V`)
  if (plug.currentMa !== null && plug.currentMa !== undefined) parts.push(`${plug.currentMa} mA`)
  return parts.length > 0 ? parts.join(' · ') : undefined
}

export function PlugsPage() {
  const { t } = useTranslation()
  const { token } = useAuth()
  const [overview, setOverview] = useState<SmartPlugsOverviewDto | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadOverview = useCallback(async () => {
    if (!token) return
    setIsLoading(true)
    setError(null)
    try {
      const data = await fetchSmartPlugsOverview(token)
      setOverview(data)
    } catch {
      setError(t('plugs.loadError'))
    } finally {
      setIsLoading(false)
    }
  }, [token, t])

  useEffect(() => {
    void loadOverview()
  }, [loadOverview])

  const handleTogglePower = async (plugName: 'phone' | 'camera', currentOn: boolean | null | undefined) => {
    if (!token || busyKey) return
    hapticImpact('medium')
    setBusyKey(plugName)
    try {
      const updated = await setSmartPlugPower(plugName, !currentOn, token)
      setOverview(updated)
      hapticNotify('success')
    } catch {
      hapticNotify('error')
    } finally {
      setBusyKey(null)
    }
  }

  const handleToggleAutoCharge = async () => {
    if (!token || !overview?.phoneSettings || busyKey) return
    const { autoMode, minBattery, maxBattery } = overview.phoneSettings
    hapticSelection()
    setBusyKey('autoMode')
    try {
      const updated = await updatePhonePlugSettings(!autoMode, minBattery, maxBattery, token)
      setOverview(updated)
      hapticNotify('success')
    } catch {
      hapticNotify('error')
    } finally {
      setBusyKey(null)
    }
  }

  if (isLoading && !overview) {
    return (
      <Placeholder>
        <Spinner size="l" />
      </Placeholder>
    )
  }

  if (error && !overview) {
    return (
      <Placeholder
        header={error}
        action={
          <Button size="m" onClick={() => void loadOverview()}>
            {t('plugs.refresh')}
          </Button>
        }
      />
    )
  }

  const phonePlug = overview?.phonePlug ?? null
  const cameraPlug = overview?.cameraPlug ?? null
  const phoneBattery = overview?.phoneBattery ?? null
  const phoneSettings = overview?.phoneSettings ?? null
  const cameraSettings = overview?.cameraSettings ?? null

  return (
    <List>
      <Section
        header={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <span>{t('plugs.phonePlug')}</span>
            <Badge type="number" mode={phonePlug?.online ? 'primary' : 'secondary'}>
              {phonePlug?.online ? t('plugs.online') : t('plugs.offline')}
            </Badge>
          </div>
        }
      >
        <Cell
          before={<Smartphone size={20} />}
          subtitle={formatTelemetry(phonePlug)}
          after={
            busyKey === 'phone' ? (
              <Spinner size="s" />
            ) : (
              <Switch
                checked={Boolean(phonePlug?.on)}
                disabled={!phonePlug?.online}
                onChange={() => void handleTogglePower('phone', phonePlug?.on)}
              />
            )
          }
        >
          {phonePlug?.on ? t('plugs.on') : t('plugs.off')}
        </Cell>

        {phoneBattery && (
          <Cell
            before={<BatteryCharging size={20} />}
            subtitle={[phoneBattery.status, phoneBattery.plugged].filter(Boolean).join(' · ') || undefined}
            after={phoneBattery.percentage !== null ? <strong>{phoneBattery.percentage}%</strong> : '—'}
          >
            {t('plugs.battery')}
          </Cell>
        )}

        {phoneSettings && (
          <Cell
            before={<Plug size={20} />}
            after={
              <Switch
                checked={phoneSettings.autoMode}
                disabled={busyKey === 'autoMode'}
                onChange={() => void handleToggleAutoCharge()}
              />
            }
          >
            {t('plugs.autoCharge', { min: phoneSettings.minBattery, max: phoneSettings.maxBattery })}
          </Cell>
        )}
      </Section>

      <Section
        header={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <span>{t('plugs.cameraPlug')}</span>
            <Badge type="number" mode={cameraPlug?.online ? 'primary' : 'secondary'}>
              {cameraPlug?.online ? t('plugs.online') : t('plugs.offline')}
            </Badge>
          </div>
        }
      >
        <Cell
          before={<Camera size={20} />}
          subtitle={formatTelemetry(cameraPlug)}
          after={
            busyKey === 'camera' ? (
              <Spinner size="s" />
            ) : (
              <Switch
                checked={Boolean(cameraPlug?.on)}
                disabled={!cameraPlug?.online}
                onChange={() => void handleTogglePower('camera', cameraPlug?.on)}
              />
            )
          }
        >
          {cameraPlug?.on ? t('plugs.on') : t('plugs.off')}
        </Cell>

        {cameraSettings && (
          <Cell>
            {cameraSettings.scheduleEnabled && cameraSettings.startTime && cameraSettings.endTime
              ? t('plugs.schedule', {
                  from: cameraSettings.startTime.slice(0, 5),
                  to: cameraSettings.endTime.slice(0, 5),
                })
              : t('plugs.scheduleOff')}
          </Cell>
        )}
      </Section>

      <div style={{ padding: '8px 16px 16px' }}>
        <Button
          size="m"
          mode="bezeled"
          stretched
          before={<RefreshCw size={16} />}
          loading={isLoading}
          onClick={() => {
            hapticSelection()
            void loadOverview()
          }}
        >
          {t('plugs.refresh')}
        </Button>
      </div>
    </List>
  )
}
